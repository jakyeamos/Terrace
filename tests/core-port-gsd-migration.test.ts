import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { portGsd, runAudit } = require('../packages/terrace-core/src/index.cjs');

describe('terrace port gsd migration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-port-gsd-migration-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Legacy Project\n\nCurrent focus: migrate this.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n\n- REQ-001: preserve migration intent\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Bootstrap\n\n## Phase 2: Release\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Legacy State\n\nlast_activity: legacy work\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', 'PLAN.md'), '# Unsupported phase plan\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates supported GSD artifacts into Terrace state without deleting source files', () => {
    const result = portGsd(tmpDir, { force: false });

    expect(result.mode).toBe('migration');
    expect(result.writes).toContain('.terrace/state.json');
    expect(result.writes).toContain('.terrace/migration/gsd-port-report.json');
    expect(result.writes).toContain('docs/prd/PRD.md');
    expect(result.writes).toContain('docs/spec/COMPILED-SPEC.md');
    expect(result.writes).toContain('docs/terrace-migration/GSD-STATE.md');
    expect(result.skipped).toContainEqual(expect.objectContaining({
      artifact: '.planning/phases/01-demo/PLAN.md',
      reason: 'unsupported_artifact'
    }));
    expect(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md'))).toBe(true);

    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));
    expect(state.project.name).toBe(path.basename(tmpDir));
    expect(state.migration.source).toBe('gsd');
    expect(state.migration.artifacts).toContain('.planning/PROJECT.md');
    expect(state.roadmap.phases).toEqual([
      { id: 'phase-1-bootstrap', title: 'Phase 1: Bootstrap', status: 'migrated', source_ref: '.planning/ROADMAP.md', plans: [] },
      { id: 'phase-2-release', title: 'Phase 2: Release', status: 'migrated', source_ref: '.planning/ROADMAP.md', plans: [] }
    ]);

    const prd = fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf8');
    const spec = fs.readFileSync(path.join(tmpDir, 'docs', 'spec', 'COMPILED-SPEC.md'), 'utf8');
    expect(prd).toContain('Current focus: migrate this.');
    expect(spec).toContain('REQ-001: preserve migration intent');
    expect(result.review_checklist).toContain('Review docs/prd/PRD.md against the original .planning/PROJECT.md.');
    expect(runAudit(tmpDir).healthy).toBe(true);
  });

  it('refuses to overwrite an existing Terrace state without force', () => {
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'state.json'), '{"existing":true}\n', 'utf8');

    expect(() => portGsd(tmpDir, { force: false })).toThrow(/already exists/);
  });

  it('does not overwrite migrated docs without force and reports the skipped target', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'existing prd\n', 'utf8');

    const result = portGsd(tmpDir, { force: false });

    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf8')).toBe('existing prd\n');
    expect(result.skipped).toContainEqual(expect.objectContaining({
      artifact: '.planning/PROJECT.md',
      target: 'docs/prd/PRD.md',
      reason: 'target_exists'
    }));
  });

  it('migrates rich GSD workflow artifacts into state, docs, and actionable reports', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'HANDOFF.json'), JSON.stringify({
      status: 'paused',
      phase: 'Phase 11: Notifications',
      next_action: 'Plan Phase 11 via /gsd:plan-phase',
      human_action_pending: {
        description: 'Apply migration 034_prime_notes.sql to Supabase',
        blocking: true
      },
      decisions: ['Keep beta onboarding manual until notification work lands.']
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), [
      '# Legacy State',
      '',
      '## Decisions',
      '- Use server actions for mutations.',
      '',
      '## Quick Tasks Completed',
      '- QT-001: tighten dashboard copy (commit abc123)',
      '',
      '## Parking Lot',
      '- Add SMS fallback.'
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', '01-01-PLAN.md'), '# Plan A\n\nDo setup.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', '01-01-SUMMARY.md'), '# Summary A\n\nDone.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', '01-VALIDATION.md'), '# Validation\n\nManual check.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', '01-UAT.md'), '# UAT\n\nUser accepted.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login', '260101-abc-PLAN.md'), [
      '---',
      'phase: quick',
      'plan: 260101-abc',
      'type: execute',
      'files_modified:',
      '  - src/login.ts',
      '---',
      '',
      '# Quick Fix Plan',
      '',
      '<objective>Fix login redirect.</objective>'
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'quick', '260101-abc-fix-login', '260101-abc-SUMMARY.md'), [
      '---',
      'phase: quick',
      'plan: 260101-abc',
      'subsystem: auth',
      'tags: [bug-fix]',
      '---',
      '',
      '# Quick Fix 260101-abc: Fix Login Redirect',
      '',
      '**One-liner:** Login now redirects to dashboard.',
      '',
      '| Task | Description | Commit |',
      '|------|-------------|--------|',
      '| 1 | Fix redirect | deadbee |'
    ].join('\n'), 'utf8');

    const result = portGsd(tmpDir, { force: false });
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));

    expect(state.handoff.next_action).toBe('Plan Phase 11 via /gsd:plan-phase');
    expect(state.blocked_actions).toContainEqual(expect.objectContaining({
      description: 'Apply migration 034_prime_notes.sql to Supabase',
      blocking: true,
      source_ref: '.planning/HANDOFF.json'
    }));
    expect(state.sessions).toContainEqual(expect.objectContaining({
      source: 'gsd_handoff',
      status: 'paused'
    }));
    expect(state.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Use server actions for mutations.', source_ref: '.planning/STATE.md' }),
      expect.objectContaining({ text: 'Keep beta onboarding manual until notification work lands.', source_ref: '.planning/HANDOFF.json' })
    ]));
    expect(state.backlog.items).toContainEqual(expect.objectContaining({
      title: 'Add SMS fallback.',
      source_ref: '.planning/STATE.md'
    }));
    expect(state.quick_tasks).toContainEqual(expect.objectContaining({
      id: '260101-abc',
      title: 'Quick Fix 260101-abc: Fix Login Redirect',
      status: 'completed',
      source_dir: '.planning/quick/260101-abc-fix-login',
      plan_ref: '.planning/quick/260101-abc-fix-login/260101-abc-PLAN.md',
      summary_ref: '.planning/quick/260101-abc-fix-login/260101-abc-SUMMARY.md',
      files_modified: ['src/login.ts'],
      commits: ['deadbee']
    }));
    expect(state.sessions).toContainEqual(expect.objectContaining({
      source: 'gsd_quick',
      task_id: '260101-abc',
      status: 'completed'
    }));
    expect(state.roadmap.phases[0].plans).toContainEqual(expect.objectContaining({
      id: '01-01',
      title: 'Plan A',
      status: 'migrated',
      source_ref: '.planning/phases/01-demo/01-01-PLAN.md'
    }));
    expect(result.converted).toContainEqual(expect.objectContaining({
      artifact: '.planning/phases/01-demo/01-VALIDATION.md',
      target: 'docs/testing/gsd/01-demo/01-VALIDATION.md',
      type: 'testing_artifact'
    }));
    expect(result.converted).toContainEqual(expect.objectContaining({
      artifact: '.planning/quick/260101-abc-fix-login/260101-abc-SUMMARY.md',
      target: 'docs/terrace-migration/quick/260101-abc-fix-login/260101-abc-SUMMARY.md',
      type: 'quick_task_artifact'
    }));
    expect(result.skipped).not.toContainEqual(expect.objectContaining({
      artifact: '.planning/quick/260101-abc-fix-login/260101-abc-PLAN.md'
    }));
    expect(result.skipped).toContainEqual(expect.objectContaining({
      artifact: '.planning/phases/01-demo/PLAN.md',
      reason: 'unsupported_artifact',
      suggested_action: expect.stringContaining('Review manually')
    }));
    expect(result.next_command).toBe('terrace phase show phase-11-notifications');
    expect(result.readiness.status).toBe('blocked');
    expect(result.blockers).toContainEqual(expect.objectContaining({
      code: 'GSD_HANDOFF_BLOCKED_ACTION'
    }));
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace-migration', 'phases', '01-demo', '01-01-PLAN.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'testing', 'gsd', '01-demo', '01-UAT.md'))).toBe(true);
  });
});
