'use strict';

const fs = require('fs');
const path = require('path');
const { readJson, writeJson } = require('./core.cjs');

function registryPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'baseline-registry.json');
}

function readRegistry(cwd) {
  const registry = readJson(registryPathFor(cwd), { version: '1.0', entries: [] });
  if (!Array.isArray(registry.entries)) {
    registry.entries = [];
  }
  return registry;
}

function normalizeFile(filePath) {
  return filePath.split(path.sep).join('/');
}

function protectBaseline(cwd, filePath, specRef, options) {
  if (!specRef || !String(specRef).trim()) {
    throw new Error('baseline protect requires spec_ref');
  }

  const opts = options || {};
  const registry = readRegistry(cwd);
  const relFile = normalizeFile(path.relative(cwd, path.resolve(cwd, filePath)));
  const now = new Date().toISOString();
  const existingIndex = registry.entries.findIndex((entry) => entry.file === relFile);
  const entry = {
    file: relFile,
    spec_ref: String(specRef),
    locked_at: now,
    policy_flags: opts.policy_flags || ['protected'],
    severity: opts.severity || null
  };

  if (existingIndex >= 0) {
    registry.entries[existingIndex] = { ...registry.entries[existingIndex], ...entry };
  } else {
    registry.entries.push(entry);
  }

  writeJson(registryPathFor(cwd), registry);
  return entry;
}

function extractRequirements(testArchContent) {
  const matches = testArchContent.match(/\b(?:req_id|spec_ref)\s*:\s*([A-Z]+-\d+)/g) || [];
  return Array.from(new Set(matches.map((match) => match.split(':')[1].trim())));
}

function baselineStatus(cwd) {
  const registry = readRegistry(cwd);
  const missingFiles = [];
  const protectedWithoutSpecRef = [];
  const specToFiles = new Map();

  for (const entry of registry.entries) {
    if (!entry.spec_ref) {
      protectedWithoutSpecRef.push(entry);
    }
    if (!fs.existsSync(path.resolve(cwd, entry.file))) {
      missingFiles.push(entry);
    }
    if (entry.spec_ref) {
      const files = specToFiles.get(entry.spec_ref) || [];
      files.push(entry.file);
      specToFiles.set(entry.spec_ref, files);
    }
  }

  const testArchPath = path.resolve(cwd, 'docs', 'testing', 'TEST-ARCH.md');
  const requirements = fs.existsSync(testArchPath) ? extractRequirements(fs.readFileSync(testArchPath, 'utf8')) : [];
  const requirementsWithoutProtectedAnchor = requirements.filter((reqId) => !specToFiles.has(reqId));
  const conflicts = Array.from(specToFiles.entries())
    .filter(([, files]) => files.length > 1)
    .map(([spec_ref, files]) => ({ spec_ref, files }));

  return {
    entries: registry.entries,
    protected_without_spec_ref: protectedWithoutSpecRef,
    requirements_without_protected_anchor: requirementsWithoutProtectedAnchor,
    missing_files: missingFiles,
    conflicts,
    blocking: [
      ...missingFiles.map((entry) => ({
        code: 'MISSING_BASELINE_FILE',
        message: 'Protected baseline file is missing: ' + entry.file,
        file: entry.file
      })),
      ...protectedWithoutSpecRef.map((entry) => ({
        code: 'PROTECTED_WITHOUT_SPEC_REF',
        message: 'Protected baseline entry is missing spec_ref: ' + entry.file,
        file: entry.file
      }))
    ]
  };
}

function decisionLogHasSpecRef(cwd, specRef) {
  const candidates = [
    path.resolve(cwd, 'docs', 'spec', 'DECISION-LOG.md'),
    path.resolve(cwd, 'docs', 'DECISION-LOG.md')
  ];
  return candidates.some((filePath) => {
    return fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes('spec_ref: ' + specRef);
  });
}

function enforceProtectedChanges(cwd, changedFiles) {
  const registry = readRegistry(cwd);
  const changed = new Set((changedFiles || []).map((filePath) => normalizeFile(filePath)));
  const blocking = [];

  for (const entry of registry.entries) {
    if (!changed.has(entry.file)) {
      continue;
    }
    if (!decisionLogHasSpecRef(cwd, entry.spec_ref)) {
      blocking.push({
        code: 'PROTECTED_CHANGE_WITHOUT_DECISION',
        message: 'Protected file ' + entry.file + ' changed without DECISION-LOG.md entry for ' + entry.spec_ref,
        file: entry.file,
        spec_ref: entry.spec_ref,
        remediation: 'Run `terrace decision log --spec-ref ' + entry.spec_ref + '` before committing.'
      });
    }
  }

  return { blocking, warnings: [], allowed: blocking.length === 0 };
}

module.exports = {
  protectBaseline,
  baselineStatus,
  enforceProtectedChanges
};
