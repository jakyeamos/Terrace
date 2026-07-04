import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

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
  phaseCompleteWorkflow,
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
  shipCheck,
  releasePreflight,
  adoptionStatus,
  settingsSetEffort,
  settingsShow
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

  function writeReleasePreflightFixtures(version = '0.2.0', releaseDocsExtra = '') {
    fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      name: '@jakyeamos33/terrace',
      version,
      packageManager: 'pnpm@11.7.0',
      scripts: {
        ci: 'pnpm run typecheck && pnpm run lint && pnpm test && pnpm run test:coverage && pnpm run package:dry-run',
        package: 'pnpm run package:dry-run',
        'package:dry-run': 'node scripts/package-dry-run.cjs',
        'release:dry-run': 'pnpm publish --dry-run --access public --no-git-checks --config.node-linker=hoisted'
      },
      publishConfig: {
        access: 'public',
        provenance: true
      }
    }, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'package-dry-run.cjs'), "'use strict';\n", 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'ci.yml'), [
      'name: CI',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  verify:',
      '    steps:',
      '      - run: pnpm run ci',
      '      - run: pnpm audit --audit-level moderate'
    ].join('\n') + '\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'release-dry-run.yml'), [
      'name: Release Dry Run',
      'jobs:',
      '  release-dry-run:',
      '    steps:',
      '      - run: pnpm run ci',
      '      - run: pnpm audit --audit-level moderate',
      '      - run: pnpm run release:dry-run'
    ].join('\n') + '\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'release-publish.yml'), [
      'name: Release Publish',
      'permissions:',
      '  contents: read',
      '  id-token: write',
      'jobs:',
      '  publish:',
      '    environment: npm',
      '    steps:',
      '      - run: pnpm run ci',
      '      - run: pnpm audit --audit-level moderate',
      '      - run: pnpm run release:dry-run',
      '      - run: pnpm publish --access public --provenance --no-git-checks --config.node-linker=hoisted'
    ].join('\n') + '\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'RELEASE.md'), [
      '# Release Checklist',
      '',
      '1. Confirm npm trusted publishing with GitHub OIDC.',
      '2. Run `pnpm run ci`.',
      '3. Run `pnpm audit --audit-level moderate`.',
      '4. Run `pnpm package`.',
      '5. Run `pnpm run release:dry-run`.',
      '6. Run `node src/terrace-tools.cjs ship check --json`.',
      releaseDocsExtra
    ].filter(Boolean).join('\n') + '\n', 'utf-8');
  }

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
    settingsSetEffort(tmpDir, 'thorough');
    const planned = phasePlan(tmpDir, 'phase-11-notifications');

    expect(planned).toMatchObject({
      phase_id: 'phase-11-notifications',
      status: 'slice_planned',
      effort: 'thorough',
      next_command: 'terrace phase execute phase-11-notifications',
      source_refs: ['.planning/phases/11/11-01-PLAN.md']
    });
    expect(fs.existsSync(path.join(tmpDir, planned.plan_ref))).toBe(true);
    const plan = fs.readFileSync(path.join(tmpDir, planned.plan_ref), 'utf-8');
    expect(plan).toContain('Phase 11: Notifications');
    expect(plan).toContain('- Default: thorough');
    expect(plan).toContain('src/app/notifications/page.tsx');
    expect(phaseExecute(tmpDir, 'phase-11-notifications')).toMatchObject({
      allowed: false,
      effort: 'thorough',
      blockers: [expect.objectContaining({ description: 'Apply migration 034_prime_notes.sql' })]
    });
  });

  it('persists the phase effort default in Terrace settings', () => {
    expect(settingsShow(tmpDir).phase_effort_default).toBe('standard');
    expect(settingsSetEffort(tmpDir, 'fast')).toMatchObject({
      phase_effort_default: 'fast',
      config_path: '.terrace/config.json'
    });
    expect(settingsShow(tmpDir).phase_effort_default).toBe('fast');
    expect(() => settingsSetEffort(tmpDir, 'maximum')).toThrow(/Usage: terrace settings effort/);
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

  it('runs an end-to-end phase completion workflow until completion or blockers', () => {
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'phase-13-complete',
      title: 'Phase 13: Complete Workflow',
      status: 'planned',
      source_ref: '.planning/ROADMAP.md',
      plans: [{ id: '13-01', title: 'Complete Plan', status: 'planned', source_ref: '.planning/phases/13/13-01-PLAN.md' }]
    }];
    saveState(tmpDir, state);
    settingsSetEffort(tmpDir, 'thorough');
    alignFeature(tmpDir, 'phase-13-complete', { tier: 'medium' });
    testPlanFeature(tmpDir, 'phase-13-complete', { tier: 'medium' });
    observeFeature(tmpDir, 'phase-13-complete', { tier: 'medium' });
    validateProdFeature(tmpDir, 'phase-13-complete', { tier: 'medium' });
    cleanupFeature(tmpDir, 'phase-13-complete', { tier: 'medium' });

    const result = phaseCompleteWorkflow(tmpDir, 'phase-13-complete');

    expect(result).toMatchObject({
      status: 'completed',
      phase_id: 'phase-13-complete',
      effort: 'thorough',
      next_command: 'terrace ship check'
    });
    expect(result.steps.map((step: { command: string }) => step.command)).toEqual([
      'terrace phase plan phase-13-complete',
      'terrace phase execute phase-13-complete',
      'terrace phase validate phase-13-complete',
      'terrace phase review phase-13-complete',
      'terrace phase complete phase-13-complete'
    ]);
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
    const interrogated = interrogateFeature(tmpDir, featureId, {
      tier: 'large',
      userAnswers: 'User workflow: billing admins can refresh invoices safely.\nRollback trigger: failed invoice reconciliation.'
    });
    const mapped = mapCodebase(tmpDir);
    const designed = designFeature(tmpDir, featureId, { tier: 'large' });
    const tested = testPlanFeature(tmpDir, featureId, { tier: 'large' });
    const observed = observeFeature(tmpDir, featureId, { tier: 'large' });
    const validated = validateProdFeature(tmpDir, featureId, { tier: 'large' });
    const cleaned = cleanupFeature(tmpDir, featureId, { tier: 'large' });
    const after = seniorCycleStatus(tmpDir, featureId, 'large');

    expect(aligned.artifact).toBe('docs/terrace/features/billing-refresh/ALIGNMENT.md');
    expect(interrogated.artifact).toBe('docs/terrace/features/billing-refresh/INTERROGATION.md');
    expect(fs.readFileSync(path.join(tmpDir, interrogated.artifact), 'utf-8')).toContain('User workflow: billing admins can refresh invoices safely.');
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
  }, 120000);

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
  }, 120000);

  it('discovers project commands and treats missing quality scripts as warnings', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        lint: 'node -e "process.exit(0)"',
        build: 'node -e "process.exit(0)"',
        'dead-code': 'node -e "process.exit(0)"'
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
      ]),
      dead_code: expect.objectContaining({
        enabled: true,
        exists: true,
        script: 'dead-code',
        command: 'npm run dead-code'
      })
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
    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'dead_code',
      passed: true
    }));
  }, 120000);

  it('supports configured dead-code scripts and intentional dead-code skips', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        'unused:check': 'node -e "process.exit(0)"'
      }
    }, null, 2), 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'config.json'), JSON.stringify({
      ship_gates: {
        dead_code: {
          scripts: ['unused:check']
        }
      }
    }, null, 2) + '\n', 'utf-8');

    const configured = shipCheck(tmpDir);

    expect(configured.project_commands.dead_code).toMatchObject({
      configured: true,
      exists: true,
      script: 'unused:check',
      command: 'npm run unused:check'
    });
    expect(configured.categories).toContainEqual(expect.objectContaining({
      category: 'dead_code',
      passed: true
    }));

    fs.writeFileSync(path.join(tmpDir, '.terrace', 'config.json'), JSON.stringify({
      ship_gates: {
        dead_code: {
          enabled: false,
          reason: 'Generated client repo; source pruning is tracked upstream.'
        }
      }
    }, null, 2) + '\n', 'utf-8');

    const skipped = shipCheck(tmpDir);

    expect(skipped.project_commands.dead_code).toMatchObject({
      enabled: false,
      skipped: true,
      reason: 'Generated client repo; source pruning is tracked upstream.'
    });
    expect(skipped.categories).toContainEqual(expect.objectContaining({
      category: 'dead_code',
      passed: true,
      skipped: true,
      warnings: [expect.objectContaining({ code: 'DEAD_CODE_GATE_SKIPPED' })]
    }));
  }, 120000);

  it('blocks when a configured dead-code script is missing or fails', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        'dead-code': 'node -e "process.exit(9)"'
      }
    }, null, 2), 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'config.json'), JSON.stringify({
      ship_gates: {
        dead_code: {
          scripts: ['missing-dead-code']
        }
      }
    }, null, 2) + '\n', 'utf-8');

    const missing = shipCheck(tmpDir);

    expect(missing.categories).toContainEqual(expect.objectContaining({
      category: 'dead_code',
      passed: false,
      blocking: [expect.objectContaining({ code: 'DEAD_CODE_SCRIPT_MISSING' })]
    }));

    fs.writeFileSync(path.join(tmpDir, '.terrace', 'config.json'), JSON.stringify({
      ship_gates: {
        dead_code: {
          scripts: ['dead-code']
        }
      }
    }, null, 2) + '\n', 'utf-8');

    const failed = shipCheck(tmpDir);

    expect(failed.categories).toContainEqual(expect.objectContaining({
      category: 'dead_code',
      passed: false,
      blocking: [expect.objectContaining({ code: 'DEAD_CODE_GATE_FAILED' })]
    }));
  }, 120000);

  it('supports a fast ship check mode that skips project scripts', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        lint: 'node -e "process.exit(7)"',
        test: 'node -e "process.exit(7)"',
        'dead-code': 'node -e "process.exit(7)"'
      }
    }, null, 2), 'utf-8');

    const result = shipCheck(tmpDir, { mode: 'fast' });

    expect(result.mode).toBe('fast');
    expect(result.timings.length).toBe(result.categories.length);
    expect(result.categories.map((category: { category: string }) => category.category)).not.toContain('lint');
    expect(result.categories.map((category: { category: string }) => category.category)).not.toContain('test');
    expect(result.categories.map((category: { category: string }) => category.category)).not.toContain('dead_code');
    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'waivers',
      elapsed_ms: expect.any(Number)
    }));
  });

  it('includes trusted-publishing release guard for the Terrace npm release candidate', () => {
    writeReleasePreflightFixtures('0.2.0');

    const result = shipCheck(tmpDir, { mode: 'fast' });

    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'trusted_publishing',
      passed: true,
      release_target: '@jakyeamos33/terrace@0.2.0',
      manual_confirmation_required: true,
      manual_prerequisites: expect.arrayContaining([
        'npm package trusted publishing is configured for @jakyeamos33/terrace and the GitHub repository before publishing v0.2.0.',
        'GitHub environment `npm` has the intended reviewer protection before publish jobs can run.',
        'The GitHub Release is created for the reviewed v0.2.0 tag.'
      ]),
      warnings: [expect.objectContaining({ code: 'TRUSTED_PUBLISHING_MANUAL_REVIEW' })]
    }));
  });

  it('blocks the Terrace npm release candidate when trusted-publishing repo prerequisites are missing', () => {
    writeReleasePreflightFixtures('0.2.0');
    fs.writeFileSync(path.join(tmpDir, '.github', 'workflows', 'release-publish.yml'), [
      'name: Release Publish',
      'permissions:',
      '  contents: read',
      'jobs:',
      '  publish:',
      '    environment: npm',
      '    steps:',
      '      - run: pnpm publish --access public --provenance --no-git-checks --config.node-linker=hoisted'
    ].join('\n') + '\n', 'utf-8');

    const result = shipCheck(tmpDir, { mode: 'fast' });

    expect(result.categories).toContainEqual(expect.objectContaining({
      category: 'trusted_publishing',
      passed: false,
      blocking: [expect.objectContaining({ code: 'OIDC_PERMISSION' })]
    }));
    expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'OIDC_PERMISSION' }));
  });

  it('summarizes the Terrace 0.2.0 release preflight flow in static JSON', () => {
    writeReleasePreflightFixtures('0.2.0');

    const result = releasePreflight(tmpDir, {
      targetVersion: '0.2.0',
      runCommands: false,
      shipMode: 'fast'
    });

    expect(result).toMatchObject({
      command: 'terrace release-preflight',
      release: '0.2.0',
      flow: expect.arrayContaining([
        expect.objectContaining({ name: 'ci', command: 'pnpm run ci', present: true, ran: false, passed: true }),
        expect.objectContaining({ name: 'dependency_audit', command: 'pnpm audit --audit-level moderate', present: true }),
        expect.objectContaining({ name: 'package', command: 'pnpm package', present: true }),
        expect.objectContaining({ name: 'release_dry_run', command: 'pnpm run release:dry-run', present: true }),
        expect.objectContaining({ name: 'ship_check', command: 'terrace ship check --json', present: true })
      ]),
      trusted_publishing: expect.objectContaining({ passed: true }),
      tag_version: expect.objectContaining({
        package_version: '0.2.0',
        target_version: '0.2.0',
        expected_tag: 'v0.2.0',
        passed: true
      }),
      stale_release_artifacts: expect.objectContaining({ passed: true, findings: [] }),
      ship_check: expect.objectContaining({ mode: 'fast' })
    });
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'TRUSTED_PUBLISHING_MANUAL_REVIEW' }));
  });

  it('blocks release preflight on version mismatches and old npm-era release instructions', () => {
    writeReleasePreflightFixtures('0.1.0', '7. Run npm publish with NPM_TOKEN after npm whoami.');

    const result = releasePreflight(tmpDir, {
      targetVersion: '0.2.0',
      runCommands: false,
      shipMode: 'fast'
    });

    expect(result.tag_version).toMatchObject({
      passed: false,
      package_version: '0.1.0',
      target_version: '0.2.0',
      mismatches: [expect.objectContaining({ code: 'TARGET_VERSION_MISMATCH' })]
    });
    expect(result.stale_release_artifacts).toMatchObject({
      passed: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: 'NPM_TOKEN_REFERENCE', file: 'docs/RELEASE.md' }),
        expect.objectContaining({ code: 'NPM_PUBLISH_INSTRUCTION', file: 'docs/RELEASE.md' }),
        expect.objectContaining({ code: 'NPM_LOGIN_INSTRUCTION', file: 'docs/RELEASE.md' })
      ])
    });
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'TARGET_VERSION_MISMATCH' }),
      expect.objectContaining({ code: 'STALE_NPM_RELEASE_INSTRUCTION' })
    ]));
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

  it('routes natural-language intent and slash-shaped compatibility commands for agents', () => {
    process.env.TERRACE_ADOPTION_INSTALLED_VERSION = '0.0.0';
    expect(routePlainText(tmpDir, 'how far is Terrace from replacing GSD')).toMatchObject({
      command: 'terrace adoption status',
      result: {
        replacement: 'gsd',
        checks: expect.arrayContaining([
          expect.objectContaining({ name: 'version_alignment', passed: false })
        ])
      }
    });
    delete process.env.TERRACE_ADOPTION_INSTALLED_VERSION;
    expect(routePlainText(tmpDir, 'plan phase 11')).toMatchObject({
      command: 'terrace phase plan phase-11-notifications',
      result: { phase_id: 'phase-11-notifications' }
    });
    expect(routePlainText(tmpDir, '/gsd:plan-phase 11')).toMatchObject({
      command: 'terrace phase plan phase-11-notifications'
    });
    expect(routePlainText(tmpDir, '/execute-phase-complete 11')).toMatchObject({
      command: 'terrace execute-phase-complete phase-11-notifications',
      result: {
        status: 'blocked',
        phase_id: 'phase-11-notifications'
      }
    });
    expect(routePlainText(tmpDir, '/goal plan phase 11')).toMatchObject({
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
    const activeState = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));
    saveState(tmpDir, {
      ...activeState,
      workflow: {
        ...activeState.workflow,
        active_feature: 'billing-refresh'
      },
      senior_cycle: {
        active_feature: 'billing-refresh',
        features: {
          'billing-refresh': {
            feature_id: 'billing-refresh',
            tier: 'medium',
            artifacts: {}
          }
        }
      }
    });
    expect(routePlainText(tmpDir, 'make this feature ship-ready')).toMatchObject({
      command: 'terrace workbench prepare billing-refresh',
      result: {
        mode: 'prepare',
        feature_id: 'billing-refresh',
        artifacts: expect.objectContaining({
          preflight: 'docs/terrace/features/billing-refresh/PREFLIGHT.md',
          runbook: 'docs/terrace/features/billing-refresh/RUNBOOK.md'
        })
      }
    });
    expect(routePlainText(tmpDir, 'show me history')).toMatchObject({
      command: 'terrace history'
    });
    expect(() => routePlainText(tmpDir, 'make the app better somehow')).toThrow(/Unsupported plain-text Terrace command/);
  });

  it('reports adoption readiness gaps without mutating project state', () => {
    process.env.TERRACE_ADOPTION_INSTALLED_VERSION = '0.0.0';
    const before = fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8');

    const status = adoptionStatus(tmpDir);

    delete process.env.TERRACE_ADOPTION_INSTALLED_VERSION;
    expect(status).toMatchObject({
      command: 'terrace adoption status',
      replacement: 'gsd',
      question: 'Can Terrace replace GSD for me yet?',
      ready: false,
      recommended_mode: 'keep_gsd',
      answer: expect.stringContaining('No. Keep GSD available'),
      readiness_summary: expect.objectContaining({
        workflow_continuity: true,
        gsd_command_surface: expect.any(Number),
        agent_assets_complete: false,
        doctor_passed: true,
        audit_passed: true
      }),
      evidence: expect.objectContaining({
        migrated_context: expect.objectContaining({
          phase_count: 1,
          quick_task_count: 1,
          backlog_item_count: 1,
          blocked_action_count: 1,
          has_operational_history: true
        }),
        command_surface: expect.objectContaining({
          has_phase_aliases: true,
          has_quick_task_flow: true,
          has_natural_language_router: true
        })
      }),
      blockers: expect.arrayContaining([
        expect.objectContaining({ name: 'package_manager' }),
        expect.objectContaining({ name: 'version_alignment' }),
        expect.objectContaining({ name: 'agent_assets' })
      ]),
      next_steps: expect.arrayContaining([
        expect.objectContaining({
          command: 'terrace commands discover',
          fixes: ['package_manager']
        }),
        expect.objectContaining({
          command: 'terrace --version',
          fixes: ['version_alignment']
        }),
        expect.objectContaining({
          command: 'terrace init',
          fixes: ['agent_assets']
        })
      ]),
      next_commands: expect.arrayContaining(['terrace commands discover', 'terrace --version', 'terrace init'])
    });
    expect(status.checks).toContainEqual(expect.objectContaining({
      name: 'report_claim_scope',
      passed: true,
      evidence: expect.objectContaining({ claim_scope: 'delivery_readiness' })
    }));
    expect(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8')).toBe(before);
  });

  it('separates legacy planning phases from executable Terrace state phases', () => {
    process.env.TERRACE_ADOPTION_INSTALLED_VERSION = '0.2.0';
    const state = createDefaultState({ projectName: 'workflow-test' });
    saveState(tmpDir, state);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '## Phase 1: Bootstrap',
      '',
      '### Goal',
      '',
      'Create the initial workflow.',
      '',
      '## Phase 2: Release',
      '',
      '### Deliverables',
      '',
      '- Release it.'
    ].join('\n'), 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'docs', 'terrace', 'corpus'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'terrace', 'corpus', 'latest-results.json'), JSON.stringify({
      summary: {
        runId: 'test-run',
        totals: {
          commands: 2,
          pass: 2,
          expectedBlockers: 0,
          productWeaknesses: 0,
          harnessIssues: 0,
          skipped: 0
        }
      }
    }), 'utf-8');

    const status = adoptionStatus(tmpDir);
    delete process.env.TERRACE_ADOPTION_INSTALLED_VERSION;

    expect(status.checks).toContainEqual(expect.objectContaining({
      name: 'migrated_gsd_phase_coverage',
      passed: false,
      evidence: expect.objectContaining({
        state_phase_count: 0,
        planning_phase_count: 2,
        executable_phase_targets: false,
        planning_parity_passed: true
      })
    }));
    expect(status.next_commands).toContain('terrace port gsd --verify-parity');
  });

  it('prints adoption status as a practical replacement verdict', () => {
    process.env.TERRACE_ADOPTION_INSTALLED_VERSION = '0.0.0';
    const output = execFileSync('node', [
      path.join(__dirname, '..', 'src', 'terrace-tools.cjs'),
      'adoption',
      'status'
    ], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
    delete process.env.TERRACE_ADOPTION_INSTALLED_VERSION;

    expect(output).toContain('Can Terrace replace GSD for me yet?');
    expect(output).toContain('Answer: No. Keep GSD available');
    expect(output).toContain('Mode: keep_gsd');
    expect(output).toContain('Evidence:');
    expect(output).toContain('Workflow continuity: yes');
    expect(output).toContain('Next commands:');
    expect(output).toContain('terrace commands discover');
    expect(output).toContain('terrace --version');
    expect(output).toContain('terrace init');
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
      'dead_code',
      'dirty_tree'
    ]);
    expect(result.blockers.length).toBeGreaterThan(0);
  }, 120000);
});
