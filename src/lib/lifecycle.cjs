'use strict';

const LEGAL_TRANSITIONS = {
  intake: ['interrogation'],
  interrogation: ['spec-compilation', 'intake'],
  'spec-compilation': ['test-architecture', 'interrogation'],
  'test-architecture': ['baseline-protection', 'spec-compilation'],
  'baseline-protection': ['implementation', 'test-architecture'],
  implementation: ['adversarial-review', 'baseline-protection'],
  'adversarial-review': ['regression-capture', 'implementation'],
  'regression-capture': ['handoff', 'adversarial-review'],
  handoff: ['intake']
};

function isLegalTransition(fromPhase, toPhase) {
  const allowed = LEGAL_TRANSITIONS[fromPhase] || [];
  return allowed.includes(toPhase);
}

function setPhase(state, newPhase) {
  const current = String(state.phase);
  if (!isLegalTransition(current, newPhase)) {
    throw new Error('Illegal phase transition: ' + current + ' -> ' + newPhase);
  }

  return { ...state, phase: newPhase };
}

module.exports = {
  LEGAL_TRANSITIONS,
  isLegalTransition,
  setPhase
};
