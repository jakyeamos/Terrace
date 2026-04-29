'use strict';

const fs = require('fs');
const path = require('path');

const LEGAL_TRANSITIONS = {
  uninitialized: ['initialized'],
  initialized: ['intake_recorded'],
  intake_recorded: ['interrogated'],
  interrogated: ['spec_compiled'],
  spec_compiled: ['roadmap_ready'],
  roadmap_ready: ['slice_planned'],
  slice_planned: ['red_required'],
  red_required: ['implementation_allowed'],
  implementation_allowed: ['green_required'],
  green_required: ['protected'],
  protected: ['handoff_ready'],
  handoff_ready: ['roadmap_ready']
};

function createDefaultState(options) {
  const opts = options || {};
  return {
    schema_version: '1.0',
    project: {
      name: opts.projectName || 'untitled',
      created_at: new Date().toISOString()
    },
    workflow: {
      status: 'initialized',
      mode: 'strict',
      active_feature: null
    },
    roadmap: {
      phases: []
    },
    active_slice: null,
    red_gate: {
      status: 'not_started',
      evidence: []
    },
    green_gate: {
      status: 'not_started',
      evidence: []
    },
    protected_tests: [],
    decisions: [],
    sessions: [],
    migration: null,
    handoff: null,
    handoffs: [],
    workstreams: {},
    design_sources: {},
    preflights: {},
    ai_reviews: [],
    debt: [],
    documentation: {},
    test_evaluations: [],
    rule_audits: [],
    waivers: [],
    backfills: [],
    report_card: {},
    backlog: {
      items: []
    },
    blocked_actions: [],
    quick_tasks: []
  };
}

function statePathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'state.json');
}

function assertLegalTransition(fromStatus, toStatus) {
  const allowed = LEGAL_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error('Illegal transition: ' + fromStatus + ' -> ' + toStatus);
  }
}

function transitionState(state, toStatus) {
  assertLegalTransition(state.workflow.status, toStatus);
  return {
    ...state,
    workflow: {
      ...state.workflow,
      status: toStatus
    }
  };
}

function saveState(cwd, state) {
  const filePath = statePathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return filePath;
}

function loadState(cwd) {
  const filePath = statePathFor(cwd);
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing .terrace/state.json. Run `terrace init` first.');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  LEGAL_TRANSITIONS,
  createDefaultState,
  assertLegalTransition,
  transitionState,
  saveState,
  loadState
};
