'use strict';

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isTextFile, listProjectFiles, readSmallText } = require('./repo-analysis.cjs');
const { blocker } = require('./guidance.cjs');
const { auditCommandFor, packageManagerFor } = require('./package-manager.cjs');
const { preflightProjectArtifacts, readManagedJson, withManagedArtifactLock, writeManagedJson, writeProjectText } = require('./managed-artifacts.cjs');

const SECRET_PATTERNS = [
  { code: 'SECRET_AWS_ACCESS_KEY', severity: 'critical', pattern: /AKIA[0-9A-Z]{16}/ },
  { code: 'SECRET_GITHUB_TOKEN', severity: 'critical', pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { code: 'SECRET_PRIVATE_KEY', severity: 'critical', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { code: 'SECRET_GENERIC_ASSIGNMENT', severity: 'high', pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"]{12,}['"]/i }
];
const REACT_RAW_HTML_TOKEN = 'dangerously' + 'SetInnerHTML';
const SECURITY_FILE_LIMIT = 10000;
const SECURITY_TEXT_MAX_BYTES = 150000;
const SECURITY_EVIDENCE_SCHEMA_VERSION = 1;
const SECURITY_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function finding(id, severity, file, claim, evidence, recommendedFix) {
  const classification = severity === 'critical' || severity === 'high' ? 'blocking' : 'warning';
  return {
    id,
    code: id.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    mode: 'security',
    severity,
    classification,
    file_or_artifact: file,
    file,
    claim,
    message: claim,
    evidence,
    recommended_fix: recommendedFix,
    why_blocked: classification === 'blocking'
      ? 'Security findings with high or critical severity must be resolved before release readiness passes.'
      : 'Security findings should be reviewed before release even when they are not blocking.',
    next_command: 'terrace security check',
    remediation: recommendedFix + ' Then rerun `terrace security check`.',
    source: 'terrace security check'
  };
}

function isGeneratedSecurityArtifact(file) {
  const normalized = file.replace(/\\/g, '/');
  return normalized.startsWith('.terrace/') || normalized.startsWith('docs/terrace/');
}

function securityFilePriority(file) {
  const normalized = file.replace(/\\/g, '/');
  const base = path.basename(normalized);
  if (/^\.env(?:\.|$)/.test(base) || /(^|\/)(?:\.(?:dockerignore|gitignore|npmrc)|package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|docker[^/]*|compose[^/]*|\.github\/workflows\/[^/]+\.ya?ml)$/i.test(normalized)) {
    return 0;
  }
  if (/\.(?:c|cc|cjs|cpp|cs|go|h|hpp|java|js|jsx|kt|kts|mjs|php|prisma|py|rb|rs|sh|sql|swift|ts|tsx)$/i.test(normalized)) {
    return 1;
  }
  if (/(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\./i.test(normalized)) {
    return 2;
  }
  if (normalized.startsWith('docs/')) {
    return 3;
  }
  return 2;
}

function securityFileCompare(left, right) {
  const priority = securityFilePriority(left) - securityFilePriority(right);
  return priority !== 0 ? priority : left.localeCompare(right);
}

function securityScope(cwd, onText) {
  const candidates = listProjectFiles(cwd, {
    limit: SECURITY_FILE_LIMIT + 1,
    filter: (file) => isTextFile(file) && !isGeneratedSecurityArtifact(file),
    compare: securityFileCompare
  });
  const truncated = candidates.length > SECURITY_FILE_LIMIT;
  const selected = candidates.slice(0, SECURITY_FILE_LIMIT);
  const files = [];
  const unreadableFiles = [];
  const fingerprint = crypto.createHash('sha256');
  for (const file of selected) {
    const text = readSmallText(cwd, file, SECURITY_TEXT_MAX_BYTES);
    if (text === null) {
      unreadableFiles.push(file);
      continue;
    }
    files.push(file);
    fingerprint.update(file);
    fingerprint.update('\u0000');
    fingerprint.update(text);
    fingerprint.update('\u0000');
    if (typeof onText === 'function') {
      onText(file, text);
    }
  }
  return {
    files,
    input_fingerprint: fingerprint.digest('hex'),
    scope: {
      candidate_file_count: selected.length,
      scanned_file_count: files.length,
      truncated,
      unreadable_files: unreadableFiles,
      complete: !truncated && unreadableFiles.length === 0
    }
  };
}

function scanTextFindings(file, text, findings) {
  const base = path.basename(file);
  if (/^\.env(\.|$)/.test(base) && !/\.example$/.test(base)) {
    findings.push(finding(
      'env-file-' + findings.length,
      'high',
      file,
      'Environment file is present in the repository inventory.',
      'Terrace found ' + file + '. Environment files often contain credentials.',
      'Move secrets out of committed files and keep only .env.example templates.'
    ));
  }
  for (const secret of SECRET_PATTERNS) {
    if (secret.pattern.test(text)) {
      findings.push(finding(
        secret.code.toLowerCase() + '-' + findings.length,
        secret.severity,
        file,
        'Potential secret material appears in a tracked text file.',
        secret.code + ' matched in ' + file + '.',
        'Rotate the credential if real, remove it from source, and add a safe fixture value.'
      ));
    }
  }
  if (/(console\.(log|debug|info)|logger\.(info|debug|trace))\([^)]*(token|secret|password|authorization|cookie)/is.test(text)) {
    findings.push(finding(
      'sensitive-logging-' + findings.length,
      'medium',
      file,
      'Logging code appears to include sensitive authentication fields.',
      'A logging call references token, secret, password, authorization, or cookie.',
      'Redact sensitive values before logging and add a regression test for redaction.'
    ));
  }
  if (text.includes(REACT_RAW_HTML_TOKEN)) {
    findings.push(finding(
      'react-html-injection-' + findings.length,
      'medium',
      file,
      'React raw HTML rendering requires sanitization evidence.',
      REACT_RAW_HTML_TOKEN + ' appears in ' + file + '.',
      'Document sanitization or replace raw HTML rendering with safe structured rendering.'
    ));
  }
}

function scanConfigFindings(file, text, findings) {
  if (/docker/i.test(file)) {
    findings.push(finding(
      'docker-review-' + findings.length,
      'info',
      file,
      'Container configuration should be reviewed for runtime user and secret handling.',
      file + ' is part of the deployment surface.',
      'Confirm the image avoids root runtime, does not bake secrets, and has a minimal build context.'
    ));
  }
  if (/\.github\/workflows\/.*\.ya?ml$/.test(file)) {
    if (!/^\s*permissions\s*:/m.test(text)) {
      findings.push(finding(
        'workflow-permissions-' + findings.length,
        'info',
        file,
        'GitHub Actions workflow should declare least-privilege permissions.',
        file + ' is a CI workflow without explicit top-level permissions.',
        'Set explicit permissions and avoid printing secrets in build logs.'
      ));
    }
  }
}

function scopeFindings(scope) {
  const findings = [];
  if (scope.scope.truncated) {
    findings.push(finding(
      'security-scope-truncated',
      'high',
      'security-scope',
      'Security source inventory exceeded the deterministic scan limit.',
      'The scanner selected ' + String(SECURITY_FILE_LIMIT) + ' text files and found additional files outside that review scope.',
      'Reduce generated text inventory, exclude generated output through .gitignore, or split the project before relying on this release gate.'
    ));
  }
  if (scope.scope.unreadable_files.length > 0) {
    findings.push(finding(
      'security-scope-incomplete',
      'high',
      'security-scope',
      'One or more security text candidates could not be read within the scan limit.',
      'Unreadable candidates: ' + scope.scope.unreadable_files.slice(0, 5).join(', ') + '.',
      'Reduce oversized text files or inspect them separately before relying on this release gate.'
    ));
  }
  return findings;
}

function dependencyAuditFindings(cwd, metadata) {
  const audit = metadata || dependencyAuditMetadata(cwd);
  if (!audit.lockfile_present) {
    return {
      metadata: {
        ...audit,
        status: 'not_applicable'
      },
      findings: []
    };
  }
  try {
    const output = execFileSync(audit.command[0], audit.command.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3000 });
    return dependencyAuditResult(audit, output);
  } catch (error) {
    const text = error && error.stdout ? String(error.stdout) : '';
    if (text.trim().startsWith('{')) {
      return dependencyAuditResult(audit, text);
    }
    return dependencyAuditUnavailable(audit, error && error.message ? error.message : audit.display + ' failed without JSON output.');
  }
}

function dependencyAuditResult(audit, output) {
  let parsed;
  try {
    parsed = JSON.parse(output || '{}');
  } catch (error) {
    return dependencyAuditUnavailable(audit, audit.display + ' returned invalid JSON.');
  }
  if (!isCompleteDependencyAuditJson(parsed)) {
    const detail = parsed && typeof parsed.error === 'string'
      ? parsed.error
      : audit.display + ' returned JSON without a recognized audit result schema.';
    return dependencyAuditUnavailable(audit, detail);
  }
  return {
    metadata: {
      ...audit,
      status: 'complete'
    },
    findings: auditJsonFindings(parsed, audit)
  };
}

function isCompleteDependencyAuditJson(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.prototype.hasOwnProperty.call(parsed, 'error')) {
    return false;
  }
  return (parsed.vulnerabilities && typeof parsed.vulnerabilities === 'object') ||
    (parsed.advisories && typeof parsed.advisories === 'object') ||
    (parsed.metadata && typeof parsed.metadata === 'object');
}

function dependencyAuditUnavailable(audit, detail) {
  return {
    metadata: {
      ...audit,
      status: 'unavailable',
      error: detail
    },
    findings: [finding(
      audit.package_manager + '-audit-unavailable',
      'high',
      audit.file,
      audit.display + ' could not produce dependency vulnerability data.',
      detail,
      'Restore a usable dependency audit command and rerun terrace security check.'
    )]
  };
}

function dependencyAuditMetadata(cwd) {
  const packageManager = packageManagerFor(cwd);
  const audit = auditCommandFor(packageManager);
  return {
    package_manager: packageManager,
    file: audit.file,
    command: audit.command,
    display: audit.display,
    lockfile_present: fs.existsSync(path.join(cwd, audit.file))
  };
}

function auditJsonFindings(parsed, audit) {
  const vulnerabilities = parsed && parsed.vulnerabilities && typeof parsed.vulnerabilities === 'object' ? parsed.vulnerabilities : {};
  const advisories = parsed && parsed.advisories && typeof parsed.advisories === 'object' ? parsed.advisories : {};
  const entries = Object.keys(vulnerabilities).length > 0 ? vulnerabilities : advisories;
  return Object.entries(entries).map(([name, item], index) => {
    const severity = item && item.severity ? item.severity : 'medium';
    const dependency = item && item.module_name ? item.module_name : name;
    return finding(
      audit.command[0] + '-audit-' + dependency + '-' + String(index),
      severity === 'critical' || severity === 'high' ? severity : 'medium',
      audit.file,
      'Dependency vulnerability reported for ' + dependency + '.',
      audit.display + ' severity: ' + severity + '.',
      'Upgrade or replace ' + dependency + ' and rerun terrace security check.'
    );
  });
}

function securityMarkdown(result) {
  return [
    '# Security Check',
    '',
    '## Summary',
    '- Status: ' + result.status,
    '- Findings: ' + String(result.findings.length),
    '- Blocking: ' + String(result.blocking.length),
    '- Evidence schema: ' + String(result.evidence.schema_version),
    '- Scope complete: ' + String(result.evidence.scope.complete),
    '',
    '## Findings',
    ...(result.findings.length > 0
      ? result.findings.map((item) => '- ' + item.id + ' [' + item.severity + ']: ' + item.claim + ' (' + item.file_or_artifact + ')')
      : ['- No security findings from deterministic checks.']),
    '',
    '## Checks',
    ...result.checks.map((check) => '- ' + check)
  ];
}

function runSecurityCheck(cwd) {
  const textFindings = [];
  const configFindings = [];
  const scope = securityScope(cwd, (file, text) => {
    scanTextFindings(file, text, textFindings);
    scanConfigFindings(file, text, configFindings);
  });
  const dependencyAudit = dependencyAuditFindings(cwd, dependencyAuditMetadata(cwd));
  const createdAt = new Date().toISOString();
  const checks = ['secret-patterns', 'env-files', 'sensitive-logging', 'dependency-audit', 'deployment-config'];
  const findings = [
    ...scopeFindings(scope),
    ...textFindings,
    ...configFindings,
    ...dependencyAudit.findings
  ];
  const blocking = findings.filter((item) => item.classification === 'blocking');
  const result = {
    checks,
    status: blocking.length > 0 ? 'blocked' : 'passed',
    artifact: '.terrace/security/latest.json',
    markdown: 'docs/terrace/security/SECURITY-CHECK.md',
    created_at: createdAt,
    dependency_audit: dependencyAudit.metadata,
    evidence: {
      schema_version: SECURITY_EVIDENCE_SCHEMA_VERSION,
      kind: 'terrace.security-check',
      scanner_version: '1',
      created_at: createdAt,
      input_fingerprint: scope.input_fingerprint,
      scope: scope.scope,
      dependency_audit: {
        file: dependencyAudit.metadata.file,
        lockfile_present: dependencyAudit.metadata.lockfile_present,
        status: dependencyAudit.metadata.status
      }
    },
    findings,
    blocking,
    warnings: findings.filter((item) => item.classification !== 'blocking')
  };
  return withManagedArtifactLock(cwd, () => {
    preflightProjectArtifacts(cwd, [result.markdown]);
    writeManagedJson(cwd, 'security/latest.json', result);
    writeProjectText(cwd, result.markdown, securityMarkdown(result).join('\n') + '\n');
    return result;
  });
}

function securityBlocker(code, message, whyBlocked, remediation) {
  return blocker({
    code,
    message,
    file: '.terrace/security/latest.json',
    why_blocked: whyBlocked,
    next_command: 'terrace security check',
    remediation
  });
}

function securityEvidenceValidation(cwd, result, options) {
  const opts = options || {};
  const maxAgeMs = typeof opts.maxAgeMs === 'number' ? opts.maxAgeMs : SECURITY_EVIDENCE_MAX_AGE_MS;
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const evidence = result.evidence;
  if (!evidence || evidence.schema_version !== SECURITY_EVIDENCE_SCHEMA_VERSION || evidence.kind !== 'terrace.security-check') {
    return {
      age_ms: null,
      blockers: [securityBlocker(
        'SECURITY_CHECK_LEGACY',
        'Security evidence does not include the current provenance schema.',
        'Terrace cannot trust legacy security evidence because it lacks source freshness and audit-completeness proof.',
        'Run terrace security check to regenerate schema-versioned security evidence.'
      )]
    };
  }
  if (!Array.isArray(result.findings) || !Array.isArray(result.blocking) || !Array.isArray(result.warnings) || result.created_at !== evidence.created_at) {
    return {
      age_ms: null,
      blockers: [securityBlocker(
        'SECURITY_CHECK_INVALID',
        'Security evidence is missing required result fields or has inconsistent provenance.',
        'Terrace cannot trust evidence whose findings, timestamp, or blocking state is incomplete.',
        'Run terrace security check to regenerate complete security evidence.'
      )]
    };
  }
  const createdAt = Date.parse(result.created_at || evidence.created_at || '');
  if (Number.isNaN(createdAt) || createdAt > now) {
    return {
      age_ms: null,
      blockers: [securityBlocker(
        'SECURITY_CHECK_INVALID',
        'Security evidence has an invalid creation timestamp.',
        'Terrace cannot determine whether security evidence is current.',
        'Run terrace security check to regenerate valid security evidence.'
      )]
    };
  }
  const blockers = [];
  const ageMs = now - createdAt;
  if (ageMs > maxAgeMs) {
    blockers.push(securityBlocker(
      'SECURITY_CHECK_STALE',
      'Security evidence is older than the allowed freshness window.',
      'Release readiness requires recently generated security evidence.',
      'Run terrace security check before release.'
    ));
  }
  if (!evidence.scope || evidence.scope.complete !== true) {
    blockers.push(securityBlocker(
      'SECURITY_CHECK_SCOPE_INCOMPLETE',
      'Security evidence was generated from an incomplete source scope.',
      'Terrace cannot claim complete deterministic security coverage from a truncated or unreadable source inventory.',
      'Resolve the scan-scope finding and rerun terrace security check.'
    ));
  }
  const currentDependencyAudit = dependencyAuditMetadata(cwd);
  if (currentDependencyAudit.lockfile_present && (
    !evidence.dependency_audit ||
    evidence.dependency_audit.file !== currentDependencyAudit.file ||
    evidence.dependency_audit.lockfile_present !== true ||
    evidence.dependency_audit.status !== 'complete'
  )) {
    blockers.push(securityBlocker(
      'DEPENDENCY_AUDIT_UNAVAILABLE',
      'Security evidence did not include a completed dependency audit for the present lockfile.',
      'A release cannot treat unavailable dependency vulnerability data as a passing security signal.',
      'Restore the dependency audit command and rerun terrace security check.'
    ));
  }
  const currentScope = securityScope(cwd);
  if (!currentScope.scope.complete) {
    blockers.push(securityBlocker(
      'SECURITY_CHECK_SCOPE_CHANGED',
      'Current security source scope is incomplete and cannot be compared safely to recorded evidence.',
      'Terrace cannot verify freshness while the current deterministic scan scope is incomplete.',
      'Resolve the scan-scope finding and rerun terrace security check.'
    ));
  } else if (currentScope.input_fingerprint !== evidence.input_fingerprint) {
    blockers.push(securityBlocker(
      'SECURITY_CHECK_STALE',
      'Security-relevant source or configuration changed after the recorded security check.',
      'Release readiness requires security evidence that matches the current source and dependency inputs.',
      'Run terrace security check after reviewing the source or lockfile change.'
    ));
  }
  return {
    age_ms: ageMs,
    blockers
  };
}

function securityShipCheck(cwd, options) {
  const artifact = '.terrace/security/latest.json';
  let result;
  try {
    result = readManagedJson(cwd, 'security/latest.json', null);
  } catch (error) {
    return {
      category: 'security',
      command: 'terrace security check',
      passed: false,
      security_check: null,
      blocking: [securityBlocker(
        'SECURITY_CHECK_INVALID',
        artifact + ' could not be parsed.',
        'Terrace cannot trust malformed or unsafe security evidence.',
        'Resolve the managed-artifact error, then rerun terrace security check to regenerate the security artifact.'
      )],
      warnings: []
    };
  }
  if (result === null) {
    return {
      category: 'security',
      command: 'terrace security check',
      passed: false,
      security_check: null,
      blocking: [securityBlocker(
        'SECURITY_CHECK_REQUIRED',
        'No security check artifact has been recorded.',
        'Release readiness requires current security evidence instead of an assumed passing state.',
        'Run terrace security check before release.'
      )],
      warnings: []
    };
  }
  const validation = securityEvidenceValidation(cwd, result, options);
  const recordedBlocking = Array.isArray(result.blocking) ? result.blocking : [];
  return {
    category: 'security',
    command: 'terrace security check',
    passed: recordedBlocking.length === 0 && validation.blockers.length === 0,
    security_check: {
      status: result.status,
      artifact,
      markdown: result.markdown || null,
      created_at: result.created_at || null,
      age_ms: validation.age_ms,
      input_fingerprint: result.evidence && result.evidence.input_fingerprint ? result.evidence.input_fingerprint : null
    },
    blocking: [...recordedBlocking, ...validation.blockers],
    warnings: result.warnings || []
  };
}

module.exports = {
  runSecurityCheck,
  securityShipCheck
};
