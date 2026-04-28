import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  assertLegalTransition,
  transitionState,
  loadState,
  saveState
} = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core state machine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a JSON-led default state with required top-level fields', () => {
    const state = createDefaultState({ projectName: 'demo' });
    expect(state.schema_version).toBe('1.0');
    expect(state.project.name).toBe('demo');
    expect(state.workflow.status).toBe('initialized');
    expect(state).toHaveProperty('roadmap');
    expect(state).toHaveProperty('active_slice');
    expect(state).toHaveProperty('red_gate');
    expect(state).toHaveProperty('green_gate');
    expect(state).toHaveProperty('protected_tests');
    expect(state).toHaveProperty('decisions');
    expect(state).toHaveProperty('sessions');
  });

  it('allows initialized -> intake_recorded', () => {
    expect(() => assertLegalTransition('initialized', 'intake_recorded')).not.toThrow();
  });

  it('rejects initialized -> implementation_allowed', () => {
    expect(() => assertLegalTransition('initialized', 'implementation_allowed')).toThrow('Illegal transition');
  });

  it('transitionState preserves state and changes workflow status', () => {
    const state = createDefaultState({ projectName: 'demo' });
    const next = transitionState(state, 'intake_recorded');
    expect(next.workflow.status).toBe('intake_recorded');
    expect(next.project.name).toBe('demo');
  });

  it('saves and loads .terrace/state.json', () => {
    const state = createDefaultState({ projectName: 'demo' });
    saveState(tmpDir, state);
    const loaded = loadState(tmpDir);
    expect(loaded.project.name).toBe('demo');
  });
});
