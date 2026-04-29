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
    expect(runTerrace(tmpDir, ['history', '--json']).quick_tasks.total).toBe(0);
    expect(runTerrace(tmpDir, ['phase', 'plan', 'phase-11-notifications', '--json'])).toMatchObject({
      phase_id: 'phase-11-notifications',
      next_command: 'terrace phase execute phase-11-notifications'
    });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'phases', 'phase-11-notifications', 'PLAN.md'))).toBe(true);
    expect(runTerrace(tmpDir, ['phase', 'execute', 'phase-11-notifications', '--json'])).toMatchObject({
      allowed: false,
      blockers: expect.any(Array)
    });
    expect(runTerrace(tmpDir, ['plan-phase', 'phase-11-notifications', '--json'])).toMatchObject({
      command_alias: 'terrace phase plan phase-11-notifications',
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(runTerrace(tmpDir, ['do', 'plan phase 11', '--json'])).toMatchObject({
      command: 'terrace phase plan phase-11-notifications',
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(runTerrace(tmpDir, ['do', '/gsd:plan-phase 11', '--json'])).toMatchObject({
      command: 'terrace phase plan phase-11-notifications'
    });
    expect(runTerrace(tmpDir, ['autonomous', '--json'])).toMatchObject({
      status: 'blocked',
      planned: { phase_id: 'phase-11-notifications' },
      execution: { allowed: false }
    });
    expect(runTerrace(tmpDir, ['quick', 'plan', 'Refresh beta copy', '--json']).item).toMatchObject({
      title: 'Refresh beta copy',
      status: 'planned'
    });
    expect(runTerrace(tmpDir, ['commands', 'discover', '--json'])).toMatchObject({
      package_manager: 'npm',
      checks: expect.any(Array)
    });
    expect(runTerrace(tmpDir, ['align', 'billing-refresh', '--tier', 'large', '--json'])).toMatchObject({
      feature_id: 'billing-refresh',
      tier: 'large',
      artifact: 'docs/terrace/features/billing-refresh/ALIGNMENT.md'
    });
    expect(runTerrace(tmpDir, ['test-plan', 'billing-refresh', '--json'])).toMatchObject({
      feature_id: 'billing-refresh',
      artifact: 'docs/testing/TEST-PLAN.md'
    });
    expect(runTerrace(tmpDir, ['observe', 'billing-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/billing-refresh/OBSERVABILITY.md'
    });
    expect(runTerrace(tmpDir, ['validate-prod', 'billing-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/billing-refresh/VALIDATION.md'
    });
    expect(runTerrace(tmpDir, ['cleanup', 'billing-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/billing-refresh/CLEANUP.md'
    });
    expect(runTerrace(tmpDir, ['ui', 'import-stitch', 'settings-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/settings-refresh/UI-STITCH.md'
    });
    expect(runTerrace(tmpDir, ['ui', 'plan-refresh', 'settings-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/settings-refresh/UI-REFRESH.md'
    });
    expect(runTerrace(tmpDir, ['ui', 'diff', 'settings-refresh', '--json'])).toMatchObject({
      artifact: 'docs/terrace/features/settings-refresh/UI-DIFF.md'
    });
    expect(runTerrace(tmpDir, ['backlog', 'list', '--json']).items).toContainEqual(expect.objectContaining({
      title: 'Add SMS fallback.'
    }));
    const added = runTerrace(tmpDir, ['backlog', 'add', 'Confirm beta email copy', '--json']);
    expect(added.item.title).toBe('Confirm beta email copy');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login', '260101-abc-SUMMARY.md'), '# Quick Fix 260101-abc: Fix Login Redirect\n', 'utf-8');
    const ship = runTerraceResult(tmpDir, ['ship', 'check', '--json']);
    expect(ship.status).toBe(1);
    expect(ship.json).toMatchObject({
      passed: false,
      categories: expect.any(Array)
    });
    expect(runTerrace(tmpDir, ['port', 'gsd', '--compare', '--json'])).toMatchObject({
      mode: 'compare',
      passed: true
    });
    expect(runTerrace(tmpDir, ['port', 'gsd', '--verify-parity', '--json'])).toMatchObject({
      mode: 'verify-parity',
      passed: true
    });
    expect(runTerraceResult(tmpDir, ['report', 'ceremony', '--json']).json).toHaveProperty('artifact_count');
    expect(runTerrace(tmpDir, ['waive', 'security-check', '--reason', 'fixture warning', '--owner', 'release-owner', '--expires', 'before public release', '--json'])).toMatchObject({
      waiver: expect.objectContaining({ gate: 'security-check' })
    });
    expect(runTerraceResult(tmpDir, ['ship', 'check', '--fast', '--json']).json).toMatchObject({
      mode: 'fast',
      categories: expect.arrayContaining([expect.objectContaining({ category: 'waivers' })])
    });
    const prepared = runTerraceResult(tmpDir, ['ship', 'prepare', '--json']);
    expect(prepared.status).toBe(1);
    expect(prepared.json.ship_ref).toBe('docs/terrace/ship/SHIP.md');
  }, 60000);

  it('supports migrated quick-task history commands', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login', '260101-abc-SUMMARY.md'), [
      '---',
      'phase: quick',
      'plan: 260101-abc',
      '---',
      '',
      '# Quick Fix 260101-abc: Fix Login Redirect'
    ].join('\n'), 'utf-8');
    runTerrace(tmpDir, ['port', 'gsd', '--json']);

    expect(runTerrace(tmpDir, ['quick', 'list', '--json']).items).toContainEqual(expect.objectContaining({
      id: '260101-abc',
      title: 'Quick Fix 260101-abc: Fix Login Redirect'
    }));
    expect(runTerrace(tmpDir, ['quick', 'show', '260101-abc', '--json']).item).toMatchObject({
      source_dir: '.planning/quick/260101-abc-fix-login'
    });
  });
});
