'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { analyzeRepository, readSmallText } = require('./repo-analysis.cjs');
const { blocker, warning } = require('./guidance.cjs');
const { auditCommandFor, packageManagerFor } = require('./package-manager.cjs');
const { preflightProjectArtifacts, readManagedJson, withManagedArtifactLock, writeManagedJson, writeProjectText } = require('./managed-artifacts.cjs');

const SECRET_PATTERNS = [
  { code: 'SECRET_AWS_ACCESS_KEY', severity: 'critical', pattern: /AKIA[0-9A-Z]{16}/ },
  { code: 'SECRET_GITHUB_TOKEN', severity: 'critical', pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { code: 'SECRET_PRIVATE_KEY', severity: 'critical', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { code: 'SECRET_GENERIC_ASSIGNMENT', severity: 'high', pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['"][^'"]{12,}['"]/i }
];
const REACT_RAW_HTML_TOKEN = 'dangerously' + 'SetInnerHTML';

const auditCache = new Map();

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

function scanTextFindings(cwd, repo) {
  const findings = [];
  for (const file of repo.files.slice(0, 1000)) {
    if (file.startsWith('.terrace/security/') || file.startsWith('docs/terrace/security/') || file.startsWith('docs/terrace/corpus/runs/')) {
      continue;
    }
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
    const text = readSmallText(cwd, file, 150000);
    if (!text) {
      continue;
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
  return findings;
}

function scanConfigFindings(cwd, repo) {
  const findings = [];
  for (const file of repo.config_files) {
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
      const text = readSmallText(cwd, file, 50000);
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
  return findings;
}

function dependencyAuditFindings(cwd) {
  const audit = dependencyAuditMetadata(cwd);
  if (!fs.existsSync(path.join(cwd, audit.file))) {
    return [];
  }
  if (auditCache.has(cwd)) {
    return auditCache.get(cwd);
  }
  try {
    const output = execFileSync(audit.command[0], audit.command.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3000 });
    const parsed = JSON.parse(output || '{}');
    const findings = auditJsonFindings(parsed, audit);
    auditCache.set(cwd, findings);
    return findings;
  } catch (error) {
    const text = error && error.stdout ? String(error.stdout) : '';
    if (text.trim().startsWith('{')) {
      const findings = auditJsonFindings(JSON.parse(text), audit);
      auditCache.set(cwd, findings);
      return findings;
    }
    const findings = [finding(
      audit.package_manager + '-audit-unavailable',
      'info',
      audit.file,
      audit.display + ' could not produce dependency vulnerability data.',
      error && error.message ? error.message : audit.display + ' failed without JSON output.',
      'Run ' + audit.display + ' locally when network access is available.'
    )];
    auditCache.set(cwd, findings);
    return findings;
  }
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
  const repo = analyzeRepository(cwd);
  const dependencyAudit = dependencyAuditMetadata(cwd);
  const checks = ['secret-patterns', 'env-files', 'sensitive-logging', 'dependency-audit', 'deployment-config'];
  const findings = [
    ...scanTextFindings(cwd, repo),
    ...scanConfigFindings(cwd, repo),
    ...dependencyAuditFindings(cwd)
  ];
  const blocking = findings.filter((item) => item.classification === 'blocking');
  const result = {
    checks,
    status: blocking.length > 0 ? 'blocked' : 'passed',
    artifact: '.terrace/security/latest.json',
    markdown: 'docs/terrace/security/SECURITY-CHECK.md',
    created_at: new Date().toISOString(),
    dependency_audit: dependencyAudit,
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

function securityShipCheck(cwd) {
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
      blocking: [blocker({
        code: 'SECURITY_CHECK_INVALID',
        message: artifact + ' could not be parsed.',
        file: artifact,
        why_blocked: 'Terrace cannot trust malformed or unsafe security evidence.',
        next_command: 'terrace security check',
        remediation: 'Resolve the managed-artifact error, then rerun terrace security check to regenerate the security artifact.'
      })],
      warnings: []
    };
  }
  if (result === null) {
    return {
      category: 'security',
      command: 'terrace security check',
      passed: true,
      security_check: null,
      blocking: [],
      warnings: [warning({
        code: 'SECURITY_CHECK_MISSING',
        message: 'No security check artifact has been recorded.',
        why_blocked: 'Terrace has no current security evidence to include in release readiness.',
        next_command: 'terrace security check',
        remediation: 'Run terrace security check before release if this project has a security-sensitive surface.'
      })]
    };
  }
  return {
    category: 'security',
    command: 'terrace security check',
    passed: !result.blocking || result.blocking.length === 0,
    security_check: {
      status: result.status,
      artifact,
      markdown: result.markdown || null
    },
    blocking: result.blocking || [],
    warnings: result.warnings || []
  };
}

module.exports = {
  runSecurityCheck,
  securityShipCheck
};
