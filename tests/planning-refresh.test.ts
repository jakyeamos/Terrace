import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  initCore,
  loadState,
  saveState,
  refreshPlanningPackage,
  portGsdVerifyParity
} = require('../packages/terrace-core/src/index.cjs');

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

function seedPhaseOneState(tmpDir: string) {
  initCore(tmpDir, { projectName: 'planning-parity' });
  const state = loadState(tmpDir);
  state.roadmap.phases = [{
    id: 'phase-1-planning-parity',
    title: 'Phase 1: Planning Parity',
    status: 'planned',
    source_ref: '.terrace/state.json',
    plans: []
  }];
  state.backlog.items = [{
    id: 'refresh-planning-package',
    title: 'Refresh .planning from Terrace state.',
    status: 'open',
    source_ref: '.terrace/state.json'
  }];
  saveState(tmpDir, state);
}

describe('terrace planning refresh', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-planning-refresh-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: 'planning-parity-fixture',
      scripts: {
        lint: 'eslint .',
        test: 'vitest run',
        typecheck: 'tsc --noEmit'
      },
      dependencies: {
        react: 'latest'
      }
    }, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'export const value = 1;\n', 'utf-8');
    seedPhaseOneState(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('refreshes a deterministic .planning package from state and repo analysis', () => {
    const result = refreshPlanningPackage(tmpDir);

    expect(result).toMatchObject({
      mode: 'refresh',
      planning_dir: '.planning',
      state_ref: '.terrace/state.json',
      analysis: {
        package_manager: 'pnpm'
      },
      next_command: 'terrace port gsd --verify-parity'
    });
    expect(result.writes).toEqual([...result.writes].sort());
    expect(result.writes).toEqual(expect.arrayContaining([
      '.planning/PROJECT.md',
      '.planning/REQUIREMENTS.md',
      '.planning/ROADMAP.md',
      '.planning/STATE.md',
      '.planning/HANDOFF.json',
      '.planning/config.json',
      '.planning/phases/01-planning-parity/01-01-PLAN.md'
    ]));
    expect(fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8')).toContain('- Package manager: pnpm');
    expect(fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8')).toContain('## Phase 1: Planning Parity');
  });

  it('refuses a symlinked planning parent before writing generated planning artifacts', () => {
    const outside = path.join(tmpDir, 'outside-planning');
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(tmpDir, '.planning'));

    let thrown: { details?: { code?: string } } | null = null;
    try {
      refreshPlanningPackage(tmpDir);
    } catch (error) {
      thrown = error as { details?: { code?: string } };
    }

    expect(thrown?.details?.code).toBe('MANAGED_ARTIFACT_PATH_UNSAFE');
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it('supports the Phase 1 planning-parity workflow through deterministic CLI JSON', () => {
    const first = runTerrace(tmpDir, ['planning', 'refresh', '--json']);
    const second = runTerrace(tmpDir, ['planning', 'refresh', '--json']);

    expect(second).toEqual(first);
    expect(first.phases).toEqual([{
      id: 'phase-1-planning-parity',
      title: 'Phase 1: Planning Parity',
      artifact: '.planning/phases/01-planning-parity/01-01-PLAN.md'
    }]);

    const parity = runTerrace(tmpDir, ['port', 'gsd', '--verify-parity', '--json']);
    expect(parity).toMatchObject({
      mode: 'verify-parity',
      passed: true,
      comparison: {
        concepts: expect.objectContaining({
          phases: 1,
          state_details: 1,
          phase_artifacts: 1
        })
      }
    });
  });

  it('exposes planning init as the same first-class refresh command', () => {
    const result = runTerrace(tmpDir, ['planning', 'init', '--json']);

    expect(result.mode).toBe('refresh');
    expect(portGsdVerifyParity(tmpDir).passed).toBe(true);
  });
});
