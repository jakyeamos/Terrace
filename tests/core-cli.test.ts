import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

function runTerraceResult(tmpDir: string, args: string[]) {
  const result = spawnSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return {
    status: result.status,
    json: JSON.parse(result.stdout)
  };
}

describe('strict core CLI delegation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes strict core state as JSON', () => {
    const result = runTerrace(tmpDir, ['core', 'init', '--json']);

    expect(result.created).toContain('.terrace/state.json');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(true);
  });

  it('explains core rules through the CLI', () => {
    runTerrace(tmpDir, ['core', 'init', '--json']);
    const result = runTerrace(tmpDir, ['rule', 'explain', 'testing-trust', '--json']);

    expect(result.id).toBe('testing-trust');
  });

  it('runs GSD port inventory in dry-run mode', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');

    const result = runTerrace(tmpDir, ['port', 'gsd', '--dry-run', '--json']);

    expect(result.artifacts).toContain('.planning/ROADMAP.md');
    expect(result.writes).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
  });

  it('supports migrated GSD daily workflow commands', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '11-notifications'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 11: Notifications\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '## Parking Lot\n- Add SMS fallback.\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'HANDOFF.json'), JSON.stringify({
      status: 'paused',
      next_action: 'Plan Phase 11 via /gsd:plan-phase',
      human_action_pending: {
        description: 'Apply migration 034_prime_notes.sql to Supabase',
        blocking: true
      }
    }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '11-notifications', '11-01-PLAN.md'), '# Notification Plan\n', 'utf-8');
    runTerrace(tmpDir, ['port', 'gsd', '--json']);

    expect(runTerrace(tmpDir, ['next', '--json'])).toMatchObject({
      command: 'terrace phase show phase-11-notifications',
      blocked: true
    });
    expect(runTerrace(tmpDir, ['resume', '--json'])).toMatchObject({
      status: 'paused',
      next_action: 'Plan Phase 11 via /gsd:plan-phase'
    });
    expect(runTerrace(tmpDir, ['phase', 'list', '--json']).phases).toHaveLength(1);
    expect(runTerrace(tmpDir, ['phase', 'show', 'phase-11-notifications', '--json']).phase.plans).toContainEqual(expect.objectContaining({
      title: 'Notification Plan'
    }));
    expect(runTerrace(tmpDir, ['backlog', 'list', '--json']).items).toContainEqual(expect.objectContaining({
      title: 'Add SMS fallback.'
    }));
    const added = runTerrace(tmpDir, ['backlog', 'add', 'Confirm beta email copy', '--json']);
    expect(added.item.title).toBe('Confirm beta email copy');
    const ship = runTerraceResult(tmpDir, ['ship', 'check', '--json']);
    expect(ship.status).toBe(1);
    expect(ship.json).toMatchObject({
      passed: false,
      categories: expect.any(Array)
    });
  }, 15000);
});
