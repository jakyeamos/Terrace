'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { computeSpecHash } = require('./hash.cjs');
const { evaluatePolicy } = require('./policy.cjs');
const { appendManagedText, readManagedText, writeManagedText } = require('./managed-artifacts.cjs');

function sessionPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'sessions', 'SESSION.md');
}

function currentSpecHash(cwd) {
  const specPath = path.resolve(cwd, 'docs', 'spec', 'COMPILED-SPEC.md');
  return fs.existsSync(specPath) ? computeSpecHash(fs.readFileSync(specPath, 'utf8')) : null;
}

function startSession(cwd, options) {
  const opts = options || {};
  const state = loadState(cwd);
  const specHash = currentSpecHash(cwd);
  const policy = evaluatePolicy(cwd);
  const filePath = sessionPathFor(cwd);
  const previousHash = state.spec_hash || null;
  const drift = previousHash && specHash && previousHash !== specHash;
  const session = {
    started_at: new Date().toISOString(),
    active_slice: opts.activeSlice || (state.active_slice && state.active_slice.id) || null,
    policy_mode: policy.mode,
    spec_hash: specHash,
    spec_hash_alert: drift ? 'changed' : 'none'
  };

  const content = [
    '# Terrace Session',
    '',
    'started_at: ' + session.started_at,
    'workflow_status: ' + state.workflow.status,
    'active_slice: ' + (session.active_slice || 'unspecified'),
    'policy_mode: ' + session.policy_mode,
    'spec_hash: ' + (specHash || 'null'),
    'spec_hash_alert: ' + session.spec_hash_alert,
    '',
    '## Warnings',
    ...(policy.warnings.length > 0 ? policy.warnings.map((warning) => '- ' + warning) : ['- none']),
    '',
    '## Handoff',
    '- pending'
  ].join('\n') + '\n';
  writeManagedText(cwd, 'sessions/SESSION.md', content);

  saveState(cwd, {
    ...state,
    spec_hash: specHash,
    sessions: [...(state.sessions || []), session]
  });

  return { file: filePath, spec_hash: specHash, spec_hash_alert: session.spec_hash_alert };
}

function endSession(cwd, options) {
  const opts = options || {};
  const filePath = sessionPathFor(cwd);
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
  appendManagedText(cwd, 'sessions/SESSION.md', lines.join('\n') + '\n');
  return { file: filePath };
}

function reconstructSession(cwd) {
  const state = loadState(cwd);
  const filePath = sessionPathFor(cwd);
  return {
    workflow_status: state.workflow.status,
    active_slice: state.active_slice || null,
    policy_mode: state.workflow.mode || 'strict',
    spec_hash: currentSpecHash(cwd),
    last_session: readManagedText(cwd, 'sessions/SESSION.md') || ''
  };
}

module.exports = {
  currentSpecHash,
  startSession,
  endSession,
  reconstructSession
};
