'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { appendEvent } = require('./events.cjs');

function decisionLogPathFor(cwd) {
  return path.resolve(cwd, 'docs', 'spec', 'DECISION-LOG.md');
}

function addDecision(cwd, options) {
  const opts = options || {};
  const specRef = opts.specRef || opts.spec_ref;
  if (!specRef) {
    throw new Error('decision log requires --spec-ref');
  }

  const id = opts.id || 'D-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const decision = {
    decision_id: id,
    date: new Date().toISOString().slice(0, 10),
    author: opts.author || 'terrace',
    spec_ref: specRef,
    change_type: opts.changeType || opts.change_type || 'update',
    rationale: opts.rationale || 'Recorded governance decision.',
    impact: opts.impact || 'protected baseline alignment',
    status: opts.status || 'active'
  };

  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    decisions: [...(state.decisions || []), decision]
  });

  const filePath = decisionLogPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const entry = [
    '',
    '---',
    'decision_id: ' + decision.decision_id,
    'date: ' + decision.date,
    'author: ' + decision.author,
    'spec_ref: ' + decision.spec_ref,
    'change_type: ' + decision.change_type,
    'rationale: ' + decision.rationale,
    'impact: ' + decision.impact,
    'status: ' + decision.status,
    '---',
    ''
  ].join('\n');
  fs.appendFileSync(filePath, entry, 'utf8');

  appendEvent(cwd, {
    command: 'terrace decision log',
    from_state: state.workflow.status,
    to_state: state.workflow.status,
    evidence_refs: ['.terrace/state.json', 'docs/spec/DECISION-LOG.md']
  });

  return { file: filePath, decision_id: id, spec_ref: specRef };
}

function hasDecisionForSpec(cwd, specRef) {
  const state = loadState(cwd);
  if ((state.decisions || []).some((decision) => decision.spec_ref === specRef)) {
    return true;
  }

  const candidates = [
    path.resolve(cwd, 'docs', 'spec', 'DECISION-LOG.md'),
    path.resolve(cwd, 'docs', 'DECISION-LOG.md')
  ];
  return candidates.some((filePath) => {
    return fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8').includes('spec_ref: ' + specRef);
  });
}

module.exports = {
  addDecision,
  hasDecisionForSpec
};
