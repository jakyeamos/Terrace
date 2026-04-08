'use strict';

const fs = require('fs');
const path = require('path');
const {
  ensureAllowedWrite,
  readTemplate,
  writeJson
} = require('./core.cjs');

const TEMPLATE_TARGETS = [
  ['PRD.md', 'docs/prd/PRD.md'],
  ['COMPILED-SPEC.md', 'docs/spec/COMPILED-SPEC.md'],
  ['TEST-ARCH.md', 'docs/testing/TEST-ARCH.md'],
  ['DECISION-LOG.md', 'docs/spec/DECISION-LOG.md'],
  ['SESSION.md', 'docs/spec/SESSION.md'],
  ['INVARIANTS.md', 'docs/spec/INVARIANTS.md'],
  ['ACCEPTANCE-CRITERIA.md', 'docs/spec/ACCEPTANCE-CRITERIA.md'],
  ['PERMISSIONS-MATRIX.md', 'docs/spec/PERMISSIONS-MATRIX.md'],
  ['EDGE-CASES.md', 'docs/spec/EDGE-CASES.md'],
  ['STATE-MACHINES.md', 'docs/spec/STATE-MACHINES.md'],
  ['REGRESSIONS.md', 'docs/spec/REGRESSIONS.md'],
  ['steering.md', '.terrace/steering.md']
];

function writeManifestFile(cwd, relPath, content, force) {
  const target = ensureAllowedWrite(cwd, path.resolve(cwd, relPath));
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    if (force) {
      fs.writeFileSync(target, content, 'utf8');
      return { file: target, action: 'overwritten' };
    }
    return { file: target, action: 'skipped' };
  }

  fs.writeFileSync(target, content, 'utf8');
  return { file: target, action: 'created' };
}

function writeManifestJson(cwd, relPath, value, force) {
  const target = ensureAllowedWrite(cwd, path.resolve(cwd, relPath));
  const existed = fs.existsSync(target);

  if (existed && !force) {
    return { file: target, action: 'skipped' };
  }

  writeJson(target, value);
  return { file: target, action: existed && force ? 'overwritten' : 'created' };
}

function cmdInit(cwd, options) {
  const opts = options || {};
  const force = Boolean(opts.force);
  const manifest = [];

  manifest.push(writeManifestJson(cwd, '.terrace/project-state.json', {
    phase: 'intake',
    spec_hash: null,
    active_slice: null,
    last_session: null,
    policy_mode: 'standard'
  }, force));

  manifest.push(writeManifestJson(cwd, '.terrace/presets/registry.json', {
    version: '1.0',
    presets: []
  }, force));

  manifest.push(writeManifestJson(cwd, '.terrace/policy.json', {}, force));

  manifest.push(writeManifestFile(cwd, 'docs/prd/.gitkeep', '', force));
  manifest.push(writeManifestFile(cwd, 'docs/spec/.gitkeep', '', force));
  manifest.push(writeManifestFile(cwd, 'docs/testing/.gitkeep', '', force));

  for (const [templateName, targetPath] of TEMPLATE_TARGETS) {
    manifest.push(writeManifestFile(cwd, targetPath, readTemplate(templateName), force));
  }

  return manifest;
}

module.exports = {
  cmdInit
};
