'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { beginPhaseStageRun, persistStageTransition, recoverStageRun } = require('./stage-state.cjs');
const { appendEvent } = require('./events.cjs');
const { phaseEffortDefault } = require('./config.cjs');
const { blocker, createStopPacket, guidanceError } = require('./guidance.cjs');
const { discoverProjectCommands } = require('./project-command-discovery.cjs');
const {
  createReleasePreflight,
  terracePackageReleaseTarget,
  trustedPublishingShipCheck
} = require('./release-preflight.cjs');
const { createShipReadiness } = require('./ship-readiness.cjs');
const { buildPhaseExecutionQueue } = require('./workflow-helpers.cjs');
const {
  seniorCycleStatus,
  seniorFeatureForState,
  activeSeniorFeature,
  seniorCycleShipCheck,
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
  uiDiff
} = require('./senior-cycle.cjs');
const { withManagedArtifactLock, writeProjectText } = require('./managed-artifacts.cjs');
const { reportUpdate } = require('./reporting.cjs');
const { resolveIntentCommand } = require('./intent-catalog.cjs');
const {
  prepareQualityRunner,
  preflightQualityRunner,
  reconcileQualityRunner,
  qualityRunnerBlocks
} = require('./quality-runner.cjs');

function nowIso() {
  return new Date().toISOString();
}

function safeResolve(cwd, relativeFilePath) {
  const root = path.resolve(cwd);
  const resolved = path.resolve(cwd, relativeFilePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('UNSAFE_PATH: generated artifact path is outside the project root');
  }
  return resolved;
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  writeProjectText(cwd, relativeFilePath, lines.join('\n') + '\n');
  return relativeFilePath;
}

function readTextIfExists(cwd, relativeFilePath) {
  if (!relativeFilePath) {
    return null;
  }
  const filePath = path.resolve(cwd, relativeFilePath);
  if (!filePath.startsWith(path.resolve(cwd) + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function firstLines(text, maxLines) {
  return String(text || '').split(/\r?\n/).slice(0, maxLines).join('\n').trim();
}

function extractLikelyFiles(text) {
  const matches = String(text || '').match(/[A-Za-z0-9_./()[\]-]+\.(?:ts|tsx|js|jsx|cjs|mjs|json|md|sql|css|scss|yml|yaml)/g) || [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function phasesFromState(state) {
  return state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
}

function findPhase(state, phaseId) {
  const phase = phasesFromState(state).find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  return phase;
}

function phaseRef(phase) {
  return 'docs/terrace/phases/' + phase.id;
}

function phaseContext(cwd, state, phase) {
  const plans = Array.isArray(phase.plans) ? phase.plans : [];
  const sourceRefs = plans
    .map((plan) => plan.source_ref)
    .filter((sourceRef) => typeof sourceRef === 'string' && sourceRef.length > 0);
  const sourceSnippets = sourceRefs.map((sourceRef) => {
    const content = readTextIfExists(cwd, sourceRef);
    return {
      source_ref: sourceRef,
      found: Boolean(content),
      snippet: content ? firstLines(content, 18) : ''
    };
  });
  const phaseNumberMatch = String(phase.title || phase.id).match(/phase\s+(\d+(?:\.\d+)?)/i);
  const phaseNumber = phaseNumberMatch ? phaseNumberMatch[1] : null;
  const quickTasks = quickTasksFromState(state).filter((item) => {
    const haystack = [item.title, item.source_dir, item.plan_ref, item.summary_ref].filter(Boolean).join(' ').toLowerCase();
    return phaseNumber ? haystack.includes('phase ' + phaseNumber) || haystack.includes('phase-' + phaseNumber) : haystack.includes(String(phase.id).toLowerCase());
  }).slice(0, 8);
  const likelyFiles = Array.from(new Set(sourceSnippets.flatMap((item) => extractLikelyFiles(item.snippet))));
  return {
    plans,
    source_refs: sourceRefs,
    source_snippets: sourceSnippets,
    quick_tasks: quickTasks,
    likely_files: likelyFiles
  };
}

function effortGuidance(effort) {
  if (effort === 'fast') {
    return [
      '- Use the narrowest plan that can satisfy stated acceptance criteria.',
      '- Prefer existing tests and targeted verification before broader exploratory work.'
    ];
  }
  if (effort === 'thorough') {
    return [
      '- Expand source review to adjacent files, historical plans, and failure modes before implementation.',
      '- Include adversarial review, security implications, regression risk, and release evidence before completion.'
    ];
  }
  return [
    '- Cover migrated context, likely files, required gates, and focused regression risk.',
    '- Escalate to thorough handling only when the phase changes shared contracts or release-critical behavior.'
  ];
}

function qualityRunnerPlanLines(qualityRunner) {
  if (!qualityRunner || qualityRunner.enabled !== true) {
    return [];
  }
  const obligations = Array.isArray(qualityRunner.obligations) ? qualityRunner.obligations : [];
  const verificationCommands = Array.from(new Set(
    Array.isArray(qualityRunner.verification_commands) ? qualityRunner.verification_commands : []
  ));
  const performance = qualityRunner.performance && typeof qualityRunner.performance === 'object'
    ? qualityRunner.performance
    : {};
  return [
    '',
    '## Quality Runner Delivery Contract',
    '- Status: ' + (qualityRunner.status || 'unknown'),
    '- Contract: ' + (qualityRunner.contract_path || 'unavailable'),
    '- Contract ID: ' + (qualityRunner.contract_id || 'unavailable'),
    '- Analysis mode: ' + (qualityRunner.analysis_mode || 'balanced'),
    '- Cache mode: ' + (qualityRunner.cache_mode || 'external'),
    '- Latency budget: ' + String(qualityRunner.latency_budget_seconds || 30) + ' seconds',
    '- Performance receipt: ' + (performance.status || 'unavailable'),
    ...(qualityRunner.package_manager_conflict
      ? ['- Package-manager conflict: ' + qualityRunner.package_manager_conflict.message]
      : []),
    '### Obligations',
    ...(obligations.length > 0
      ? obligations.map((item) => '- [' + (item.kind || 'advisory') + '] ' + (item.id || 'unknown') + ': ' + (item.title || 'follow contract acceptance criteria'))
      : ['- No obligations were returned by Quality Runner.']),
    '### Verification Commands',
    ...(verificationCommands.length > 0 ? verificationCommands.map((command) => '- ' + command) : ['- Use the evidence commands recorded in the contract.']),
    '### Delivery Result',
    '- Write one structured result to `' + (qualityRunner.result_file || 'QUALITY-RUNNER-RESULT.json') + '` before validation.',
    '- Stale fingerprints, missing hard evidence, uncovered obligations, and deferred hard checks block completion.'
  ];
}

function planLinesForPhase(phase, blockers, context, discovered, effort, qualityRunner) {
  const ctx = context || { plans: [], source_refs: [], source_snippets: [], quick_tasks: [], likely_files: [] };
  const criteria = Array.isArray(phase.success_criteria) ? phase.success_criteria : [];
  const commands = discovered && Array.isArray(discovered.checks)
    ? discovered.checks.filter((check) => check.exists).map((check) => check.command)
    : [];
  return [
    '# ' + phase.title,
    '',
    '## Objective',
    'Execute `' + phase.id + '` with Terrace gates and preserved GSD context.',
    '',
    '## Source',
    '- Phase source: ' + (phase.source_ref || 'Terrace roadmap'),
    '- Existing plan count: ' + String(ctx.plans.length),
    '',
    '## Existing Plans',
    ...(ctx.plans.length > 0 ? ctx.plans.map((plan) => '- ' + (plan.title || plan.id) + ' (' + (plan.source_ref || plan.id || 'no source') + ')') : ['- No migrated plans were attached.']),
    '',
    '## Effort',
    '- Default: ' + effort,
    ...effortGuidance(effort),
    '',
    '## Migrated Context',
    ...(ctx.source_snippets.length > 0 ? ctx.source_snippets.flatMap((item) => [
      '### ' + item.source_ref,
      item.found ? '```md' : '',
      item.found ? item.snippet : 'Not found in this repo copy.',
      item.found ? '```' : ''
    ]) : ['- No source artifacts were attached to this phase.']),
    '',
    '## Likely Files',
    ...(ctx.likely_files.length > 0 ? ctx.likely_files.map((filePath) => '- ' + filePath) : ['- No likely files detected from migrated artifacts.']),
    '',
    '## Related Quick Tasks',
    ...(ctx.quick_tasks.length > 0 ? ctx.quick_tasks.map((item) => '- ' + item.id + ': ' + item.title) : ['- No related quick tasks detected.']),
    '',
    '## Execution Waves',
    '- Wave 1: inspect migrated context, confirm assumptions, and write or update RED tests.',
    '- Wave 2: execute attached plans in order, keeping each change tied to a source artifact.',
    '- Wave 3: run validation commands, review the diff, update state, and prepare completion notes.',
    '',
    '## Acceptance Criteria',
    ...(criteria.length > 0 ? criteria.map((item) => '- ' + item) : ['- Typecheck, lint, tests, audit, and ship checks are deterministic.']),
    '',
    '## Project Commands',
    ...(commands.length > 0 ? commands.map((command) => '- ' + command) : ['- No executable project quality scripts were discovered.']),
    ...qualityRunnerPlanLines(qualityRunner),
    '',
    '## Blockers',
    ...(blockers.length > 0 ? blockers.map((item) => '- BLOCKING: ' + item.description) : ['- None recorded.']),
    '',
    '## Next Commands',
    '- terrace phase execute ' + phase.id,
    '- terrace phase validate ' + phase.id,
    '- terrace phase review ' + phase.id,
    '- terrace phase complete ' + phase.id
  ];
}

function updatePhase(state, phaseId, fields) {
  return {
    ...state,
    roadmap: {
      ...state.roadmap,
      phases: phasesFromState(state).map((phase) => phase.id === phaseId ? { ...phase, ...fields } : phase)
    }
  };
}

function executionLinesForPhase(phase, queue, discovered, effort) {
  return [
    '# Execution Queue: ' + phase.title,
    '',
    '## Mode',
    '- Terrace prepares an execution queue and gate evidence; product-code edits remain explicit agent work.',
    '',
    '## Effort',
    '- Default: ' + effort,
    ...effortGuidance(effort),
    '',
    '## Tasks',
    ...queue.flatMap((task) => [
      '### ' + task.id + ': ' + task.title,
      '- Source: ' + (task.source_ref || 'Terrace generated'),
      '- Status: ' + task.status,
      '- Wave: ' + String(task.wave),
      '- Agent prompt: ' + task.agent_prompt,
      '- Likely files: ' + (task.likely_files.length > 0 ? task.likely_files.join(', ') : 'none detected'),
      '- Validation: ' + (task.validation_commands.length > 0 ? task.validation_commands.join(' && ') : 'no project scripts discovered')
    ]),
    '',
    '## Project Commands',
    ...discovered.checks.map((check) => '- ' + check.category + ': ' + (check.exists ? check.command : 'missing; suggested ' + check.suggested)),
    '',
    '## Next Command',
    '- terrace phase validate ' + phase.id
  ];
}

function quickTasksFromState(state) {
  return Array.isArray(state.quick_tasks) ? state.quick_tasks : [];
}

function quickTaskRef(itemId) {
  return 'docs/terrace/quick/' + itemId;
}

function nextQuickId(items) {
  let counter = items.length + 1;
  let candidate = 'terrace-quick-' + String(counter);
  const existing = new Set(items.map((item) => item.id));
  while (existing.has(candidate)) {
    counter += 1;
    candidate = 'terrace-quick-' + String(counter);
  }
  return candidate;
}

function findQuickTask(state, itemId) {
  const item = quickTasksFromState(state).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('Unknown quick task: ' + itemId);
  }
  return item;
}

function updateQuickTask(state, itemId, fields) {
  return {
    ...state,
    quick_tasks: quickTasksFromState(state).map((item) => item.id === itemId ? { ...item, ...fields } : item)
  };
}

function findPhaseByText(state, text) {
  const match = text.match(/(?:phase|plan-phase|execute-phase|validate-phase|review-phase|complete-phase|execute-phase-complete|phase-complete-workflow)\s+([a-z0-9_.-]+)/i);
  if (!match) {
    return null;
  }
  const token = match[1].toLowerCase();
  return phasesFromState(state).find((phase) => {
    if (String(phase.id || '').toLowerCase() === token) {
      return true;
    }
    const titleMatch = String(phase.title || '').match(/phase\s+(\d+(?:\.\d+)?)/i);
    return titleMatch && titleMatch[1] === token;
  }) || null;
}

const { dirtyTreeCheck, shipCheck, shipPrepare } = createShipReadiness({
  seniorCycleShipCheck,
  terracePackageReleaseTarget,
  trustedPublishingShipCheck
});

const releasePreflight = createReleasePreflight({
  dirtyTreeCheck,
  shipCheck
});

function verificationBlocker(artifact) {
  return blocker({
    code: 'VERIFICATION_REQUIRED',
    artifact,
    message: 'No completion without verification evidence.',
    why_blocked: 'Completion requires evidence that the planned behavior was verified.',
    next_command: 'terrace quick complete <quick-task-id>',
    remediation: 'Write verification evidence before completing this quick task.'
  });
}

function phaseList(cwd) {
  const state = loadState(cwd);
  return {
    phases: phasesFromState(state)
  };
}

function phaseShow(cwd, phaseId) {
  return { phase: findPhase(loadState(cwd), phaseId) };
}

function phasePlan(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const context = phaseContext(cwd, state, phase);
  const discovered = discoverProjectCommands(cwd);
  const effort = phaseEffortDefault(cwd);
  const planRef = phaseRef(phase) + '/PLAN.md';
  const qualityRunner = prepareQualityRunner(cwd, phase, context);
  writeMarkdown(cwd, planRef, planLinesForPhase(phase, blockers, context, discovered, effort, qualityRunner));
  const plannedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'planned',
      plan_ref: planRef,
      planned_at: plannedAt,
      effort,
      source_refs: context.source_refs,
      likely_files: context.likely_files,
      quality_runner: qualityRunner,
      next_command: 'terrace phase execute ' + phase.id
    }),
    workflow: {
      ...state.workflow,
      status: 'slice_planned',
      active_feature: phase.id
    },
    active_slice: {
      id: phase.id,
      title: phase.title,
      source_ref: phase.source_ref,
      plans: phase.plans || [],
      spec_refs: phase.spec_refs || [],
      success_criteria: phase.success_criteria || [],
      test_intent: []
    }
  };
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'slice_planned',
    plan_ref: planRef,
    source_refs: context.source_refs,
    likely_files: context.likely_files,
    related_quick_tasks: context.quick_tasks,
    effort,
    blocked: blockers.length > 0,
    blockers,
    quality_runner: qualityRunner,
    next_command: 'terrace phase execute ' + phase.id,
    active_slice: nextState.active_slice
  };
}

function phaseExecute(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const context = phaseContext(cwd, state, phase);
  const discovered = discoverProjectCommands(cwd);
  const effort = phaseEffortDefault(cwd);
  const queue = buildPhaseExecutionQueue(phase, context, discovered);
  if (blockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      effort,
      queue,
      blockers,
      required_action: 'Resolve blocking handoff actions before execution.'
    };
  }
  const seniorFeature = seniorFeatureForState(state, phase.id, 'medium');
  const seniorGate = seniorCycleStatus(cwd, phase.id, seniorFeature.tier);
  if (!seniorGate.allowed.execute) {
    return {
      allowed: false,
      phase_id: phase.id,
      effort,
      queue,
      blockers: seniorGate.blockers,
      senior_cycle: seniorGate,
      required_action: 'Complete senior-cycle gates before execution.'
    };
  }
  const qualityRunnerPreflight = preflightQualityRunner(
    cwd,
    phase,
    phase.plan_ref || phaseRef(phase) + '/PLAN.md'
  );
  const qualityRunnerPreflightBlockers = qualityRunnerBlocks(qualityRunnerPreflight);
  if (qualityRunnerPreflightBlockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      effort,
      queue,
      blockers: qualityRunnerPreflightBlockers,
      quality_runner: {
        ...(phase.quality_runner || { enabled: true }),
        preflight: qualityRunnerPreflight
      },
      required_action: 'Resolve Quality Runner contract preflight blockers before execution.'
    };
  }
  const startedAt = nowIso();
  const waves = [
    { id: 'red', status: 'required', command: 'terrace phase validate ' + phase.id },
    { id: 'implementation', status: 'pending', command: 'terrace phase review ' + phase.id },
    { id: 'completion', status: 'pending', command: 'terrace phase complete ' + phase.id }
  ];
  const executionRef = phaseRef(phase) + '/EXECUTION.md';
  writeMarkdown(cwd, executionRef, executionLinesForPhase(phase, queue, discovered, effort));
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'executing',
      execution_started_at: startedAt,
      execution_ref: executionRef,
      effort,
      execution: {
        status: 'red_required',
        queue,
        waves
      },
      quality_runner: {
        ...(phase.quality_runner || { enabled: false }),
        preflight: qualityRunnerPreflight
      },
      next_command: 'terrace phase validate ' + phase.id
    }),
    workflow: {
      ...state.workflow,
      status: 'red_required',
      active_feature: phase.id
    },
    active_slice: state.active_slice && state.active_slice.id === phase.id ? state.active_slice : {
      id: phase.id,
      title: phase.title,
      source_ref: phase.source_ref,
      plans: phase.plans || [],
      spec_refs: phase.spec_refs || [],
      success_criteria: phase.success_criteria || [],
      test_intent: []
    }
  };
  saveState(cwd, nextState);
  return {
    allowed: true,
    phase_id: phase.id,
    effort,
    status: 'red_required',
    execution_ref: executionRef,
    queue,
    waves,
    quality_runner: {
      ...(phase.quality_runner || { enabled: false }),
      preflight: qualityRunnerPreflight
    },
    next_action: 'Add RED evidence before implementation.'
  };
}

function phaseValidate(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const discovered = discoverProjectCommands(cwd);
  const commands = discovered.checks.filter((check) => check.exists).map((check) => check.command);
  const qualityRunnerReconciliation = reconcileQualityRunner(cwd, phase);
  const qualityRunnerReconciliationBlockers = qualityRunnerBlocks(qualityRunnerReconciliation);
  if (qualityRunnerReconciliationBlockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers: qualityRunnerReconciliationBlockers,
      quality_runner: {
        ...(phase.quality_runner || { enabled: true }),
        reconciliation: qualityRunnerReconciliation
      },
      required_action: 'Resolve Quality Runner delivery reconciliation blockers before validation.'
    };
  }
  const validationRef = phaseRef(phase) + '/VALIDATION.md';
  writeMarkdown(cwd, validationRef, [
    '# Validation: ' + phase.title,
    '',
    '## Required Evidence',
    '- RED evidence exists before implementation work is marked complete.',
    '- Typecheck, lint, tests, and audit are run before phase completion.',
    '',
    '## Commands',
    ...(commands.length > 0 ? commands.map((command) => '- ' + command) : ['- No project quality scripts were discovered.']),
    '- terrace audit',
    '',
    '## Missing Script Recommendations',
    ...discovered.checks.filter((check) => !check.exists).map((check) => '- ' + check.category + ': add `' + check.script + '` such as `' + check.suggested + '`.'),
    '',
    '## Next Command',
    '- terrace phase review ' + phase.id
  ]);
  const nextState = updatePhase(state, phase.id, {
    status: 'validation_ready',
    validation_ref: validationRef,
    validated_at: nowIso(),
    quality_runner: {
      ...(phase.quality_runner || { enabled: false }),
      reconciliation: qualityRunnerReconciliation
    },
    next_command: 'terrace phase review ' + phase.id
  });
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'validation_ready',
    validation_ref: validationRef,
    quality_runner: qualityRunnerReconciliation,
    next_command: 'terrace phase review ' + phase.id
  };
}

function phaseReview(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const qualityRunner = phase.quality_runner;
  if (qualityRunner && qualityRunner.enabled === true && (!qualityRunner.reconciliation || qualityRunner.reconciliation.status !== 'reconciled')) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers: qualityRunnerBlocks(qualityRunner.reconciliation || {
        enabled: true,
        status: 'blocked',
        blockers: [{ code: 'QR_RECONCILIATION_MISSING', description: 'Quality Runner reconciliation is required before review.' }]
      }),
      required_action: 'Reconcile the Quality Runner delivery result before review.'
    };
  }
  const reviewRef = phaseRef(phase) + '/REVIEW.md';
  writeMarkdown(cwd, reviewRef, [
    '# Review: ' + phase.title,
    '',
    '## Review Checklist',
    '- Diff is scoped to the phase objective.',
    '- Tests prove the behavior and failure modes.',
    '- State, docs, and migration notes are current.',
    '- No user-authored files are overwritten without intent.',
    '',
    '## Next Command',
    '- terrace phase complete ' + phase.id
  ]);
  const nextState = updatePhase(state, phase.id, {
    status: 'review_ready',
    review_ref: reviewRef,
    reviewed_at: nowIso(),
    next_command: 'terrace phase complete ' + phase.id
  });
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'review_ready',
    review_ref: reviewRef,
    next_command: 'terrace phase complete ' + phase.id
  };
}

function phaseComplete(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const qualityRunner = phase.quality_runner;
  if (qualityRunner && qualityRunner.enabled === true && (!qualityRunner.reconciliation || qualityRunner.reconciliation.status !== 'reconciled')) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers: qualityRunnerBlocks(qualityRunner.reconciliation || {
        enabled: true,
        status: 'blocked',
        blockers: [{ code: 'QR_RECONCILIATION_MISSING', description: 'Quality Runner reconciliation is required before completion.' }]
      }),
      required_action: 'Reconcile the Quality Runner delivery result before completion.'
    };
  }
  const seniorFeature = seniorFeatureForState(state, phase.id, 'medium');
  const seniorGate = seniorCycleStatus(cwd, phase.id, seniorFeature.tier);
  if (!seniorGate.allowed.complete) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers: seniorGate.blockers.filter((blocker) => blocker.code === 'CLEANUP_REQUIRED'),
      senior_cycle: seniorGate,
      required_action: 'Complete senior-cycle cleanup before phase completion.'
    };
  }
  const summaryRef = phaseRef(phase) + '/SUMMARY.md';
  writeMarkdown(cwd, summaryRef, [
    '# Summary: ' + phase.title,
    '',
    '## Completed Work',
    '- Phase marked complete through Terrace workflow state.',
    '',
    '## Evidence',
    '- Plan: ' + (phase.plan_ref || phaseRef(phase) + '/PLAN.md'),
    '- Validation: ' + (phase.validation_ref || phaseRef(phase) + '/VALIDATION.md'),
    '- Review: ' + (phase.review_ref || phaseRef(phase) + '/REVIEW.md'),
    '',
    '## Follow-up',
    '- Run terrace ship check before release.'
  ]);
  const completedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'completed',
      summary_ref: summaryRef,
      completed_at: completedAt,
      next_command: 'terrace ship check'
    }),
    workflow: {
      ...state.workflow,
      status: 'protected',
      active_feature: phase.id
    }
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace phase complete ' + phase.id });
  return {
    allowed: true,
    phase_id: phase.id,
    status: 'completed',
    summary_ref: summaryRef,
    next_command: 'terrace ship check'
  };
}

function resumeWorkflow(cwd) {
  const state = loadState(cwd);
  const handoff = state.handoff || {};
  const stageRun = recoverStageRun(cwd);
  return {
    status: stageRun && stageRun.stop_packet ? 'blocked' : (handoff.status || state.workflow.status),
    next_action: handoff.next_action || null,
    phase: handoff.phase || null,
    blocked_actions: state.blocked_actions || [],
    sessions: state.sessions || [],
    stop_packet: stageRun ? stageRun.stop_packet : null,
    stage_run: stageRun
  };
}

function nextWorkflow(cwd) {
  const state = loadState(cwd);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const migrationCommand = state.migration && state.migration.next_command;
  const seniorFeature = activeSeniorFeature(state);
  if (seniorFeature) {
    const seniorGate = seniorCycleStatus(cwd, seniorFeature.feature_id, seniorFeature.tier);
    if (seniorGate.blockers.length > 0) {
      return {
        command: seniorGate.next_command,
        blocked: true,
        blockers: [...blockers, ...seniorGate.blockers],
        next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null,
        senior_cycle: seniorGate
      };
    }
    if (!migrationCommand && seniorFeature.opted_in) {
      const activePhase = phasesFromState(state).find((phase) => phase.id === seniorFeature.feature_id);
      const nextCommand = activePhase
        ? 'terrace phase show ' + activePhase.id
        : 'terrace workbench status --feature ' + seniorFeature.feature_id;
      const activeFeatureHandoff = blocker({
        code: activePhase ? 'ACTIVE_FEATURE_REQUIRES_EXPLICIT_PHASE_ACTION' : 'ACTIVE_FEATURE_NOT_ROADMAP_PHASE',
        feature_id: seniorFeature.feature_id,
        message: activePhase
          ? 'The active senior-cycle feature is a roadmap phase and requires an explicit phase action.'
          : 'The active senior-cycle feature is not a roadmap phase, so automatic phase execution is unavailable.',
        why_blocked: activePhase
          ? 'Automatically replanning the active phase could overwrite its lifecycle state or artifacts.'
          : 'Selecting the first roadmap phase would replace the active feature and could write unrelated planning artifacts.',
        next_command: nextCommand,
        remediation: activePhase
          ? 'Review the active phase, then use an explicit phase command when a mutation is intended.'
          : 'Use the feature workbench or explicitly select a roadmap phase before running autonomous phase execution.'
      });
      return {
        command: nextCommand,
        blocked: true,
        blockers: [...blockers, activeFeatureHandoff],
        next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null,
        senior_cycle: seniorGate,
        active_feature_handoff: activeFeatureHandoff
      };
    }
  }
  const nextCommand = migrationCommand
    ? migrationCommand
    : inferNextCommand(state);
  return {
    command: nextCommand,
    blocked: blockers.length > 0,
    blockers,
    next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null
  };
}

function inferNextCommand(state) {
  const action = state.handoff && state.handoff.next_action ? state.handoff.next_action : '';
  const phaseMatch = action.match(/phase\s+(\d+(?:\.\d+)?)/i);
  if (phaseMatch && state.roadmap && Array.isArray(state.roadmap.phases)) {
    const phase = state.roadmap.phases.find((candidate) => {
      const titleMatch = String(candidate.title || '').match(/phase\s+(\d+(?:\.\d+)?)/i);
      return titleMatch && Number(titleMatch[1]) === Number(phaseMatch[1]);
    });
    if (phase) {
      return 'terrace phase show ' + phase.id;
    }
  }
  const phase = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases[0] : null;
  return phase ? 'terrace phase show ' + phase.id : 'terrace doctor';
}

function backlogList(cwd) {
  const state = loadState(cwd);
  return {
    items: state.backlog && Array.isArray(state.backlog.items) ? state.backlog.items : []
  };
}

function backlogAdd(cwd, title) {
  if (!title) {
    throw new Error('Usage: terrace backlog add <title>');
  }
  const state = loadState(cwd);
  const backlog = state.backlog && Array.isArray(state.backlog.items) ? state.backlog : { items: [] };
  const item = {
    id: 'backlog-' + String(backlog.items.length + 1),
    title,
    status: 'open',
    source_ref: 'terrace backlog add'
  };
  backlog.items.push(item);
  state.backlog = backlog;
  saveState(cwd, state);
  return { item, items: backlog.items };
}

function blockerId(item, index) {
  const source = item.id || item.description || ('blocker-' + String(index + 1));
  const normalized = String(source).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || ('blocker-' + String(index + 1));
}

function blockerList(cwd) {
  const state = loadState(cwd);
  return {
    items: (state.blocked_actions || []).map((item, index) => ({
      ...item,
      id: blockerId(item, index)
    }))
  };
}

function blockerResolve(cwd, id, options) {
  const opts = options || {};
  if (!id) {
    throw new Error('Usage: terrace blocker resolve <id> --owner <owner> --evidence <ref>');
  }
  if (!opts.owner) {
    throw new Error('BLOCKER_OWNER_REQUIRED: pass --owner <owner> to identify who verified the correction.');
  }
  if (!opts.evidence) {
    throw new Error('BLOCKER_EVIDENCE_REQUIRED: pass --evidence <ref> to preserve correction evidence.');
  }
  const evidencePath = safeResolve(cwd, opts.evidence);
  if (!fs.existsSync(evidencePath) || !fs.statSync(evidencePath).isFile()) {
    throw new Error('BLOCKER_EVIDENCE_NOT_FOUND: --evidence must reference an existing repo-local file.');
  }
  const state = loadState(cwd);
  const items = state.blocked_actions || [];
  const index = items.findIndex((item, itemIndex) => blockerId(item, itemIndex) === id);
  if (index < 0) {
    throw new Error('Unknown blocker: ' + id);
  }
  if (items[index].blocking === false) {
    throw new Error('Blocker already resolved: ' + id);
  }
  const timestamp = nowIso();
  const resolvedItem = {
    ...items[index],
    id,
    blocking: false,
    status: 'resolved',
    resolution: {
      owner: opts.owner,
      evidence_ref: opts.evidence,
      resolved_at: timestamp
    }
  };
  state.blocked_actions = items.map((item, itemIndex) => itemIndex === index ? resolvedItem : item);
  if (state.backlog && Array.isArray(state.backlog.items)) {
    state.backlog.items = state.backlog.items.map((item) => {
      const sameSource = item.source_ref && item.source_ref === resolvedItem.source_ref;
      const sameTitle = item.title && item.title === resolvedItem.description;
      return sameSource && sameTitle ? { ...item, status: 'resolved', resolved_at: timestamp } : item;
    });
  }
  saveState(cwd, state);
  appendEvent(cwd, {
    event_type: 'blocker_resolved',
    command: 'terrace blocker resolve ' + id,
    blocker_id: id,
    result: 'resolved',
    owner: opts.owner,
    evidence_refs: [opts.evidence],
    timestamp
  });
  const stageRun = recoverStageRun(cwd);
  return {
    status: 'resolved',
    item: resolvedItem,
    stage_run: stageRun,
    next_command: stageRun && stageRun.phase_id
      ? 'terrace execute-phase-complete ' + stageRun.phase_id
      : 'terrace next'
  };
}

function quickList(cwd) {
  const state = loadState(cwd);
  return {
    items: quickTasksFromState(state)
  };
}

function quickShow(cwd, itemId) {
  const item = quickList(cwd).items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('Unknown quick task: ' + itemId);
  }
  return { item };
}

function quickPlan(cwd, title) {
  if (!title) {
    throw new Error('Usage: terrace quick plan <title>');
  }
  const state = loadState(cwd);
  const items = quickTasksFromState(state);
  const itemId = nextQuickId(items);
  const planRef = quickTaskRef(itemId) + '/PLAN.md';
  const item = {
    id: itemId,
    title,
    status: 'planned',
    source_ref: 'terrace quick plan',
    plan_ref: planRef,
    created_at: nowIso(),
    next_command: 'terrace quick execute ' + itemId
  };
  writeMarkdown(cwd, planRef, [
    '# Quick Task: ' + title,
    '',
    '## Intent',
    'Complete a tightly scoped task with Terrace state tracking.',
    '',
    '## Guardrails',
    '- Keep the diff atomic.',
    '- Run the smallest relevant verification before completion.',
    '- No Band-Aid Rule: choose the maintainable path by default, even for quick work.',
    '- Confirm the choice enables future development and expansion before executing.',
    '',
    '## Next Command',
    '- terrace quick execute ' + itemId
  ]);
  const nextState = {
    ...state,
    quick_tasks: [...items, item],
    workflow: {
      ...state.workflow,
      active_feature: itemId
    }
  };
  saveState(cwd, nextState);
  return {
    item,
    next_command: item.next_command
  };
}

function quickExecute(cwd, itemId) {
  const state = loadState(cwd);
  findQuickTask(state, itemId);
  const seniorGate = seniorCycleStatus(cwd, itemId, 'small');
  if (!seniorGate.allowed.execute) {
    return {
      allowed: false,
      item_id: itemId,
      blockers: seniorGate.blockers,
      senior_cycle: seniorGate,
      required_action: 'Complete quick-task test plan before execution.'
    };
  }
  const nextCommand = 'terrace quick complete ' + itemId;
  const nextState = updateQuickTask(state, itemId, {
    status: 'red_required',
    execution_started_at: nowIso(),
    next_command: nextCommand
  });
  nextState.workflow = {
    ...state.workflow,
    status: 'red_required',
    active_feature: itemId
  };
  saveState(cwd, nextState);
  return {
    allowed: true,
    item: findQuickTask(nextState, itemId),
    next_command: nextCommand
  };
}

function quickComplete(cwd, itemId) {
  const state = loadState(cwd);
  const item = findQuickTask(state, itemId);
  const verificationRef = item.verification_ref || quickTaskRef(itemId) + '/VERIFICATION.md';
  if (!fs.existsSync(path.resolve(cwd, verificationRef))) {
    return {
      allowed: false,
      item_id: itemId,
      blockers: [verificationBlocker(verificationRef)],
      required_action: 'Add quick-task verification evidence before completion.'
    };
  }
  const summaryRef = quickTaskRef(itemId) + '/SUMMARY.md';
  writeMarkdown(cwd, summaryRef, [
    '# Quick Task Summary: ' + item.title,
    '',
    '## Result',
    '- Quick task marked complete through Terrace workflow state.',
    '',
    '## Evidence',
    '- Plan: ' + (item.plan_ref || quickTaskRef(itemId) + '/PLAN.md'),
    '',
    '## Follow-up',
    '- Run terrace ship check when preparing a release.'
  ]);
  const nextState = updateQuickTask(state, itemId, {
    status: 'completed',
    summary_ref: summaryRef,
    completed_at: nowIso(),
    next_command: 'terrace ship check'
  });
  nextState.workflow = {
    ...state.workflow,
    status: 'protected',
    active_feature: itemId
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace quick complete ' + itemId });
  return {
    allowed: true,
    item: findQuickTask(nextState, itemId),
    next_command: 'terrace ship check'
  };
}

function historySummary(cwd) {
  const state = loadState(cwd);
  const quickTasks = Array.isArray(state.quick_tasks) ? state.quick_tasks : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const decisions = Array.isArray(state.decisions) ? state.decisions : [];
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  return {
    quick_tasks: {
      total: quickTasks.length,
      completed: quickTasks.filter((item) => item.status === 'completed').length
    },
    sessions: {
      total: sessions.length
    },
    decisions: {
      total: decisions.length
    },
    phases: {
      total: phases.length,
      with_plans: phases.filter((phase) => Array.isArray(phase.plans) && phase.plans.length > 0).length
    },
    recent_quick_tasks: quickTasks.slice(-5).reverse(),
    recent_sessions: sessions.slice(-5).reverse()
  };
}

function phaseIdFromCommand(command) {
  const match = String(command || '').match(/terrace\s+phase\s+(?:show|plan|execute|validate|review|complete)\s+([^\s]+)/);
  return match ? match[1] : null;
}

function autonomousWorkflow(cwd) {
  const next = nextWorkflow(cwd);
  if (next.active_feature_handoff) {
    return {
      status: 'blocked',
      next,
      blockers: next.blockers,
      active_feature_handoff: next.active_feature_handoff,
      required_action: next.active_feature_handoff.remediation,
      next_command: next.command
    };
  }
  const state = loadState(cwd);
  const seniorPhase = next.senior_cycle
    ? phasesFromState(state).find((phase) => phase.id === next.senior_cycle.feature_id)
    : null;
  const phaseId = phaseIdFromCommand(next.command) || (seniorPhase ? seniorPhase.id : null);
  if (!phaseId) {
    return {
      status: 'no_phase',
      next,
      next_command: next.command || 'terrace next'
    };
  }
  const planned = phasePlan(cwd, phaseId);
  const execution = phaseExecute(cwd, phaseId);
  const status = execution.allowed ? 'ready_for_agent_execution' : 'blocked';
  return {
    status,
    next,
    planned,
    execution,
    next_command: execution.allowed ? 'terrace phase validate ' + phaseId : planned.next_command
  };
}

function phaseCompleteWorkflow(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  beginPhaseStageRun(cwd, phase.id);
  const steps = [];
  const stageDefinitions = [
    { id: 'plan', command: 'terrace phase plan ' + phase.id, run: () => phasePlan(cwd, phase.id) },
    { id: 'execute', command: 'terrace phase execute ' + phase.id, run: () => phaseExecute(cwd, phase.id) },
    { id: 'validate', command: 'terrace phase validate ' + phase.id, run: () => phaseValidate(cwd, phase.id) },
    { id: 'review', command: 'terrace phase review ' + phase.id, run: () => phaseReview(cwd, phase.id) },
    { id: 'complete', command: 'terrace phase complete ' + phase.id, run: () => phaseComplete(cwd, phase.id) }
  ];
  let effort = phaseEffortDefault(cwd);
  for (const definition of stageDefinitions) {
    const currentRun = recoverStageRun(cwd);
    const currentStage = currentRun.stages.find((stage) => stage.id === definition.id);
    if (currentStage.status === 'passed') {
      steps.push({ command: definition.command, result: { status: 'passed', recovered: true } });
      continue;
    }
    persistStageTransition(cwd, definition.id, 'active', { command: definition.command });
    let result;
    try {
      result = definition.run();
    } catch (error) {
      persistStageTransition(cwd, definition.id, 'failed', { command: definition.command });
      throw error;
    }
    steps.push({ command: definition.command, result });
    effort = result.effort || effort;
    if (result.allowed === false) {
      const stopPacket = createStopPacket(result.blockers || [], {
        phaseId: phase.id,
        stageId: definition.id,
        command: definition.command,
        requiredAction: result.required_action
      });
      const stageRun = persistStageTransition(cwd, definition.id, 'blocked', {
        command: definition.command,
        evidenceRefs: stopPacket.evidence_refs,
        stopPacket
      });
      return {
        status: 'blocked',
        phase_id: phase.id,
        effort,
        steps,
        blockers: result.blockers || [],
        required_action: result.required_action || 'Resolve blockers before continuing phase completion.',
        next_command: definition.command,
        stop_packet: stopPacket,
        stage_run: stageRun
      };
    }
    persistStageTransition(cwd, definition.id, 'passed', {
      command: definition.command,
      evidenceRefs: [result.plan_ref, result.execution_ref, result.validation_ref, result.review_ref, result.summary_ref].filter(Boolean)
    });
  }
  const stageRun = recoverStageRun(cwd);
  return {
    status: 'completed',
    phase_id: phase.id,
    effort,
    steps,
    next_command: steps[steps.length - 1].result.next_command || 'terrace ship check',
    stage_run: stageRun
  };
}

function encodePlainTextIntentPlan(plan) {
  return Buffer.from(JSON.stringify({
    version: 1,
    input: plan.input,
    intent_id: plan.intent_id,
    parameters: plan.parameters,
    state_revision: plan.state_revision
  }), 'utf8').toString('base64url');
}

function decodePlainTextIntentPlan(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,16384}$/.test(token)) {
    throw guidanceError('Terrace needs a plan token returned by `terrace do <intent>` before it can apply a natural-language write.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and pass its returned plan token to `terrace do --apply <plan-token>`.'
    });
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw guidanceError('Terrace could not read the natural-language plan token.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and use the returned plan token unchanged.'
    });
  }
  if (!payload || payload.version !== 1 || typeof payload.input !== 'string' || typeof payload.intent_id !== 'string'
    || !payload.parameters || typeof payload.parameters !== 'object' || Array.isArray(payload.parameters)
    || !Number.isInteger(payload.state_revision) || payload.state_revision < 0) {
    throw guidanceError('Terrace received an invalid natural-language plan token.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and use the returned plan token unchanged.'
    });
  }
  const intent = resolveIntentCommand(payload.intent_id, payload.parameters);
  if (intent.effect !== 'write') {
    throw guidanceError('Only write-capable natural-language plans can be applied.', {
      code: 'INTENT_PLAN_NOT_WRITABLE',
      next_command: 'terrace do <intent>',
      remediation: 'Run the read-only command directly, or preview a write-capable route before applying it.'
    });
  }
  return payload;
}

function buildPlainTextIntentPlan(input, intentId, parameters, stateRevision) {
  const params = { ...(parameters || {}) };
  const intent = resolveIntentCommand(intentId, params);
  const plan = {
    input,
    intent_id: intent.id,
    command_id: intent.command_id,
    argv: intent.argv,
    command: intent.command,
    effect: intent.effect,
    parameters: params,
    state_revision: stateRevision,
    writes: intent.writes,
    execution: intent.execution,
    lock: intent.lock
  };
  if (intent.effect === 'write') {
    const token = encodePlainTextIntentPlan(plan);
    return {
      ...plan,
      mode: 'plan',
      requires_apply: true,
      apply: {
        plan_token: token,
        argv: ['do', '--apply', token],
        command: 'terrace do --apply ' + token
      }
    };
  }
  return {
    ...plan,
    mode: 'read',
    read_only: true
  };
}

function planPlainTextIntent(cwd, text) {
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Usage: terrace do <intent>');
  }
  const lowered = input.toLowerCase();
  const state = loadState(cwd);
  const phase = findPhaseByText(state, input);
  const plannedIntent = (intentId, parameters) => buildPlainTextIntentPlan(input, intentId, parameters, state.state_revision);

  if (/\b(gsd\s+replacement|replace\s+gsd|replacing\s+gsd|workflow\s+parity|adoption\s+status|terrace\s+ready|is\s+terrace\s+ready)\b/.test(lowered)) {
    return plannedIntent('adoption_status');
  }
  if (/\b(production\s+workbench|ship-ready|ship\s+ready|handoff\s+this\s+feature|make\s+this\s+feature\s+ship-ready)\b/.test(lowered)) {
    const featureId = state.senior_cycle && state.senior_cycle.active_feature
      ? state.senior_cycle.active_feature
      : state.workflow && state.workflow.active_feature
        ? state.workflow.active_feature
        : null;
    const wantsPrepare = /\b(prepare|make|handoff)\b/.test(lowered);
    if (wantsPrepare && featureId) {
      const target = /\bhandoff\b/.test(lowered) ? 'generic' : null;
      return plannedIntent('workbench_prepare', {
        feature_id: featureId,
        target
      });
    }
    return plannedIntent('workbench_status', {
      feature_id: featureId
    });
  }
  if (/\/(?:terrace:)?execute-phase-complete\s+/i.test(input) && phase) {
    return plannedIntent('phase_complete_workflow', { phase_id: phase.id });
  }
  if (/\/(?:terrace:)?goal\b/i.test(input)) {
    const goal = input.replace(/^.*?\/(?:terrace:)?goal\b\s*/i, '').trim();
    if (goal) {
      const nestedPlan = planPlainTextIntent(cwd, goal);
      return nestedPlan.effect === 'write'
        ? buildPlainTextIntentPlan(input, nestedPlan.intent_id, nestedPlan.parameters, nestedPlan.state_revision)
        : { ...nestedPlan, input };
    }
  }
  if (/\/gsd:plan-phase\s+/i.test(input) && phase) {
    return plannedIntent('phase_plan', { phase_id: phase.id });
  }
  if (/\/gsd:execute-phase\s+/i.test(input) && phase) {
    return plannedIntent('phase_execute', { phase_id: phase.id });
  }
  if (/\/gsd:quick\b/i.test(input)) {
    const title = input.replace(/^.*?\/gsd:quick\b\s*/i, '').trim();
    if (title) {
      return plannedIntent('quick_plan', { title });
    }
  }
  if (/\/gsd:ship\b/i.test(input)) {
    return plannedIntent('ship_prepare');
  }
  if (/\b(run|execute|start)\s+the\s+next\s+phase\b/.test(lowered) || /\bautonomous\b/.test(lowered)) {
    return plannedIntent('autonomous');
  }
  if (phase && /\b(end[-\s]?to[-\s]?end|complete\s+workflow|full\s+phase|execute\s+phase\s+complete|phase\s+complete\s+workflow)\b/.test(lowered)) {
    return plannedIntent('phase_complete_workflow', { phase_id: phase.id });
  }
  if (/\b(next|what next|continue)\b/.test(lowered)) {
    return plannedIntent('next');
  }
  if (/\bresume\b/.test(lowered)) {
    return plannedIntent('resume');
  }
  if (/\bhistory\b/.test(lowered)) {
    return plannedIntent('history');
  }
  if (phase && /\b(plan|planning|\/gsd:plan-phase)\b/.test(lowered)) {
    return plannedIntent('phase_plan', { phase_id: phase.id });
  }
  if (phase && /\b(execute|executing|\/gsd:execute-phase)\b/.test(lowered)) {
    return plannedIntent('phase_execute', { phase_id: phase.id });
  }
  if (phase && /\b(validate|validation|\/gsd:validate-phase)\b/.test(lowered)) {
    return plannedIntent('phase_validate', { phase_id: phase.id });
  }
  if (phase && /\b(review|\/gsd:review)\b/.test(lowered)) {
    return plannedIntent('phase_review', { phase_id: phase.id });
  }
  if (phase && /\b(complete|finish|done)\b/.test(lowered)) {
    return plannedIntent('phase_complete', { phase_id: phase.id });
  }
  if (/\bquick\b/.test(lowered) && /\b(list|show)\b/.test(lowered)) {
    return plannedIntent('quick_list');
  }
  if (/\bquick\b/.test(lowered)) {
    const title = input
      .replace(/^.*?\bquick(?:\s+task)?\b\s*/i, '')
      .replace(/^(plan|create|add|execute|run|fix)\s+/i, '')
      .trim();
    if (title) {
      return plannedIntent('quick_plan', { title });
    }
  }
  if (/\bship\b/.test(lowered) && /\b(prepare|pr|release)\b/.test(lowered)) {
    return plannedIntent('ship_prepare');
  }
  if (/\bship\b/.test(lowered)) {
    return plannedIntent('ship_check');
  }
  throw new Error('Unsupported plain-text Terrace command: ' + input);
}

function executePlainTextIntent(cwd, plan) {
  const parameters = plan.parameters || {};
  switch (plan.intent_id) {
    case 'adoption_status': {
      const { adoptionStatus } = require('./adoption.cjs');
      return adoptionStatus(cwd);
    }
    case 'workbench_status': {
      const { workbenchStatus } = require('./workbench.cjs');
      return workbenchStatus(cwd, { feature: parameters.feature_id });
    }
    case 'workbench_prepare': {
      const { workbenchPrepare } = require('./workbench.cjs');
      return workbenchPrepare(cwd, { feature: parameters.feature_id, for: parameters.target });
    }
    case 'phase_complete_workflow':
      return phaseCompleteWorkflow(cwd, parameters.phase_id);
    case 'phase_plan':
      return phasePlan(cwd, parameters.phase_id);
    case 'phase_execute':
      return phaseExecute(cwd, parameters.phase_id);
    case 'phase_validate':
      return phaseValidate(cwd, parameters.phase_id);
    case 'phase_review':
      return phaseReview(cwd, parameters.phase_id);
    case 'phase_complete':
      return phaseComplete(cwd, parameters.phase_id);
    case 'quick_plan':
      return quickPlan(cwd, parameters.title);
    case 'quick_list':
      return quickList(cwd);
    case 'ship_prepare':
      return shipPrepare(cwd);
    case 'ship_check':
      return shipCheck(cwd);
    case 'autonomous':
      return autonomousWorkflow(cwd);
    case 'next':
      return nextWorkflow(cwd);
    case 'resume':
      return resumeWorkflow(cwd);
    case 'history':
      return historySummary(cwd);
    default:
      throw new Error('Unsupported plain-text Terrace intent: ' + plan.intent_id);
  }
}

function applyPlainTextIntentPlan(cwd, token) {
  const payload = decodePlainTextIntentPlan(token);
  const intent = resolveIntentCommand(payload.intent_id, payload.parameters);
  const apply = () => {
    const state = loadState(cwd);
    if (state.state_revision !== payload.state_revision) {
      throw guidanceError('The natural-language plan is stale because Terrace state changed after it was previewed.', {
        code: 'INTENT_PLAN_STALE',
        next_command: 'terrace do <intent>',
        remediation: 'Preview the route again, review its updated write scope, and apply the new plan token.'
      });
    }
    const plan = buildPlainTextIntentPlan(payload.input, payload.intent_id, payload.parameters, state.state_revision);
    const result = executePlainTextIntent(cwd, plan);
    const { apply, ...appliedPlan } = plan;
    return {
      ...appliedPlan,
      mode: 'applied',
      requires_apply: false,
      applied: true,
      result
    };
  };
  return intent.lock === 'managed' ? withManagedArtifactLock(cwd, apply) : apply();
}

function routePlainText(cwd, text) {
  const plan = planPlainTextIntent(cwd, text);
  if (plan.effect === 'write') {
    return plan;
  }
  const result = executePlainTextIntent(cwd, plan);
  return { ...plan, result };
}

module.exports = {
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
  blockerList,
  blockerResolve,
  quickList,
  quickShow,
  quickPlan,
  quickExecute,
  quickComplete,
  shipPrepare,
  planPlainTextIntent,
  applyPlainTextIntentPlan,
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
  seniorCycleStatus,
  shipCheck,
  releasePreflight
};
