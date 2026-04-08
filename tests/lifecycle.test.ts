import { describe, it, expect } from 'vitest';

const { isLegalTransition, setPhase } = require('../src/lib/lifecycle.cjs');

type ProjectState = {
  phase: string;
  spec_hash: null;
  active_slice: null;
  last_session: null;
  policy_mode: string;
};

describe('Phase lifecycle transitions (LIFE-01 through LIFE-06, CLI-09)', () => {
  const baseState: ProjectState = { phase: 'intake', spec_hash: null, active_slice: null, last_session: null, policy_mode: 'standard' };

  it('allows legal transition: intake -> interrogation', () => {
    expect(isLegalTransition('intake', 'interrogation')).toBe(true);
  });

  it('allows legal transition: interrogation -> spec-compilation', () => {
    expect(isLegalTransition('interrogation', 'spec-compilation')).toBe(true);
  });

  it('allows legal backward transition: interrogation -> intake', () => {
    expect(isLegalTransition('interrogation', 'intake')).toBe(true);
  });

  it('allows legal transition: spec-compilation -> test-architecture', () => {
    expect(isLegalTransition('spec-compilation', 'test-architecture')).toBe(true);
  });

  it('allows legal transition: handoff -> intake', () => {
    expect(isLegalTransition('handoff', 'intake')).toBe(true);
  });

  it('blocks illegal transition: intake -> implementation', () => {
    expect(isLegalTransition('intake', 'implementation')).toBe(false);
  });

  it('blocks illegal transition: handoff -> adversarial-review', () => {
    expect(isLegalTransition('handoff', 'adversarial-review')).toBe(false);
  });

  it('blocks illegal transition: intake -> intake (no self-transition)', () => {
    expect(isLegalTransition('intake', 'intake')).toBe(false);
  });

  it('setPhase throws on illegal transition with a message containing from and to phase names', () => {
    expect(() => setPhase({ ...baseState, phase: 'intake' }, 'implementation')).toThrow('intake');
  });

  it('setPhase returns updated state with new phase on legal transition', () => {
    const next = setPhase({ ...baseState, phase: 'intake' }, 'interrogation');
    expect(next.phase).toBe('interrogation');
  });

  it('setPhase preserves all other state fields when updating phase', () => {
    const state = { ...baseState, phase: 'intake', spec_hash: null, policy_mode: 'strict' } as ProjectState;
    const next = setPhase(state, 'interrogation');
    expect(next.policy_mode).toBe('strict');
  });
});
