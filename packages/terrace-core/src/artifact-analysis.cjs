'use strict';

const fs = require('fs');
const path = require('path');
const { readManagedJson } = require('./managed-artifacts.cjs');
const { analyzeRepository, readSmallText } = require('./repo-analysis.cjs');

function normalizeImportedFindings(input, mode) {
  const raw = Array.isArray(input) ? input : Array.isArray(input.findings) ? input.findings : [];
  return raw.map((item, index) => normalizeFinding(item, mode, 'import', index));
}

function normalizeFinding(item, mode, source, index) {
  const severity = item.severity || 'medium';
  return {
    id: item.id || source + '-finding-' + String(index + 1),
    mode: item.mode || mode,
    severity,
    classification: item.classification || (severity === 'critical' || severity === 'high' ? 'blocking' : 'warning'),
    file_or_artifact: item.file_or_artifact || item.file || item.artifact || 'repository',
    claim: item.claim || item.message || 'Review finding requires attention.',
    evidence: item.evidence || 'Imported or static evidence did not include extra detail.',
    recommended_fix: item.recommended_fix || item.remediation || 'Review the finding and record a concrete remediation.',
    source
  };
}

function artifactTodoFindings(cwd, featureId, mode) {
  const base = path.join('docs', 'terrace', 'features', featureId);
  if (!fs.existsSync(path.join(cwd, base))) {
    return [normalizeFinding({
      id: 'feature-artifacts-missing',
      severity: 'medium',
      file_or_artifact: base,
      claim: 'Feature artifacts are missing for review.',
      evidence: 'No feature directory exists at ' + base + '.',
      recommended_fix: 'Run senior-cycle commands for ' + featureId + ' before treating review as complete.'
    }, mode, 'static', 0)];
  }
  const findings = [];
  const files = fs.readdirSync(path.join(cwd, base)).filter((file) => file.endsWith('.md'));
  for (const file of files) {
    const rel = path.join(base, file);
    const text = readSmallText(cwd, rel, 100000) || '';
    if (/\bTODO\b|unresolved evidence|missing/i.test(text)) {
      findings.push(normalizeFinding({
        id: 'artifact-evidence-' + findings.length,
        severity: 'medium',
        file_or_artifact: rel,
        claim: 'Feature artifact still contains unresolved evidence markers.',
        evidence: rel + ' includes TODO, missing, or unresolved evidence language.',
        recommended_fix: 'Replace unresolved markers with concrete evidence, owner, or documented exemption.'
      }, mode, 'static', findings.length));
    }
  }
  return findings;
}

function staticReviewFindings(cwd, mode, featureId) {
  const repo = analyzeRepository(cwd);
  const findings = [];
  if (mode === 'security') {
    const security = readManagedJson(cwd, 'security/latest.json', null);
    if (security) {
      for (const item of security.findings || []) {
        findings.push(normalizeFinding(item, mode, 'static-security-check', findings.length));
      }
    } else {
      findings.push(normalizeFinding({
        id: 'security-check-missing',
        severity: 'medium',
        file_or_artifact: '.terrace/security/latest.json',
        claim: 'Security review has no current security check artifact.',
        evidence: 'No .terrace/security/latest.json file was found.',
        recommended_fix: 'Run terrace security check before completing security review.'
      }, mode, 'static', findings.length));
    }
  }
  if (mode === 'test-trust' && repo.test_files.length === 0) {
    findings.push(normalizeFinding({
      id: 'test-files-missing',
      severity: 'high',
      file_or_artifact: 'tests',
      claim: 'No test files were found for test-trust review.',
      evidence: 'Repository analysis found zero test files.',
      recommended_fix: 'Add behavior-focused tests or document why the project cannot run tests.'
    }, mode, 'static', findings.length));
  }
  if (mode === 'architecture' && repo.source_files.length > 0 && repo.docs_files.length === 0) {
    findings.push(normalizeFinding({
      id: 'architecture-docs-missing',
      severity: 'medium',
      file_or_artifact: 'docs',
      claim: 'Architecture review has source files but no documentation artifacts.',
      evidence: 'Repository analysis found source files without docs.',
      recommended_fix: 'Run terrace map-codebase and terrace design for the feature.'
    }, mode, 'static', findings.length));
  }
  findings.push(...artifactTodoFindings(cwd, featureId, mode));
  if (findings.length === 0) {
    findings.push(normalizeFinding({
      id: 'review-no-blockers',
      severity: 'info',
      file_or_artifact: 'repository',
      claim: 'Deterministic review found no blocking issues for this mode.',
      evidence: 'Repository and Terrace artifacts were scanned with local heuristics.',
      recommended_fix: 'Keep review artifact with the release evidence.'
    }, mode, 'static', 0));
  }
  return findings;
}

module.exports = {
  normalizeImportedFindings,
  normalizeFinding,
  staticReviewFindings
};
