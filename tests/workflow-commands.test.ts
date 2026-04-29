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
  autonomousWorkflow,
  discoverProjectCommands,
  alignFeature,
  interrogateFeature,
  mapCodebase,
  designFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  uiImportStitch,
  uiPlanRefresh,
  uiDiff,
  reviewAi,
  seniorCycleStatus,
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
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '11'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '11', '11-01-PLAN.md'), [
      '# Notification Plan',
      '',
      'Update src/app/notifications/page.tsx and src/lib/notifications.ts.',
      'Run npm run lint before review.'
    ].join('\n'), 'utf-8');
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

  it('rejects feature ids that normalize to path traversal segments', () => {
    expect(() => alignFeature(tmpDir, '..', { tier: 'medium' })).toThrow(/Usage: terrace/);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'ALIGNMENT.md'))).toBe(false);
  });

  it('normalizes AI review mode before using it as an artifact path', () => {
    const result = reviewAi(tmpDir, { feature: 'checkout', mode: '../../escape' });

    expect(result.artifact).toBe('docs/terrace/reviews/checkout/escape.json');
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'reviews', 'checkout', 'escape.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'escape.json'))).toBe(false);
  });

  it('plans and executes migrated phases with hard blocker awareness', () => {
    const planned = phasePlan(tmpDir, 'phase-11-notifications');

    expect(planned).toMatchObject({
      phase_id: 'phase-11-notifications',
      status: 'slice_planned',
      next_command: 'terrace phase execute phase-11-notifications',
      source_refs: ['.planning/phases/11/11-01-PLAN.md']
    });
    expect(fs.existsSync(path.join(tmpDir, planned.plan_ref))).toBe(true);
    const plan = fs.readFileSync(path.join(tmpDir, planned.plan_ref), 'utf-8');
    expect(plan).toContain('Phase 11: Notifications');
    expect(plan).toContain('src/app/notifications/page.tsx');
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
    alignFeature(tmpDir, 'phase-12-release', { tier: 'medium' });
    testPlanFeature(tmpDir, 'phase-12-release', { tier: 'medium' });
    observeFeature(tmpDir, 'phase-12-release', { tier: 'medium' });
    validateProdFeature(tmpDir, 'phase-12-release', { tier: 'medium' });
    cleanupFeature(tmpDir, 'phase-12-release', { tier: 'medium' });
    const executed = phaseExecute(tmpDir, 'phase-12-release');
    const validated = phaseValidate(tmpDir, 'phase-12-release');
    const reviewed = phaseReview(tmpDir, 'phase-12-release');
    const completed = phaseComplete(tmpDir, 'phase-12-release');

    expect(planned.plan_ref).toBe('docs/terrace/phases/phase-12-release/PLAN.md');
    expect(executed).toMatchObject({
      allowed: true,
      phase_id: 'phase-12-release',
      status: 'red_required',
      waves: expect.any(Array),
      execution_ref: 'docs/terrace/phases/phase-12-release/EXECUTION.md',
      queue: [expect.objectContaining({ id: '12-01' })]
    });
    expect(fs.existsSync(path.join(tmpDir, executed.execution_ref))).toBe(true);
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
    testPlanFeature(tmpDir, planned.item.id, { tier: 'small' });
    const executed = quickExecute(tmpDir, planned.item.id);
    fs.writeFileSync(path.join(tmpDir, 'docs', 'terrace', 'quick', planned.item.id, 'VERIFICATION.md'), '# Verification\n\n- npm test passed.\n', 'utf-8');
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
    expect(fs.readFileSync(path.join(tmpDir, planned.item.plan_ref), 'utf-8')).toContain('No Band-Aid Rule');
  });

  it('generates senior-cycle artifacts and enforces tiered gates', () => {
    const featureId = 'billing-refresh';
    const before = seniorCycleStatus(tmpDir, featureId, 'large');

    expect(before.allowed.execute).toBe(false);
    expect(before.allowed.ship).toBe(false);
    expect(before.blockers).toContainEqual(expect.objectContaining({
      code: 'ALIGNMENT_REQUIRED',
      artifact: 'docs/terrace/features/billing-refresh/ALIGNMENT.md'
    }));
    expect(before.blockers).toContainEqual(expect.objectContaining({
      code: 'TEST_PLAN_REQUIRED',
      artifact: 'docs/testing/TEST-PLAN.md'
    }));

    const aligned = alignFeature(tmpDir, featureId, { tier: 'large' });
    const interrogated = interrogateFeature(tmpDir, featureId, { tier: 'large' });
    const mapped = mapCodebase(tmpDir);
    const designed = designFeature(tmpDir, featureId, { tier: 'large' });
    const tested = testPlanFeature(tmpDir, featureId, { tier: 'large' });
    const observed = observeFeature(tmpDir, featureId, { tier: 'large' });
    const validated = validateProdFeature(tmpDir, featureId, { tier: 'large' });
    const cleaned = cleanupFeature(tmpDir, featureId, { tier: 'large' });
    const after = seniorCycleStatus(tmpDir, featureId, 'large');

    expect(aligned.artifact).toBe('docs/terrace/features/billing-refresh/ALIGNMENT.md');
    expect(interrogated.artifact).toBe('docs/terrace/features/billing-refresh/INTERROGATION.md');
    expect(mapped.artifacts).toEqual([
      'docs/terrace/codebase/MAP.md',
      'docs/terrace/codebase/ARCHITECTURE.md',
      'docs/terrace/codebase/RISKS.md',
      'docs/terrace/codebase/TESTING.md',
      'docs/terrace/codebase/OBSERVABILITY.md'
    ]);
    expect(designed.artifact).toBe('docs/terrace/features/billing-refresh/DESIGN.md');
    expect(tested.artifact).toBe('docs/testing/TEST-PLAN.md');
    expect(observed.artifact).toBe('docs/terrace/features/billing-refresh/OBSERVABILITY.md');
    expect(validated.artifact).toBe('docs/terrace/features/billing-refresh/VALIDATION.md');
    expect(cleaned.artifact).toBe('docs/terrace/features/billing-refresh/CLEANUP.md');
    expect(after.blockers).toEqual([]);
    expect(after.allowed).toMatchObject({
      execute: true,
      implement: true,
      ship: true,
      complete: true
    });
    expect(fs.readFileSync(path.join(tmpDir, aligned.artifact), 'utf-8')).toContain('Feature Flag Decision');
    expect(fs.readFileSync(path.join(tmpDir, designed.artifact), 'utf-8')).toContain('No Band-Aid Rule');
  });

  it('uses adaptive senior-cycle enforcement for small changes', () => {
    const featureId = 'copy-polish';
    const before = seniorCycleStatus(tmpDir, featureId, 'small');

    expect(before.required_artifacts).toContain('docs/testing/TEST-PLAN.md');
    expect(before.required_artifacts).not.toContain('docs/terrace/features/copy-polish/ALIGNMENT.md');
    expect(before.blockers).toContainEqual(expect.objectContaining({ code: 'TEST_PLAN_REQUIRED' }));

    testPlanFeature(tmpDir, featureId, { tier: 'small' });
    expect(seniorCycleStatus(tmpDir, featureId, 'small').allowed.implement).toBe(true);
  });

  it('blocks phase execution when senior-cycle gates are missing for that feature', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'billing-refresh',
      title: 'Billing Refresh',
      status: 'planned',
      source_ref: 'docs/terrace/features/billing-refresh/ALIGNMENT.md',
      plans: []
    }];
    saveState(tmpDir, state);

    alignFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    const blocked = phaseExecute(tmpDir, 'billing-refresh');

    expect(blocked).toMatchObject({
      allowed: false,
      phase_id: 'billing-refresh',
      required_action: 'Complete senior-cycle gates before execution.',
      blockers: expect.arrayContaining([expect.objectContaining({ code: 'TEST_PLAN_REQUIRED' })])
    });

    testPlanFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    expect(phaseExecute(tmpDir, 'billing-refresh')).toMatchObject({
      allowed: true,
      phase_id: 'billing-refresh'
    });
  });

  it('blocks phase execution by default even before senior-cycle opt-in', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'unregistered-feature',
      title: 'Unregistered Feature',
      status: 'planned',
      source_ref: '.planning/ROADMAP.md',
      plans: []
    }];
    saveState(tmpDir, state);

    const blocked = phaseExecute(tmpDir, 'unregistered-feature');

    expect(blocked).toMatchObject({
      allowed: false,
      phase_id: 'unregistered-feature',
      required_action: 'Complete senior-cycle gates before execution.',
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'ALIGNMENT_REQUIRED' }),
        expect.objectContaining({ code: 'TEST_PLAN_REQUIRED' })
      ])
    });
  });

  it('reports senior-cycle next action before generic phase routing', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.workflow.active_feature = 'billing-refresh';
    state.senior_cycle = {
      active_feature: 'billing-refresh',
      features: {
        'billing-refresh': { feature_id: 'billing-refresh', tier: 'medium', artifacts: {} }
      }
    };
    state.roadmap.phases = [{
      id: 'billing-refresh',
      title: 'Billing Refresh',
      status: 'planned',
      source_ref: '.planning/ROADMAP.md',
      plans: []
    }];
    saveState(tmpDir, state);

    expect(nextWorkflow(tmpDir)).toMatchObject({
      command: 'terrace align billing-refresh',
      blocked: true,
      senior_cycle: expect.objectContaining({
        feature_id: 'billing-refresh',
        allowed: expect.objectContaining({ execute: false })
      })
    });
  });

  it('blocks phase completion until cleanup exists for Tier 2+ work', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'billing-refresh',
      title: 'Billing Refresh',
      status: 'review_ready',
      source_ref: '.planning/ROADMAP.md',
      plans: []
    }];
    saveState(tmpDir, state);
    alignFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    testPlanFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    observeFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    validateProdFeature(tmpDir, 'billing-refresh', { tier: 'medium' });

    expect(phaseComplete(tmpDir, 'billing-refresh')).toMatchObject({
      allowed: false,
      phase_id: 'billing-refresh',
      required_action: 'Complete senior-cycle cleanup before phase completion.',
      blockers: expect.arrayContaining([expect.objectContaining({ code: 'CLEANUP_REQUIRED' })])
    });

    cleanupFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    expect(phaseComplete(tmpDir, 'billing-refresh')).toMatchObject({
      allowed: true,
      phase_id: 'billing-refresh',
      status: 'completed'
    });
  });

  it('blocks quick execution without a test plan and completion without verification evidence', () => {
    const planned = quickPlan(tmpDir, 'Tight copy fix');

    expect(quickExecute(tmpDir, planned.item.id)).toMatchObject({
      allowed: false,
      item_id: planned.item.id,
      blockers: expect.arrayContaining([expect.objectContaining({ code: 'TEST_PLAN_REQUIRED' })])
    });

    testPlanFeature(tmpDir, planned.item.id, { tier: 'small' });
    expect(quickExecute(tmpDir, planned.item.id)).toMatchObject({
      allowed: true,
      item: expect.objectContaining({ status: 'red_required' })
    });
    expect(quickComplete(tmpDir, planned.item.id)).toMatchObject({
      allowed: false,
      item_id: planned.item.id,
      blockers: expect.arrayContaining([expect.objectContaining({ code: 'VERIFICATION_REQUIRED' })])
    });
  });

  it('includes senior-cycle ship blockers in ship check results', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.workflow.active_feature = 'billing-refresh';
    saveState(tmpDir, state);
    alignFeature(tmpDir, 'billing-refresh', { tier: 'medium' });
    testPlanFeature(tmpDir, 'billing-refresh', { tier: 'medium' });

    const result = shipCheck(tmpDir);

    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'senior_cycle',
      passed: false,
      blocking: expect.arrayContaining([
        expect.objectContaining({ code: 'OBSERVABILITY_REQUIRED' }),
        expect.objectContaining({ code: 'VALIDATION_REQUIRED' })
      ])
    }));
  }, 15000);

  it('creates UI/Stitch workflow artifacts for greenfield and brownfield UI work', () => {
    const imported = uiImportStitch(tmpDir, 'settings-refresh');
    const planned = uiPlanRefresh(tmpDir, 'settings-refresh');
    const diffed = uiDiff(tmpDir, 'settings-refresh');

    expect(imported.artifact).toBe('docs/terrace/features/settings-refresh/UI-STITCH.md');
    expect(planned.artifact).toBe('docs/terrace/features/settings-refresh/UI-REFRESH.md');
    expect(diffed.artifact).toBe('docs/terrace/features/settings-refresh/UI-DIFF.md');
    expect(fs.readFileSync(path.join(tmpDir, planned.artifact), 'utf-8')).toContain('Brownfield Refresh Plan');
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

  it('discovers project commands and treats missing quality scripts as warnings', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        lint: 'node -e "process.exit(0)"',
        build: 'node -e "process.exit(0)"'
      }
    }, null, 2), 'utf-8');
    const discovered = discoverProjectCommands(tmpDir);
    const result = shipCheck(tmpDir);

    expect(discovered).toMatchObject({
      package_manager: 'npm',
      scripts: expect.objectContaining({ lint: 'node -e "process.exit(0)"', build: 'node -e "process.exit(0)"' }),
      checks: expect.arrayContaining([
        expect.objectContaining({ category: 'lint', exists: true }),
        expect.objectContaining({ category: 'build', exists: true }),
        expect.objectContaining({ category: 'typecheck', exists: false })
      ])
    });
    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'typecheck',
      passed: true,
      warnings: [expect.objectContaining({ code: 'QUALITY_SCRIPT_MISSING' })]
    }));
    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'build',
      passed: true
    }));
  }, 15000);

  it('supports a fast ship check mode that skips project scripts', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        lint: 'node -e "process.exit(7)"',
        test: 'node -e "process.exit(7)"'
      }
    }, null, 2), 'utf-8');

    const result = shipCheck(tmpDir, { mode: 'fast' });

    expect(result.mode).toBe('fast');
    expect(result.timings.length).toBe(result.categories.length);
    expect(result.categories.map((category: { category: string }) => category.category)).not.toContain('lint');
    expect(result.categories.map((category: { category: string }) => category.category)).not.toContain('test');
    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'waivers',
      elapsed_ms: expect.any(Number)
    }));
  });

  it('runs an autonomous planning pass and stops at blockers', () => {
    const result = autonomousWorkflow(tmpDir);

    expect(result).toMatchObject({
      status: 'blocked',
      planned: { phase_id: 'phase-11-notifications' },
      execution: {
        allowed: false,
        required_action: 'Resolve blocking handoff actions before execution.'
      },
      next_command: 'terrace phase execute phase-11-notifications'
    });
  });

  it('routes plain text to stable Terrace commands for agents', () => {
    expect(routePlainText(tmpDir, 'plan phase 11')).toMatchObject({
      command: 'terrace phase plan phase-11-notifications',
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(routePlainText(tmpDir, '/gsd:plan-phase 11')).toMatchObject({
      command: 'terrace phase plan phase-11-notifications'
    });
    expect(routePlainText(tmpDir, 'run the next phase')).toMatchObject({
      command: 'terrace autonomous'
    });
    expect(routePlainText(tmpDir, 'show quick tasks')).toMatchObject({
      command: 'terrace quick list'
    });
    expect(routePlainText(tmpDir, 'create quick task refresh beta copy')).toMatchObject({
      command: 'terrace quick plan refresh beta copy',
      result: { item: expect.objectContaining({ title: 'refresh beta copy' }) }
    });
    expect(routePlainText(tmpDir, 'ship prepare')).toMatchObject({
      command: 'terrace ship prepare',
      result: { ship_ref: 'docs/terrace/ship/SHIP.md' }
    });
    expect(routePlainText(tmpDir, 'ship this')).toMatchObject({
      command: 'terrace ship check'
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
      'security',
      'tier_one_report',
      'migration_readiness',
      'senior_cycle',
      'production_preflight',
      'ai_review',
      'debt',
      'waivers',
      'documentation',
      'test_eval',
      'rule_audit',
      'typecheck',
      'lint',
      'test',
      'coverage',
      'package',
      'build',
      'dirty_tree'
    ]);
    expect(result.blockers.length).toBeGreaterThan(0);
  }, 15000);
});
