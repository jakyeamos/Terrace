import { describe, it, expect } from 'vitest';

const { LEGAL_TRANSITIONS, assertLegalTransition, transitionState } = require('../packages/terrace-core/src/index.cjs');

describe('Strict core workflow transitions', () => {
  const baseState = {
    workflow: { status: 'initialized', mode: 'strict', active_feature: null },
    project: { name: 'test' },
    roadmap: { phases: [] },
    active_slice: null,
    red_gate: { status: 'not_started', evidence: [] },
    green_gate: { status: 'not_started', evidence: [] },
    protected_tests: [],
    decisions: [],
    sessions: []
  };

  it('allows legal transition: initialized -> intake_recorded', () => {
    expect(LEGAL_TRANSITIONS.initialized).toContain('intake_recorded');
  });

  it('allows legal transition: intake_recorded -> interrogated', () => {
    expect(LEGAL_TRANSITIONS.intake_recorded).toContain('interrogated');
  });

  it('allows legal transition: interrogated -> spec_compiled', () => {
    expect(LEGAL_TRANSITIONS.interrogated).toContain('spec_compiled');
  });

  it('allows legal transition: spec_compiled -> roadmap_ready', () => {
    expect(LEGAL_TRANSITIONS.spec_compiled).toContain('roadmap_ready');
  });

  it('allows legal transition: handoff_ready -> roadmap_ready', () => {
    expect(LEGAL_TRANSITIONS.handoff_ready).toContain('roadmap_ready');
  });

  it('blocks illegal transition: initialized -> implementation_allowed', () => {
    expect(() => assertLegalTransition('initialized', 'implementation_allowed')).toThrow('initialized');
  });

  it('blocks illegal transition: handoff_ready -> green_required', () => {
    expect(() => assertLegalTransition('handoff_ready', 'green_required')).toThrow('handoff_ready');
  });

  it('blocks illegal transition: initialized -> initialized (no self-transition)', () => {
    expect(() => assertLegalTransition('initialized', 'initialized')).toThrow('initialized');
  });

  it('transitionState returns updated state with new workflow status', () => {
    const next = transitionState(baseState, 'intake_recorded');
    expect(next.workflow.status).toBe('intake_recorded');
  });

  it('transitionState preserves workflow mode when updating status', () => {
    const next = transitionState(baseState, 'intake_recorded');
    expect(next.workflow.mode).toBe('strict');
  });
});
