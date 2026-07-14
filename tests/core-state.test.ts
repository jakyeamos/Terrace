import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  assertLegalTransition,
  transitionState,
  loadState,
  saveState,
  replaceState
} = require('../packages/terrace-core/src/index.cjs');

function expectStateError(action: () => void, code: string): void {
  let thrown: { details?: { code?: string } } | null = null;
  try {
    action();
  } catch (error) {
    thrown = error as { details?: { code?: string } };
  }
  expect(thrown).not.toBeNull();
  expect(thrown?.details?.code).toBe(code);
}

function legacyStrictCoreState(): Record<string, unknown> {
  return {
    schema_version: '1.0',
    project: { name: 'legacy-demo', created_at: '2026-04-28T00:00:00.000Z' },
    workflow: { status: 'initialized', mode: 'strict', active_feature: null },
    roadmap: { phases: [] },
    active_slice: null,
    red_gate: { status: 'not_started', evidence: [] },
    green_gate: { status: 'not_started', evidence: [] },
    protected_tests: [],
    decisions: [],
    sessions: [],
    preserved_extension: { source: 'legacy-user-data' }
  };
}

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
    expect(state.schema_version).toBe('1.1');
    expect(state.state_revision).toBe(0);
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
    expect(loaded.state_revision).toBe(0);
  });

  it('persists a frozen input without reporting a post-commit failure', () => {
    const frozen = Object.freeze(createDefaultState({ projectName: 'frozen-demo' }));

    expect(() => saveState(tmpDir, frozen)).not.toThrow();
    expect(loadState(tmpDir)).toMatchObject({
      project: { name: 'frozen-demo' },
      state_revision: 0
    });
  });

  it('reads a historical 1.0 state without writing, then persists it as canonical 1.1 on the next mutation', () => {
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const legacyText = JSON.stringify(legacyStrictCoreState(), null, 2) + '\n';
    fs.writeFileSync(statePath, legacyText, 'utf8');

    const loaded = loadState(tmpDir);
    expect(loaded).toMatchObject({
      schema_version: '1.1',
      state_revision: 0,
      migration: null,
      handoff: null,
      backlog: { items: [] },
      blocked_actions: [],
      quick_tasks: [],
      preserved_extension: { source: 'legacy-user-data' }
    });
    expect(fs.readFileSync(statePath, 'utf8')).toBe(legacyText);

    saveState(tmpDir, {
      ...loaded,
      decisions: [{ id: 'migrated-decision', title: 'Persist canonical state' }]
    });

    expect(JSON.parse(fs.readFileSync(statePath, 'utf8'))).toMatchObject({
      schema_version: '1.1',
      state_revision: 1,
      decisions: [{ id: 'migrated-decision', title: 'Persist canonical state' }],
      preserved_extension: { source: 'legacy-user-data' }
    });
  });

  it('rejects malformed state JSON without changing the persisted bytes', () => {
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const invalidText = '{not valid JSON\n';
    fs.writeFileSync(statePath, invalidText, 'utf8');

    expectStateError(() => loadState(tmpDir), 'STATE_JSON_INVALID');
    expect(fs.readFileSync(statePath, 'utf8')).toBe(invalidText);
  });

  it('rejects invalid canonical state and unsupported future versions without fallback', () => {
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const invalidState = createDefaultState({ projectName: 'demo' });
    invalidState.workflow.status = 'not-a-real-status';
    const invalidText = JSON.stringify(invalidState, null, 2) + '\n';
    fs.writeFileSync(statePath, invalidText, 'utf8');

    expectStateError(() => loadState(tmpDir), 'STATE_SCHEMA_INVALID');
    expect(fs.readFileSync(statePath, 'utf8')).toBe(invalidText);

    const futureState = createDefaultState({ projectName: 'demo' });
    futureState.schema_version = '2.0';
    const futureText = JSON.stringify(futureState, null, 2) + '\n';
    fs.writeFileSync(statePath, futureText, 'utf8');

    expectStateError(() => loadState(tmpDir), 'STATE_VERSION_UNSUPPORTED');
    expect(fs.readFileSync(statePath, 'utf8')).toBe(futureText);
  });

  it('rejects a stale read-modify-write copy and preserves the first writer state', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const first = loadState(tmpDir);
    const stale = loadState(tmpDir);

    saveState(tmpDir, {
      ...first,
      decisions: [{ id: 'first-writer', title: 'First writer wins' }]
    });
    const firstWriterText = fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8');

    expectStateError(() => saveState(tmpDir, {
      ...stale,
      decisions: [{ id: 'stale-writer', title: 'This write must not win' }]
    }), 'STATE_REVISION_CONFLICT');

    expect(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8')).toBe(firstWriterText);
    expect(loadState(tmpDir).decisions).toEqual([{ id: 'first-writer', title: 'First writer wins' }]);
  });

  it('fails closed when another process owns the state lock', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const lockPath = path.join(tmpDir, '.terrace', 'state.lock');
    const before = fs.readFileSync(statePath, 'utf8');
    const lockText = JSON.stringify({ pid: process.pid, created_at: '2026-07-13T00:00:00.000Z' }) + '\n';
    fs.writeFileSync(lockPath, lockText, 'utf8');

    const loaded = loadState(tmpDir);
    expectStateError(() => saveState(tmpDir, loaded), 'STATE_WRITE_LOCKED');

    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
    expect(fs.readFileSync(lockPath, 'utf8')).toBe(lockText);
  });

  it('reclaims a lock only when its recorded process is confirmed dead', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const lockPath = path.join(tmpDir, '.terrace', 'state.lock');
    const recoveryPath = path.join(tmpDir, '.terrace', 'state.lock.recovery');
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 4312, created_at: '2026-07-13T00:00:00.000Z' }) + '\n', 'utf8');
    const processKill = vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = Object.assign(new Error('no such process'), { code: 'ESRCH' });
      throw error;
    });

    try {
      const state = loadState(tmpDir);
      saveState(tmpDir, {
        ...state,
        decisions: [{ id: 'reclaimed-lock', title: 'Recovered safely' }]
      });
    } finally {
      processKill.mockRestore();
    }

    expect(loadState(tmpDir).decisions).toEqual([{ id: 'reclaimed-lock', title: 'Recovered safely' }]);
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(fs.existsSync(recoveryPath)).toBe(false);
  });

  it('fails closed while another process owns the stale-lock recovery claim', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const recoveryPath = path.join(tmpDir, '.terrace', 'state.lock.recovery');
    const before = fs.readFileSync(statePath, 'utf8');
    const recoveryText = JSON.stringify({ pid: process.pid, created_at: '2026-07-13T00:00:00.000Z' }) + '\n';
    fs.writeFileSync(recoveryPath, recoveryText, 'utf8');

    expectStateError(() => saveState(tmpDir, loadState(tmpDir)), 'STATE_WRITE_LOCKED');

    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
    expect(fs.readFileSync(recoveryPath, 'utf8')).toBe(recoveryText);
  });

  it('keeps the last valid state and removes its temporary file when atomic rename fails', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const before = fs.readFileSync(statePath, 'utf8');
    const loaded = loadState(tmpDir);
    const mutableFs = require('fs') as typeof fs;
    const renameFailure = vi.spyOn(mutableFs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('simulated atomic rename failure');
    });

    try {
      expect(() => saveState(tmpDir, {
        ...loaded,
        decisions: [{ id: 'rename-failure', title: 'Keep old bytes' }]
      })).toThrow('simulated atomic rename failure');
    } finally {
      renameFailure.mockRestore();
    }

    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
    expect(loadState(tmpDir).decisions).toEqual([]);
    expect(fs.readdirSync(path.dirname(statePath)).filter((entry) => entry.startsWith('.state.json.'))).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.lock'))).toBe(false);
  });

  it('refuses symlinked Terrace state paths without touching the external target', () => {
    const externalPath = path.join(tmpDir, 'external-state.json');
    const sentinel = '{"outside":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    const terraceDir = path.join(tmpDir, '.terrace');
    fs.mkdirSync(terraceDir, { recursive: true });
    fs.symlinkSync(externalPath, path.join(terraceDir, 'state.json'));

    expectStateError(() => loadState(tmpDir), 'STATE_PATH_UNSAFE');
    expectStateError(() => saveState(tmpDir, createDefaultState({ projectName: 'demo' })), 'STATE_PATH_UNSAFE');

    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('refuses a symlinked .terrace directory before creating or replacing state', () => {
    const externalDirectory = path.join(tmpDir, 'external-terrace');
    fs.mkdirSync(externalDirectory, { recursive: true });
    fs.symlinkSync(externalDirectory, path.join(tmpDir, '.terrace'));

    expectStateError(() => saveState(tmpDir, createDefaultState({ projectName: 'demo' })), 'STATE_PATH_UNSAFE');

    expect(fs.readdirSync(externalDirectory)).toEqual([]);
  });

  it('uses explicit replacement to recover an invalid state without accepting an untracked overwrite', () => {
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, '{invalid state\n', 'utf8');

    expectStateError(() => saveState(tmpDir, createDefaultState({ projectName: 'demo' })), 'STATE_JSON_INVALID');
    replaceState(tmpDir, createDefaultState({ projectName: 'demo' }));

    expect(loadState(tmpDir)).toMatchObject({
      schema_version: '1.1',
      state_revision: 1,
      project: { name: 'demo' }
    });
  });
});
