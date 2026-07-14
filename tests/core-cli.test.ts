import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const { loadState, saveState } = require('../packages/terrace-core/src/index.cjs');

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

function runTerraceWithInput(tmpDir: string, args: string[], input: string) {
  const result = spawnSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8', input });
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

  it('previews natural-language writes with a state-bound token and keeps audit read-only', () => {
    runTerrace(tmpDir, ['init', '--json']);
    const initialized = loadState(tmpDir);
    saveState(tmpDir, {
      ...initialized,
      roadmap: {
        ...initialized.roadmap,
        phases: [{
          id: 'phase-11-notifications',
          title: 'Phase 11: Notifications',
          status: 'migrated',
          source_ref: '.planning/ROADMAP.md',
          plans: []
        }]
      }
    });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const planPath = path.join(tmpDir, 'docs', 'terrace', 'phases', 'phase-11-notifications', 'PLAN.md');
    const reportPath = path.join(tmpDir, '.terrace', 'report-card.json');
    const stateBefore = fs.readFileSync(statePath, 'utf-8');

    const preview = runTerrace(tmpDir, ['do', 'plan phase 11', '--json']);

    expect(preview).toMatchObject({
      intent_id: 'phase_plan',
      command: 'terrace phase plan phase-11-notifications',
      effect: 'write',
      mode: 'plan',
      requires_apply: true,
      writes: expect.arrayContaining([
        '.terrace/state.json',
        'docs/terrace/phases/phase-11-notifications/PLAN.md'
      ]),
      execution: [],
      apply: expect.objectContaining({
        argv: ['do', '--apply', expect.any(String)],
        plan_token: expect.any(String)
      })
    });
    expect(preview.result).toBeUndefined();
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBefore);
    expect(fs.existsSync(planPath)).toBe(false);

    const planToken = preview.apply.plan_token as string;
    const applied = runTerrace(tmpDir, ['do', '--apply', planToken, '--json']);

    expect(applied).toMatchObject({
      intent_id: 'phase_plan',
      mode: 'applied',
      requires_apply: false,
      applied: true,
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(fs.existsSync(planPath)).toBe(true);

    const stalePreview = runTerrace(tmpDir, ['do', 'create quick task stale token fixture', '--json']);
    const staleToken = stalePreview.apply.plan_token as string;
    const stateForStalePlan = loadState(tmpDir);
    saveState(tmpDir, {
      ...stateForStalePlan,
      workflow: {
        ...stateForStalePlan.workflow,
        active_feature: 'stale-token-fixture'
      }
    });
    const staleApply = runTerraceResult(tmpDir, ['do', '--apply', staleToken, '--json']);
    expect(staleApply.status).toBe(1);
    expect(staleApply.json.error).toContain('plan is stale');
    expect(staleApply.json.details).toMatchObject({
      code: 'INTENT_PLAN_STALE',
      next_command: 'terrace do <intent>'
    });

    const stateBeforeAudit = fs.readFileSync(statePath, 'utf-8');
    const audit = runTerrace(tmpDir, ['audit', '--json']);

    expect(audit.read_only).toBe(true);
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBeforeAudit);
    expect(fs.existsSync(reportPath)).toBe(false);

    runTerrace(tmpDir, ['report', 'update', '--json']);
    const reportDocPath = path.join(tmpDir, 'docs', 'terrace', 'REPORT-CARD.md');
    const reportHistoryPath = path.join(tmpDir, 'docs', 'terrace', 'report-history');
    const reportCardBefore = fs.readFileSync(reportPath, 'utf-8');
    const reportDocBefore = fs.readFileSync(reportDocPath, 'utf-8');
    const reportHistoryBefore = fs.readdirSync(reportHistoryPath).sort();
    const stateBeforePersistedAudit = fs.readFileSync(statePath, 'utf-8');

    const persistedAudit = runTerrace(tmpDir, ['audit', '--json']);

    expect(persistedAudit.read_only).toBe(true);
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBeforePersistedAudit);
    expect(fs.readFileSync(reportPath, 'utf-8')).toBe(reportCardBefore);
    expect(fs.readFileSync(reportDocPath, 'utf-8')).toBe(reportDocBefore);
    expect(fs.readdirSync(reportHistoryPath).sort()).toEqual(reportHistoryBefore);

    const misplacedApply = runTerraceResult(tmpDir, ['next', '--apply', '--json']);
    expect(misplacedApply.status).toBe(1);
    expect(misplacedApply.json.error).toContain('--apply is only supported');
  });

  it('rejects static full and missing ship modes before package scripts execute', () => {
    const sentinel = path.join(tmpDir, 'cli-ship-sentinel.txt');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        lint: 'node -e "require(\'fs\').writeFileSync(\'cli-ship-sentinel.txt\', \'ran\')"'
      }
    }, null, 2), 'utf-8');

    const staticFull = runTerraceResult(tmpDir, ['release-preflight', '--static', '--full', '--json']);
    expect(staticFull.status).toBe(1);
    expect(staticFull.json.blockers).toContainEqual(expect.objectContaining({ code: 'RELEASE_STATIC_MODE_INVALID' }));
    expect(fs.existsSync(sentinel)).toBe(false);

    const missingMode = runTerraceResult(tmpDir, ['ship', 'check', '--mode', '--json']);
    expect(missingMode.status).toBe(1);
    expect(missingMode.json.blockers).toContainEqual(expect.objectContaining({ code: 'SHIP_CHECK_MODE_INVALID' }));
    expect(fs.existsSync(sentinel)).toBe(false);
  });

  it('requires paired reset flags and exposes backup metadata through both init aliases', () => {
    runTerrace(tmpDir, ['init', '--json']);
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const before = fs.readFileSync(statePath, 'utf-8');

    const rejectedForce = runTerraceResult(tmpDir, ['init', '--force', '--json']);
    const rejectedYes = runTerraceResult(tmpDir, ['core', 'init', '--yes', '--json']);

    expect(rejectedForce.status).toBe(1);
    expect(rejectedForce.json.error).toContain('--force --yes');
    expect(rejectedYes.status).toBe(1);
    expect(rejectedYes.json.error).toContain('--force --yes');
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(before);

    const reset = runTerrace(tmpDir, ['core', 'init', '--force', '--yes', '--json']);

    expect(reset).toMatchObject({
      mode: 'reset',
      reset: expect.objectContaining({
        backup_path: expect.stringMatching(/^\.terrace\/backups\//)
      })
    });
    expect(fs.readFileSync(path.join(tmpDir, reset.reset.backup_path, 'state.json'), 'utf-8')).toBe(before);
  });

  it('backs up residual agent manifests through the top-level init alias', () => {
    runTerrace(tmpDir, ['init', '--json']);
    fs.rmSync(path.join(tmpDir, '.terrace'), { recursive: true, force: true });
    fs.rmSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true, force: true });
    const manifestPath = path.join(tmpDir, '.terrace', 'agents', 'manifest.json');
    const manifestBefore = '{"generated_by":"older Terrace"}\n';
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, manifestBefore, 'utf-8');

    const reset = runTerrace(tmpDir, ['init', '--force', '--yes', '--json']);

    expect(reset).toMatchObject({
      mode: 'reset',
      reset: expect.objectContaining({
        backed_up: expect.arrayContaining(['.terrace/agents/manifest.json']),
        overwritten: expect.arrayContaining(['.terrace/agents/manifest.json'])
      })
    });
    expect(fs.readFileSync(path.join(tmpDir, reset.reset.backup_path, 'agents', 'manifest.json'), 'utf-8')).toBe(manifestBefore);
  });

  it('repairs missing agent assets without changing core state', () => {
    runTerrace(tmpDir, ['init', '--json']);
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const eventsPath = path.join(tmpDir, '.terrace', 'events.jsonl');
    const stateBefore = fs.readFileSync(statePath, 'utf-8');
    const eventsBefore = fs.readFileSync(eventsPath, 'utf-8');
    fs.rmSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true });

    const result = runTerrace(tmpDir, ['agents', 'repair', '--json']);

    expect(result.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '.agents/skills/terrace-next/SKILL.md', status: 'written' })
    ]));
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBefore);
    expect(fs.readFileSync(eventsPath, 'utf-8')).toBe(eventsBefore);
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

  it('includes mapped state details in GSD parity JSON', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Bootstrap\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n\nNarrative-only state.\n', 'utf-8');

    const result = runTerrace(tmpDir, ['port', 'gsd', '--verify-parity', '--json']);

    expect(result).toMatchObject({
      mode: 'verify-parity',
      passed: true,
      comparison: {
        concepts: expect.objectContaining({
          state_details: 1
        })
      }
    });
  });

  it('imports GSD roadmap phases into existing state through the CLI', () => {
    runTerrace(tmpDir, ['core', 'init', '--json']);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Bootstrap\n\n## Phase 2: Release\n', 'utf-8');

    const result = runTerrace(tmpDir, ['port', 'gsd', '--import-roadmap', '--json']);
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf-8'));

    expect(result).toMatchObject({
      mode: 'roadmap-import',
      candidates: 2,
      imported: [
        expect.objectContaining({ id: 'phase-1-bootstrap' }),
        expect.objectContaining({ id: 'phase-2-release' })
      ],
      writes: ['.terrace/state.json'],
      next_command: 'terrace phase show phase-1-bootstrap'
    });
    expect(state.roadmap.phases.map((phase: { id: string }) => phase.id)).toEqual([
      'phase-1-bootstrap',
      'phase-2-release'
    ]);
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
    const naturalLanguagePlan = runTerrace(tmpDir, ['do', 'plan phase 11', '--json']);
    expect(naturalLanguagePlan).toMatchObject({
      command: 'terrace phase plan phase-11-notifications',
      mode: 'plan',
      requires_apply: true,
      apply: expect.objectContaining({
        plan_token: expect.any(String)
      })
    });
    expect(naturalLanguagePlan.result).toBeUndefined();
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
  }, 180000);

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

  it('initializes a new project from a PRD file', () => {
    const prdPath = path.join(tmpDir, 'input-prd.md');
    fs.writeFileSync(prdPath, [
      '# Hoopscout PRD',
      '',
      '## Problem',
      'Coaches need a faster way to evaluate players.',
      '',
      '## Users',
      '- Basketball coaches',
      '',
      '## Requirements',
      '- Upload player notes.',
      '- Rank prospects by fit.',
      '',
      '## Success Metrics',
      '- Coaches produce a shortlist in under 10 minutes.'
    ].join('\n'), 'utf-8');

    const result = runTerrace(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

    expect(result.project_id).toBe('hoopscout');
    expect(result.artifacts).toContain('docs/prd/PRD.md');
    expect(result.artifacts).toContain('docs/spec/COMPILED-SPEC.md');
    expect(result.next_command).toBe('terrace interrogate hoopscout');
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf-8')).toContain('Upload player notes.');
  });

  it('initializes a new project from pasted PRD stdin', () => {
    const result = runTerraceWithInput(tmpDir, ['new-project', 'Paste App', '--paste-prd', '--json'], '# Paste App\n\n- Users paste PRDs.\n');

    expect(result.status).toBe(0);
    expect(result.json.project_id).toBe('paste-app');
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf-8')).toContain('Users paste PRDs.');
  });

  it('refuses to overwrite an existing project PRD without force', () => {
    const prdPath = path.join(tmpDir, 'input-prd.md');
    fs.writeFileSync(prdPath, '# PRD\n\n- First requirement.\n', 'utf-8');
    runTerrace(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

    const second = runTerraceResult(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

    expect(second.status).toBe(1);
    expect(second.json.error).toContain('Refusing to overwrite docs/prd/PRD.md');
  });

  it('imports a feature PRD into an initialized Terrace project', () => {
    runTerrace(tmpDir, ['init', '--json']);
    const prdPath = path.join(tmpDir, 'feature-prd.md');
    fs.writeFileSync(prdPath, '# Saved Search PRD\n\n- Users can save prospect filters.\n- Success: scouts reuse filters weekly.\n', 'utf-8');

    const result = runTerrace(tmpDir, ['prd', 'import', 'Saved Search', '--file', prdPath, '--json']);

    expect(result.feature_id).toBe('saved-search');
    expect(result.artifacts).toContain('docs/terrace/features/saved-search/PRD.md');
    expect(result.artifacts).toContain('docs/terrace/features/saved-search/TEST-PLAN.md');
    expect(result.next_command).toBe('terrace interrogate saved-search');
  });

  it('requires initialization before feature PRD import', () => {
    const prdPath = path.join(tmpDir, 'feature-prd.md');
    fs.writeFileSync(prdPath, '# Feature PRD\n\n- Requirement.\n', 'utf-8');

    const result = runTerraceResult(tmpDir, ['prd', 'import', 'Saved Search', '--file', prdPath, '--json']);

    expect(result.status).toBe(1);
    expect(result.json.error).toContain('Missing .terrace/state.json');
  });
});
