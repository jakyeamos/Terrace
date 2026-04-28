'use strict';

const fs = require('fs');
const path = require('path');
const { computeSpecHash } = require('./spec-hash.cjs');
const { readJson, writeJson } = require('./core.cjs');
const { evaluatePolicy } = require('./policy.cjs');

function sessionPathFor(cwd) {
  return path.resolve(cwd, '.planning', 'sessions', 'SESSION.md');
}

function statePathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'project-state.json');
}

function currentSpecHash(cwd) {
  const specPath = path.resolve(cwd, 'docs', 'spec', 'COMPILED-SPEC.md');
  return fs.existsSync(specPath) ? computeSpecHash(fs.readFileSync(specPath, 'utf8')) : null;
}

function startSession(cwd, options) {
  const opts = options || {};
  const statePath = statePathFor(cwd);
  const state = readJson(statePath, {});
  const specHash = currentSpecHash(cwd);
  const policy = evaluatePolicy(cwd);
  const filePath = sessionPathFor(cwd);
  const previousHash = state.spec_hash || null;
  const drift = previousHash && specHash && previousHash !== specHash;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = [
    '# Terrace Session',
    '',
    'started_at: ' + new Date().toISOString(),
    'current_phase: ' + (state.phase || 'intake'),
    'active_slice: ' + (opts.activeSlice || state.active_slice || 'unspecified'),
    'policy_mode: ' + policy.mode,
    'spec_hash: ' + (specHash || 'null'),
    'spec_hash_alert: ' + (drift ? 'changed' : 'none'),
    '',
    '## Warnings',
    ...(policy.warnings.length > 0 ? policy.warnings.map((warning) => '- ' + warning) : ['- none']),
    '',
    '## Handoff',
    '- pending'
  ].join('\n') + '\n';

  fs.writeFileSync(filePath, content, 'utf8');
  writeJson(statePath, {
    ...state,
    spec_hash: specHash,
    active_slice: opts.activeSlice || state.active_slice || null,
    last_session: new Date().toISOString(),
    policy_mode: policy.mode
  });

  return { file: filePath, spec_hash: specHash, spec_hash_alert: drift ? 'changed' : 'none' };
}

function endSession(cwd, options) {
  const opts = options || {};
  const filePath = sessionPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = [
    '',
    '## Session End',
    'ended_at: ' + new Date().toISOString(),
    'decisions:',
    ...((opts.decisions || []).map((item) => '- ' + item)),
    'files_changed:',
    ...((opts.filesChanged || opts.files_changed || []).map((item) => '- ' + item)),
    'next_slice: ' + (opts.nextSlice || opts.next_slice || 'unspecified')
  ];
  fs.appendFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return { file: filePath };
}

function reconstructSession(cwd) {
  const state = readJson(statePathFor(cwd), {});
  const filePath = sessionPathFor(cwd);
  return {
    current_phase: state.phase || 'intake',
    active_slice: state.active_slice || null,
    policy_mode: state.policy_mode || 'standard',
    spec_hash: currentSpecHash(cwd),
    last_session: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  };
}

module.exports = {
  startSession,
  endSession,
  reconstructSession
};
