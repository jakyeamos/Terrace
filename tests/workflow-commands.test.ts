import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  saveState,
  createDefaultState,
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  resumeWorkflow,
  nextWorkflow,
  historySummary,
  backlogList,
  backlogAdd,
  quickList,
  quickShow,
  quickPlan,
  quickExecute,
  quickComplete,
  shipPrepare,
  routePlainText,
  shipCheck
} = require('../packages/terrace-core/src/index.cjs');

describe('workflow parity core helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-workflow-commands-'));
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'phase-11-notifications',
      title: 'Phase 11: Notifications',
      status: 'migrated',
      source_ref: '.planning/ROADMAP.md',
      plans: [{ id: '11-01', title: 'Notification Plan', status: 'migrated', source_ref: '.planning/phases/11/11-01-PLAN.md' }]
    }];
    state.handoff = {
      status: 'paused',
      phase: 'Phase 11: Notifications',
      next_action: 'Plan Phase 11 via /gsd:plan-phase',
      source_ref: '.planning/HANDOFF.json'
    };
    state.sessions = [{ source: 'gsd_handoff', status: 'paused' }];
    state.blocked_actions = [{ description: 'Apply migration 034_prime_notes.sql', blocking: true, source_ref: '.planning/HANDOFF.json' }];
    state.backlog = { items: [{ id: 'sms-fallback', title: 'Add SMS fallback.', status: 'open', source_ref: '.planning/STATE.md' }] };
    state.quick_tasks = [{
      id: '260101-abc',
      title: 'Quick Fix 260101-abc: Fix Login Redirect',
      status: 'completed',
      source_dir: '.planning/quick/260101-abc-fix-login',
      commits: ['deadbee']
    }];
    saveState(tmpDir, state);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists, shows, resumes, and computes next workflow action from state', () => {
    expect(phaseList(tmpDir).phases).toHaveLength(1);
    expect(phaseShow(tmpDir, 'phase-11-notifications').phase.plans).toHaveLength(1);
    expect(resumeWorkflow(tmpDir)).toMatchObject({
      status: 'paused',
      next_action: 'Plan Phase 11 via /gsd:plan-phase'
    });
    expect(nextWorkflow(tmpDir)).toMatchObject({
      command: 'terrace phase show phase-11-notifications',
      blocked: true
    });
  });

  it('summarizes accumulated GSD history for operational continuity', () => {
    const result = historySummary(tmpDir);

    expect(result).toMatchObject({
      quick_tasks: { total: 1, completed: 1 },
      sessions: { total: 1 },
      decisions: { total: 0 },
      phases: { total: 1 }
    });
    expect(result.recent_quick_tasks).toContainEqual(expect.objectContaining({
      id: '260101-abc'
    }));
  });

  it('plans and executes migrated phases with hard blocker awareness', () => {
    const planned = phasePlan(tmpDir, 'phase-11-notifications');

    expect(planned).toMatchObject({
      phase_id: 'phase-11-notifications',
      status: 'slice_planned',
      next_command: 'terrace phase execute phase-11-notifications'
    });
    expect(fs.existsSync(path.join(tmpDir, planned.plan_ref))).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, planned.plan_ref), 'utf-8')).toContain('Phase 11: Notifications');
    expect(phaseExecute(tmpDir, 'phase-11-notifications')).toMatchObject({
      allowed: false,
      blockers: [expect.objectContaining({ description: 'Apply migration 034_prime_notes.sql' })]
    });
  });

  it('executes, validates, reviews, and completes a phase lifecycle', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'phase-12-release',
      title: 'Phase 12: Release',
      status: 'planned',
      source_ref: '.planning/ROADMAP.md',
      plans: [{ id: '12-01', title: 'Release Plan', status: 'planned', source_ref: '.planning/phases/12/12-01-PLAN.md' }]
    }];
    saveState(tmpDir, state);

    const planned = phasePlan(tmpDir, 'phase-12-release');
    const executed = phaseExecute(tmpDir, 'phase-12-release');
    const validated = phaseValidate(tmpDir, 'phase-12-release');
    const reviewed = phaseReview(tmpDir, 'phase-12-release');
    const completed = phaseComplete(tmpDir, 'phase-12-release');

    expect(planned.plan_ref).toBe('docs/terrace/phases/phase-12-release/PLAN.md');
    expect(executed).toMatchObject({
      allowed: true,
      phase_id: 'phase-12-release',
      status: 'red_required',
      waves: expect.any(Array)
    });
    expect(validated.validation_ref).toBe('docs/terrace/phases/phase-12-release/VALIDATION.md');
    expect(reviewed.review_ref).toBe('docs/terrace/phases/phase-12-release/REVIEW.md');
    expect(completed.summary_ref).toBe('docs/terrace/phases/phase-12-release/SUMMARY.md');
    expect(phaseShow(tmpDir, 'phase-12-release').phase).toMatchObject({
      status: 'completed',
      plan_ref: 'docs/terrace/phases/phase-12-release/PLAN.md',
      validation_ref: 'docs/terrace/phases/phase-12-release/VALIDATION.md',
      review_ref: 'docs/terrace/phases/phase-12-release/REVIEW.md',
      summary_ref: 'docs/terrace/phases/phase-12-release/SUMMARY.md'
    });
  });

  it('manages backlog items and rejects missing phase ids', () => {
    expect(backlogList(tmpDir).items).toContainEqual(expect.objectContaining({ title: 'Add SMS fallback.' }));
    expect(backlogAdd(tmpDir, 'Confirm beta email copy').item).toMatchObject({
      title: 'Confirm beta email copy',
      status: 'open'
    });
    expect(() => backlogAdd(tmpDir, '')).toThrow(/Usage:/);
    expect(() => phaseShow(tmpDir, 'missing-phase')).toThrow(/Unknown phase/);
  });

  it('lists and shows migrated quick-task history', () => {
    expect(quickList(tmpDir).items).toContainEqual(expect.objectContaining({
      id: '260101-abc',
      title: 'Quick Fix 260101-abc: Fix Login Redirect'
    }));
    expect(quickShow(tmpDir, '260101-abc').item).toMatchObject({
      status: 'completed',
      commits: ['deadbee']
    });
    expect(() => quickShow(tmpDir, 'missing-quick-task')).toThrow(/Unknown quick task/);
  });

  it('plans, executes, and completes Terrace quick tasks', () => {
    const planned = quickPlan(tmpDir, 'Fix login redirect');
    const executed = quickExecute(tmpDir, planned.item.id);
    const completed = quickComplete(tmpDir, planned.item.id);

    expect(planned.item).toMatchObject({
      id: 'terrace-quick-2',
      title: 'Fix login redirect',
      status: 'planned',
      plan_ref: 'docs/terrace/quick/terrace-quick-2/PLAN.md'
    });
    expect(fs.existsSync(path.join(tmpDir, planned.item.plan_ref))).toBe(true);
    expect(executed.item).toMatchObject({
      status: 'red_required',
      next_command: 'terrace quick complete terrace-quick-2'
    });
    expect(completed.item).toMatchObject({
      status: 'completed',
      summary_ref: 'docs/terrace/quick/terrace-quick-2/SUMMARY.md'
    });
  });

  it('prepares a ship summary artifact from check results', () => {
    const result = shipPrepare(tmpDir);

    expect(result).toMatchObject({
      passed: false,
      ship_ref: 'docs/terrace/ship/SHIP.md',
      next_command: 'terrace ship check'
    });
    expect(fs.readFileSync(path.join(tmpDir, result.ship_ref), 'utf-8')).toContain('Release Readiness');
  }, 15000);

  it('routes plain text to stable Terrace commands for agents', () => {
    expect(routePlainText(tmpDir, 'plan phase 11')).toMatchObject({
      command: 'terrace phase plan phase-11-notifications',
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(routePlainText(tmpDir, 'create quick task refresh beta copy')).toMatchObject({
      command: 'terrace quick plan refresh beta copy',
      result: { item: expect.objectContaining({ title: 'refresh beta copy' }) }
    });
    expect(routePlainText(tmpDir, 'show me history')).toMatchObject({
      command: 'terrace history'
    });
    expect(() => routePlainText(tmpDir, 'make the app better somehow')).toThrow(/Unsupported plain-text Terrace command/);
  });

  it('reports failed ship checks as structured categories', () => {
    const result = shipCheck(tmpDir);

    expect(result.passed).toBe(false);
    expect(result.categories.map((category: { category: string }) => category.category)).toEqual([
      'doctor',
      'audit',
      'migration_readiness',
      'typecheck',
      'lint',
      'test',
      'coverage',
      'package',
      'dirty_tree'
    ]);
    expect(result.blockers.length).toBeGreaterThan(0);
  }, 15000);
});
