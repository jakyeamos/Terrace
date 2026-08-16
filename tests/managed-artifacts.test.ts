import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  addDecision,
  appendEvent,
  alignFeature,
  createDefaultState,
  importFeaturePrd,
  initCore,
  installAgentBootstrap,
  installPreset,
  migrateArtifacts,
  readConfig,
  readEvents,
  reportUpdate,
  ruleAdd,
  runDoctor,
  runSecurityCheck,
  saveState,
  writeConfig
} = require('../packages/terrace-core/src/index.cjs');

function expectGuidanceCode(action: () => void, code: string): void {
  let thrown: { details?: { code?: string } } | null = null;
  try {
    action();
  } catch (error) {
    thrown = error as { details?: { code?: string } };
  }
  expect(thrown?.details?.code).toBe(code);
}

function expectUnsafePath(action: () => void): void {
  expectGuidanceCode(action, 'MANAGED_ARTIFACT_PATH_UNSAFE');
}

describe('managed Terrace artifacts', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-managed-artifacts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('refuses a symlinked config file without modifying its external target', () => {
    const externalPath = path.join(tmpDir, 'outside-config.json');
    const sentinel = '{"outside":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'config.json'));

    expectUnsafePath(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } }));

    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('preflights ordinary init before it writes state when a managed leaf is unsafe', () => {
    const externalPath = path.join(tmpDir, 'outside-config.json');
    const sentinel = '{"outside":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'config.json'));

    expectUnsafePath(() => initCore(tmpDir, { projectName: 'demo' }));

    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('refuses a symlinked default rule before init writes any other managed artifact', () => {
    const externalPath = path.join(tmpDir, 'outside-rule.json');
    const sentinel = '{"outside":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace', 'rules'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'rules', 'security.json'));

    expectUnsafePath(() => initCore(tmpDir, { projectName: 'demo' }));

    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('preflights a symlinked agent manifest before ordinary init writes state', () => {
    const externalPath = path.join(tmpDir, 'outside-agent-manifest.json');
    const sentinel = '{"outside":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace', 'agents'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'agents', 'manifest.json'));

    expectUnsafePath(() => initCore(tmpDir, { projectName: 'demo' }));

    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('preflights a repo-local generated agent parent symlink before ordinary init writes state', () => {
    const externalDirectory = path.join(tmpDir, 'outside-agents');
    fs.mkdirSync(externalDirectory, { recursive: true });
    fs.symlinkSync(externalDirectory, path.join(tmpDir, '.agents'));

    expectGuidanceCode(() => initCore(tmpDir, { projectName: 'demo' }), 'AGENT_ASSET_PATH_UNSAFE');

    expect(fs.existsSync(path.join(tmpDir, '.terrace'))).toBe(false);
    expect(fs.readdirSync(externalDirectory)).toEqual([]);
  });

  it('refuses symlinked docs parents across generated project-artifact writers', () => {
    const cases = [
      { name: 'security check', run: (cwd: string) => runSecurityCheck(cwd) },
      { name: 'feature PRD import', run: (cwd: string) => importFeaturePrd(cwd, { feature: 'boundary', prdText: '# Boundary\n\n- Preserve containment.', source: { mode: 'paste' } }) },
      { name: 'feature alignment', run: (cwd: string) => alignFeature(cwd, 'boundary', {}) },
      { name: 'report update', run: (cwd: string) => reportUpdate(cwd, { command: 'boundary test' }) },
      { name: 'decision log', run: (cwd: string) => addDecision(cwd, { specRef: 'BOUNDARY-1' }) },
      { name: 'schema migration', run: (cwd: string) => migrateArtifacts(cwd, '1.0') }
    ];

    for (const testCase of cases) {
      const project = path.join(tmpDir, testCase.name.replace(/\s+/g, '-'));
      const outside = path.join(tmpDir, 'outside-' + testCase.name.replace(/\s+/g, '-'));
      fs.mkdirSync(project, { recursive: true });
      fs.mkdirSync(outside, { recursive: true });
      saveState(project, createDefaultState({ projectName: testCase.name }));
      fs.symlinkSync(outside, path.join(project, 'docs'));

      expectUnsafePath(() => testCase.run(project));

      expect(fs.readdirSync(outside)).toEqual([]);
      if (testCase.name === 'report update') {
        expect(fs.existsSync(path.join(project, '.terrace', 'report-card.json'))).toBe(false);
      }
      if (testCase.name === 'decision log') {
        expect(require('../packages/terrace-core/src/index.cjs').loadState(project).decisions).toEqual([]);
      }
    }
  });

  it('refuses a symlinked event ledger without modifying its external target', () => {
    const externalPath = path.join(tmpDir, 'outside-events.jsonl');
    const sentinel = '{"event_id":"outside"}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'events.jsonl'));

    expectUnsafePath(() => appendEvent(tmpDir, { command: 'terrace test', from_state: 'initialized', to_state: 'initialized' }));

    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('refuses a symlinked CLI steering artifact without modifying its external target', () => {
    const externalPath = path.join(tmpDir, 'outside-steering.md');
    const sentinel = 'outside steering\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.symlinkSync(externalPath, path.join(tmpDir, '.terrace', 'steering.md'));

    const result = spawnSync(process.execPath, [path.resolve(process.cwd(), 'src', 'terrace-tools.cjs'), 'steering', '--json'], {
      cwd: tmpDir,
      encoding: 'utf8'
    });

    expect(result.status).not.toBe(0);
    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
  });

  it('reports an unsafe .terrace directory as a doctor blocker', () => {
    const externalDirectory = path.join(tmpDir, 'outside-terrace');
    fs.mkdirSync(externalDirectory, { recursive: true });
    fs.symlinkSync(externalDirectory, path.join(tmpDir, '.terrace'));

    const result = runDoctor(tmpDir);

    expect(result.healthy).toBe(false);
    expect(result.blocking).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MANAGED_ARTIFACT_PATH_UNSAFE' })
    ]));
  });

  it('refuses a symlinked rules directory before custom rule authoring can escape the project', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const externalDirectory = path.join(tmpDir, 'outside-rules');
    fs.mkdirSync(externalDirectory, { recursive: true });
    fs.rmSync(path.join(tmpDir, '.terrace', 'rules'), { recursive: true, force: true });
    fs.symlinkSync(externalDirectory, path.join(tmpDir, '.terrace', 'rules'));

    expectUnsafePath(() => ruleAdd(tmpDir, 'security', 'must-not-escape'));

    expect(fs.readdirSync(externalDirectory)).toEqual([]);
  });

  it('preflights preset registry and policy before changing either one', () => {
    const registryPath = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    const registryText = '{\n  "version": "1.0",\n  "presets": []\n}\n';
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, registryText, 'utf8');
    fs.mkdirSync(path.join(tmpDir, '.terrace', 'policy.json'));

    expectUnsafePath(() => installPreset(tmpDir, {
      id: 'terrace-safe-preset',
      name: 'Safe preset',
      version: '1.0',
      category: 'testing',
      effect: 'Read+Write',
      agents: [],
      workflows: [],
      fragments: [],
      flags: [{ key: 'enabled', default: true }]
    }, { force: false }));

    expect(fs.readFileSync(registryPath, 'utf8')).toBe(registryText);
  });

  it('fails closed on a damaged preset registry instead of replacing it', () => {
    const registryPath = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    const damaged = '{not valid JSON\n';
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, damaged, 'utf8');
    let thrown: { details?: { code?: string } } | null = null;

    try {
      installPreset(tmpDir, {
        id: 'terrace-safe-preset',
        name: 'Safe preset',
        version: '1.0',
        category: 'testing',
        effect: 'Read+Write',
        agents: [],
        workflows: [],
        fragments: [],
        flags: []
      }, { force: false });
    } catch (error) {
      thrown = error as { details?: { code?: string } };
    }

    expect(thrown?.details?.code).toBe('MANAGED_ARTIFACT_JSON_INVALID');
    expect(fs.readFileSync(registryPath, 'utf8')).toBe(damaged);
  });

  it('repairs missing preset flags when a same-version install is retried', () => {
    const manifest = {
      id: 'terrace-safe-preset',
      name: 'Safe preset',
      version: '1.0',
      category: 'testing',
      effect: 'Read+Write',
      agents: [],
      workflows: [],
      fragments: [],
      flags: [{ key: 'enabled', default: true }]
    };
    installPreset(tmpDir, manifest, { force: false });
    fs.rmSync(path.join(tmpDir, '.terrace', 'policy.json'));

    const result = installPreset(tmpDir, manifest, { force: false });

    expect(result.message).toBe('Preset already installed: terrace-safe-preset');
    expect(JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'policy.json'), 'utf8'))).toMatchObject({
      'terrace-safe-preset': { enabled: true }
    });
  });

  it('rolls back a preset policy and registry together when the second artifact write fails', () => {
    const manifest = {
      id: 'terrace-transactional-preset',
      name: 'Transactional preset',
      version: '1.0',
      category: 'testing',
      effect: 'Read+Write',
      agents: [],
      workflows: [],
      fragments: [],
      flags: [{ key: 'enabled', default: true }]
    };
    const registryPath = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    const policyPath = path.join(tmpDir, '.terrace', 'policy.json');
    const registryBefore = '{\n  "version": "1.0",\n  "presets": []\n}\n';
    const policyBefore = '{\n  "existing": {\n    "enabled": false\n  }\n}\n';
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, registryBefore, 'utf8');
    fs.writeFileSync(policyPath, policyBefore, 'utf8');
    const mutableFs = require('fs') as typeof fs;
    const originalRenameSync = mutableFs.renameSync;
    let failed = false;
    const renameFailure = vi.spyOn(mutableFs, 'renameSync').mockImplementation(((oldPath, newPath) => {
      if (!failed && newPath === 'registry.json') {
        failed = true;
        throw new Error('simulated preset registry replacement failure');
      }
      return originalRenameSync(oldPath, newPath);
    }) as typeof fs.renameSync);

    try {
      expect(() => installPreset(tmpDir, manifest, { force: false })).toThrow('simulated preset registry replacement failure');
    } finally {
      renameFailure.mockRestore();
    }

    expect(fs.readFileSync(policyPath, 'utf8')).toBe(policyBefore);
    expect(fs.readFileSync(registryPath, 'utf8')).toBe(registryBefore);
    const transactionsDir = path.join(tmpDir, '.terrace', 'transactions');
    expect(fs.readdirSync(transactionsDir).filter((entry) => entry.endsWith('.json'))).toEqual([]);

    expect(installPreset(tmpDir, manifest, { force: false })).toMatchObject({ conflict: false });
    expect(JSON.parse(fs.readFileSync(policyPath, 'utf8'))).toMatchObject({
      'terrace-transactional-preset': { enabled: true }
    });
  });

  it('refuses to mutate a managed artifact while a live managed write lock exists', () => {
    const lockPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock');
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }) + '\n', 'utf8');

    expectGuidanceCode(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } }), 'MANAGED_ARTIFACT_WRITE_LOCKED');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'config.json'))).toBe(false);
  });

  it('makes versioned state mutations honor the managed reset lock', () => {
    const { createDefaultState, loadState, saveState } = require('../packages/terrace-core/src/index.cjs') as {
      createDefaultState: (options: { projectName: string }) => Record<string, unknown>;
      loadState: (cwd: string) => Record<string, unknown>;
      saveState: (cwd: string, state: Record<string, unknown>) => string;
    };
    saveState(tmpDir, createDefaultState({ projectName: 'lock-coordination' }));
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const before = fs.readFileSync(statePath, 'utf8');
    const lockPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock');
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }) + '\n', 'utf8');

    expectGuidanceCode(() => saveState(tmpDir, loadState(tmpDir)), 'MANAGED_ARTIFACT_WRITE_LOCKED');

    expect(fs.readFileSync(statePath, 'utf8')).toBe(before);
  });

  it('reclaims a managed artifact lock only after its recorded process is confirmed absent', () => {
    const lockPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock');
    const recoveryPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock.recovery');
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 4312, created_at: '2026-07-13T00:00:00.000Z' }) + '\n', 'utf8');
    const processKill = vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = Object.assign(new Error('no such process'), { code: 'ESRCH' });
      throw error;
    });

    try {
      writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } });
    } finally {
      processKill.mockRestore();
    }

    expect(readConfig(tmpDir)).toMatchObject({ execution_policy: { phase_effort_default: 'fast' } });
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(fs.existsSync(recoveryPath)).toBe(false);
  });

  it('cleans both managed lock markers when recovery handoff cleanup fails', () => {
    const lockPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock');
    const recoveryPath = path.join(tmpDir, '.terrace', 'locks', 'managed-artifacts.lock.recovery');
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 4312, created_at: '2026-07-13T00:00:00.000Z' }) + '\n', 'utf8');
    const mutableFs = require('fs') as typeof fs;
    const originalUnlinkSync = mutableFs.unlinkSync;
    const processKill = vi.spyOn(process, 'kill').mockImplementation(() => {
      const error = Object.assign(new Error('no such process'), { code: 'ESRCH' });
      throw error;
    });
    let failedRecoveryCleanup = false;
    const recoveryCleanupFailure = vi.spyOn(mutableFs, 'unlinkSync').mockImplementation(((filePath) => {
      if (!failedRecoveryCleanup && filePath === 'managed-artifacts.lock.recovery') {
        failedRecoveryCleanup = true;
        throw new Error('simulated managed recovery cleanup failure');
      }
      return originalUnlinkSync(filePath);
    }) as typeof fs.unlinkSync);

    try {
      expect(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } })).toThrow('simulated managed recovery cleanup failure');
    } finally {
      recoveryCleanupFailure.mockRestore();
      processKill.mockRestore();
    }

    expect(failedRecoveryCleanup).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(false);
    expect(fs.existsSync(recoveryPath)).toBe(false);
  });

  it('recovers a prepared managed transaction before the next mutation', () => {
    const { writeManagedJson } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      writeManagedJson: (cwd: string, relativePath: string, value: unknown) => string;
    };
    const policyPath = path.join(tmpDir, '.terrace', 'policy.json');
    const policyBefore = '{\n  "mode": "strict"\n}\n';
    const policyAfterCrash = '{\n  "mode": "recovery"\n}\n';
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(policyPath, policyBefore, 'utf8');
    writeManagedJson(tmpDir, 'transactions/preset-install-deadbeef.json', {
      kind: 'terrace-preset-install-transaction',
      status: 'prepared',
      created_at: '2026-07-13T00:00:00.000Z',
      entries: [{ relative_path: 'policy.json', before_text: policyBefore }]
    });
    fs.writeFileSync(policyPath, policyAfterCrash, 'utf8');

    writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'thorough' } });

    expect(fs.readFileSync(policyPath, 'utf8')).toBe(policyBefore);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'transactions', 'preset-install-deadbeef.json'))).toBe(false);
    expect(readConfig(tmpDir)).toMatchObject({ execution_policy: { phase_effort_default: 'thorough' } });
  });

  it('refuses a prepared transaction with a malformed snapshot before replaying it', () => {
    const { writeManagedJson } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      writeManagedJson: (cwd: string, relativePath: string, value: unknown) => string;
    };
    const policyPath = path.join(tmpDir, '.terrace', 'policy.json');
    const sentinel = '{\n  "mode": "must-keep"\n}\n';
    fs.mkdirSync(path.dirname(policyPath), { recursive: true });
    fs.writeFileSync(policyPath, sentinel, 'utf8');
    writeManagedJson(tmpDir, 'transactions/preset-install-deadbeef-cafe.json', {
      kind: 'terrace-preset-install-transaction',
      status: 'prepared',
      created_at: '2026-07-13T00:00:00.000Z',
      entries: [{ relative_path: 'policy.json', before_text: '{not valid JSON' }]
    });

    expectGuidanceCode(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } }), 'MANAGED_ARTIFACT_TRANSACTION_INVALID');

    expect(fs.readFileSync(policyPath, 'utf8')).toBe(sentinel);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'config.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'transactions', 'preset-install-deadbeef-cafe.json'))).toBe(true);
  });

  it('refuses an unexpected prepared transaction without replaying its target', () => {
    const { createDefaultState, loadState, saveState } = require('../packages/terrace-core/src/index.cjs') as {
      createDefaultState: (options: { projectName: string }) => Record<string, unknown>;
      loadState: (cwd: string) => Record<string, unknown>;
      saveState: (cwd: string, state: Record<string, unknown>) => string;
    };
    saveState(tmpDir, createDefaultState({ projectName: 'transaction-safety' }));
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const stateBefore = fs.readFileSync(statePath, 'utf8');
    const { writeManagedJson } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      writeManagedJson: (cwd: string, relativePath: string, value: unknown) => string;
    };
    writeManagedJson(tmpDir, 'transactions/preset-install-deadbeef-cafe.json', {
      kind: 'terrace-preset-install-transaction',
      status: 'prepared',
      created_at: '2026-07-13T00:00:00.000Z',
      entries: [{ relative_path: 'state.json', before_text: null }]
    });

    expectGuidanceCode(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } }), 'MANAGED_ARTIFACT_TRANSACTION_INVALID');

    expect(fs.readFileSync(statePath, 'utf8')).toBe(stateBefore);
    expect(loadState(tmpDir)).toMatchObject({ project: { name: 'transaction-safety' } });
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'config.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'transactions', 'preset-install-deadbeef-cafe.json'))).toBe(true);
  });

  it('keeps the previous config bytes and removes its temporary file when atomic replacement fails', () => {
    writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'standard' } });
    const configPath = path.join(tmpDir, '.terrace', 'config.json');
    const before = fs.readFileSync(configPath, 'utf8');
    const mutableFs = require('fs') as typeof fs;
    const renameFailure = vi.spyOn(mutableFs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('simulated managed artifact rename failure');
    });

    try {
      expect(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } })).toThrow('simulated managed artifact rename failure');
    } finally {
      renameFailure.mockRestore();
    }

    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
    expect(fs.readdirSync(path.dirname(configPath)).filter((entry) => entry.startsWith('.config.json.'))).toEqual([]);
    expect(readConfig(tmpDir)).toEqual({ execution_policy: { phase_effort_default: 'standard' } });
  });

  it('keeps an atomic config write pinned when .terrace is replaced after the temporary file is opened', () => {
    writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'standard' } });
    const terracePath = path.join(tmpDir, '.terrace');
    const pinnedPath = path.join(tmpDir, '.terrace-pinned');
    const outsidePath = path.join(tmpDir, 'outside-terrace');
    const sentinel = '{"outside":true}\n';
    const previousDirectory = process.cwd();
    const mutableFs = require('fs') as typeof fs;
    const originalOpenSync = mutableFs.openSync;
    let swapped = false;
    const swapDuringOpen = vi.spyOn(mutableFs, 'openSync').mockImplementation(((filePath, flags, mode) => {
      if (!swapped
        && typeof filePath === 'string'
        && filePath.startsWith('.config.json.')
        && filePath.endsWith('.tmp')
        && (Number(flags) & fs.constants.O_CREAT) !== 0) {
        swapped = true;
        fs.renameSync(terracePath, pinnedPath);
        fs.mkdirSync(outsidePath, { recursive: true });
        fs.writeFileSync(path.join(outsidePath, 'config.json'), sentinel, 'utf8');
        fs.symlinkSync(outsidePath, terracePath);
      }
      return originalOpenSync(filePath, flags, mode);
    }) as typeof fs.openSync);

    try {
      expectUnsafePath(() => writeConfig(tmpDir, { execution_policy: { phase_effort_default: 'fast' } }));
    } finally {
      swapDuringOpen.mockRestore();
    }

    expect(swapped).toBe(true);
    expect(process.cwd()).toBe(previousDirectory);
    expect(fs.readFileSync(path.join(outsidePath, 'config.json'), 'utf8')).toBe(sentinel);
    expect(JSON.parse(fs.readFileSync(path.join(pinnedPath, 'config.json'), 'utf8'))).toEqual({ execution_policy: { phase_effort_default: 'standard' } });
    expect(fs.readdirSync(pinnedPath).filter((entry) => entry.startsWith('.config.json.'))).toEqual([]);
  });

  it('restores the original project inode instead of a swapped root symlink', () => {
    const projectPath = path.join(tmpDir, 'cwd-project');
    const pinnedProjectPath = path.join(tmpDir, 'cwd-project-pinned');
    const outsidePath = path.join(tmpDir, 'cwd-outside');
    const previousDirectory = process.cwd();
    const mutableFs = require('fs') as typeof fs;
    const originalOpenSync = mutableFs.openSync;
    let swapped = false;
    fs.mkdirSync(projectPath, { recursive: true });
    process.chdir(projectPath);
    const swapDuringOpen = vi.spyOn(mutableFs, 'openSync').mockImplementation(((filePath, flags, mode) => {
      if (!swapped
        && typeof filePath === 'string'
        && filePath.startsWith('.config.json.')
        && filePath.endsWith('.tmp')
        && (Number(flags) & fs.constants.O_CREAT) !== 0) {
        swapped = true;
        fs.renameSync(projectPath, pinnedProjectPath);
        fs.mkdirSync(outsidePath, { recursive: true });
        fs.symlinkSync(outsidePath, projectPath);
      }
      return originalOpenSync(filePath, flags, mode);
    }) as typeof fs.openSync);

    try {
      expectUnsafePath(() => writeConfig(projectPath, { execution_policy: { phase_effort_default: 'fast' } }));
      expect(swapped).toBe(true);
      expect(fs.realpathSync(process.cwd())).toBe(fs.realpathSync(pinnedProjectPath));
      expect(fs.existsSync(path.join(outsidePath, '.terrace', 'config.json'))).toBe(false);
    } finally {
      swapDuringOpen.mockRestore();
      process.chdir(previousDirectory);
    }
  });

  it('rejects an ancestor alias that preserves the leaf directory inode', () => {
    const { writeManagedText } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      writeManagedText: (cwd: string, relativePath: string, text: string) => string;
    };
    const terracePath = path.join(tmpDir, '.terrace');
    const outsidePath = path.join(tmpDir, 'outside-terrace');
    fs.mkdirSync(path.join(terracePath, 'sessions'), { recursive: true });
    const mutableFs = require('fs') as typeof fs;
    const originalLstatSync = mutableFs.lstatSync;
    let swapped = false;
    const swapAfterSessionLookup = vi.spyOn(mutableFs, 'lstatSync').mockImplementation(((filePath, options) => {
      const stat = originalLstatSync(filePath, options);
      if (!swapped && filePath === 'sessions') {
        swapped = true;
        fs.renameSync(terracePath, outsidePath);
        fs.symlinkSync(outsidePath, terracePath);
      }
      return stat;
    }) as typeof fs.lstatSync);

    try {
      expectUnsafePath(() => writeManagedText(tmpDir, 'sessions/SESSION.md', 'must remain inside the project\n'));
    } finally {
      swapAfterSessionLookup.mockRestore();
    }

    expect(swapped).toBe(true);
    expect(fs.existsSync(path.join(outsidePath, 'sessions', 'SESSION.md'))).toBe(false);
  });

  it('shares a managed lock across a symlinked project alias', () => {
    const { withManagedArtifactLock, writeManagedText } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      withManagedArtifactLock: (cwd: string, action: () => void) => void;
      writeManagedText: (cwd: string, relativePath: string, text: string) => string;
    };
    const actualPath = path.join(tmpDir, 'actual-project');
    const aliasPath = path.join(tmpDir, 'project-alias');
    fs.mkdirSync(actualPath, { recursive: true });
    fs.symlinkSync(actualPath, aliasPath);

    expect(() => withManagedArtifactLock(aliasPath, () => {
      writeManagedText(actualPath, 'config.json', '{"via":"alias"}\n');
    })).not.toThrow();

    expect(fs.readFileSync(path.join(actualPath, '.terrace', 'config.json'), 'utf8')).toBe('{"via":"alias"}\n');
  });

  it('does not let a nested managed write rebind a swapped project root', () => {
    const { withManagedArtifactLock } = require('../packages/terrace-core/src/managed-artifacts.cjs') as {
      withManagedArtifactLock: (cwd: string, action: () => void) => void;
    };
    const projectPath = path.join(tmpDir, 'project');
    const pinnedProjectPath = path.join(tmpDir, 'project-pinned');
    const outsidePath = path.join(tmpDir, 'outside-project');
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(outsidePath, { recursive: true });

    expectUnsafePath(() => withManagedArtifactLock(projectPath, () => {
      fs.renameSync(projectPath, pinnedProjectPath);
      fs.symlinkSync(outsidePath, projectPath);
      writeConfig(projectPath, { execution_policy: { phase_effort_default: 'fast' } });
    }));

    expect(fs.existsSync(path.join(outsidePath, '.terrace', 'config.json'))).toBe(false);
    expect(fs.existsSync(path.join(pinnedProjectPath, '.terrace', 'config.json'))).toBe(false);
  });

  it('keeps agent bootstrap pinned when a generated skill directory is replaced during its write', () => {
    const agentDirectory = path.join(tmpDir, '.agents', 'skills', 'terrace-help');
    const pinnedDirectory = path.join(tmpDir, '.agents', 'skills', 'terrace-help-pinned');
    const outsideDirectory = path.join(tmpDir, 'outside-agent-skill');
    const sentinelPath = path.join(outsideDirectory, 'sentinel.txt');
    const previousDirectory = process.cwd();
    const mutableFs = require('fs') as typeof fs;
    const originalOpenSync = mutableFs.openSync;
    let swapped = false;
    const swapDuringOpen = vi.spyOn(mutableFs, 'openSync').mockImplementation(((filePath, flags, mode) => {
      if (!swapped
        && typeof filePath === 'string'
        && filePath.startsWith('.SKILL.md.')
        && filePath.endsWith('.tmp')
        && path.basename(process.cwd()) === 'terrace-help'
        && (Number(flags) & fs.constants.O_CREAT) !== 0) {
        swapped = true;
        fs.renameSync(agentDirectory, pinnedDirectory);
        fs.mkdirSync(outsideDirectory, { recursive: true });
        fs.writeFileSync(sentinelPath, 'outside must remain untouched\n', 'utf8');
        fs.symlinkSync(outsideDirectory, agentDirectory);
      }
      return originalOpenSync(filePath, flags, mode);
    }) as typeof fs.openSync);

    try {
      expectGuidanceCode(() => installAgentBootstrap(tmpDir), 'AGENT_ASSET_PATH_UNSAFE');
    } finally {
      swapDuringOpen.mockRestore();
    }

    expect(swapped).toBe(true);
    expect(process.cwd()).toBe(previousDirectory);
    expect(fs.readFileSync(sentinelPath, 'utf8')).toBe('outside must remain untouched\n');
    expect(fs.existsSync(path.join(outsideDirectory, 'SKILL.md'))).toBe(false);
    expect(fs.readdirSync(outsideDirectory).filter((entry) => entry.startsWith('.SKILL.md.'))).toEqual([]);
    expect(fs.readdirSync(pinnedDirectory).filter((entry) => entry.startsWith('.SKILL.md.'))).toEqual([]);
  });

  it('appends durable, readable JSONL events through the managed boundary', () => {
    appendEvent(tmpDir, { command: 'terrace first', from_state: 'initialized', to_state: 'initialized' });
    appendEvent(tmpDir, { command: 'terrace second', from_state: 'initialized', to_state: 'roadmap_ready' });

    expect(readEvents(tmpDir)).toEqual([
      expect.objectContaining({ command: 'terrace first' }),
      expect.objectContaining({ command: 'terrace second', to_state: 'roadmap_ready' })
    ]);
  });

  it('preserves existing event bytes when managed event replacement fails', () => {
    appendEvent(tmpDir, { command: 'terrace first', from_state: 'initialized', to_state: 'initialized' });
    const eventsPath = path.join(tmpDir, '.terrace', 'events.jsonl');
    const before = fs.readFileSync(eventsPath, 'utf8');
    const mutableFs = require('fs') as typeof fs;
    const originalRenameSync = mutableFs.renameSync;
    const renameFailure = vi.spyOn(mutableFs, 'renameSync').mockImplementation(((oldPath, newPath) => {
      if (newPath === 'events.jsonl') {
        throw new Error('simulated event replacement failure');
      }
      return originalRenameSync(oldPath, newPath);
    }) as typeof fs.renameSync);

    try {
      expect(() => appendEvent(tmpDir, { command: 'terrace second', from_state: 'initialized', to_state: 'roadmap_ready' })).toThrow('simulated event replacement failure');
    } finally {
      renameFailure.mockRestore();
    }

    expect(fs.readFileSync(eventsPath, 'utf8')).toBe(before);
    expect(readEvents(tmpDir)).toHaveLength(1);
  });
});
