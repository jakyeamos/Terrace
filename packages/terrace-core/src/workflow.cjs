'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');
const { runDoctor } = require('./health.cjs');

function nowIso() {
  return new Date().toISOString();
}

function ensureDirFor(cwd, relativeFilePath) {
  fs.mkdirSync(path.dirname(path.resolve(cwd, relativeFilePath)), { recursive: true });
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  ensureDirFor(cwd, relativeFilePath);
  fs.writeFileSync(path.resolve(cwd, relativeFilePath), lines.join('\n') + '\n', 'utf8');
  return relativeFilePath;
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

function planLinesForPhase(phase, blockers) {
  const plans = Array.isArray(phase.plans) ? phase.plans : [];
  const criteria = Array.isArray(phase.success_criteria) ? phase.success_criteria : [];
  return [
    '# ' + phase.title,
    '',
    '## Objective',
    'Execute `' + phase.id + '` with Terrace gates and preserved GSD context.',
    '',
    '## Source',
    '- Phase source: ' + (phase.source_ref || 'Terrace roadmap'),
    '- Existing plan count: ' + String(plans.length),
    '',
    '## Existing Plans',
    ...(plans.length > 0 ? plans.map((plan) => '- ' + (plan.title || plan.id) + ' (' + (plan.source_ref || plan.id || 'no source') + ')') : ['- No migrated plans were attached.']),
    '',
    '## Execution Waves',
    '- Wave 1: inspect touched modules, write or update RED tests, and confirm the failing evidence.',
    '- Wave 2: implement the smallest scoped change that satisfies the active plan.',
    '- Wave 3: run validation, review the diff, update state, and prepare completion notes.',
    '',
    '## Acceptance Criteria',
    ...(criteria.length > 0 ? criteria.map((item) => '- ' + item) : ['- Typecheck, lint, tests, audit, and ship checks are deterministic.']),
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
  const match = text.match(/phase\s+([a-z0-9_.-]+)/i);
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
  const planRef = phaseRef(phase) + '/PLAN.md';
  writeMarkdown(cwd, planRef, planLinesForPhase(phase, blockers));
  const plannedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'planned',
      plan_ref: planRef,
      planned_at: plannedAt,
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
    blocked: blockers.length > 0,
    blockers,
    next_command: 'terrace phase execute ' + phase.id,
    active_slice: nextState.active_slice
  };
}

function phaseExecute(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  if (blockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers,
      required_action: 'Resolve blocking handoff actions before execution.'
    };
  }
  const startedAt = nowIso();
  const waves = [
    { id: 'red', status: 'required', command: 'terrace phase validate ' + phase.id },
    { id: 'implementation', status: 'pending', command: 'terrace phase review ' + phase.id },
    { id: 'completion', status: 'pending', command: 'terrace phase complete ' + phase.id }
  ];
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'executing',
      execution_started_at: startedAt,
      execution: {
        status: 'red_required',
        waves
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
    status: 'red_required',
    waves,
    next_action: 'Add RED evidence before implementation.'
  };
}

function phaseValidate(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const validationRef = phaseRef(phase) + '/VALIDATION.md';
  writeMarkdown(cwd, validationRef, [
    '# Validation: ' + phase.title,
    '',
    '## Required Evidence',
    '- RED evidence exists before implementation work is marked complete.',
    '- Typecheck, lint, tests, and audit are run before phase completion.',
    '',
    '## Commands',
    '- npm run typecheck',
    '- npm run lint',
    '- npm test',
    '- terrace audit',
    '',
    '## Next Command',
    '- terrace phase review ' + phase.id
  ]);
  const nextState = updatePhase(state, phase.id, {
    status: 'validation_ready',
    validation_ref: validationRef,
    validated_at: nowIso(),
    next_command: 'terrace phase review ' + phase.id
  });
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'validation_ready',
    validation_ref: validationRef,
    next_command: 'terrace phase review ' + phase.id
  };
}

function phaseReview(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
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
  return {
    phase_id: phase.id,
    status: 'completed',
    summary_ref: summaryRef,
    next_command: 'terrace ship check'
  };
}

function resumeWorkflow(cwd) {
  const state = loadState(cwd);
  const handoff = state.handoff || {};
  return {
    status: handoff.status || state.workflow.status,
    next_action: handoff.next_action || null,
    phase: handoff.phase || null,
    blocked_actions: state.blocked_actions || [],
    sessions: state.sessions || []
  };
}

function nextWorkflow(cwd) {
  const state = loadState(cwd);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const nextCommand = state.migration && state.migration.next_command
    ? state.migration.next_command
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
    item: findQuickTask(nextState, itemId),
    next_command: nextCommand
  };
}

function quickComplete(cwd, itemId) {
  const state = loadState(cwd);
  const item = findQuickTask(state, itemId);
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
  return {
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

function staticCheck(result, category, command) {
  return {
    category,
    command,
    passed: result.blocking.length === 0,
    blocking: result.blocking || [],
    warnings: result.warnings || []
  };
}

function migrationReadinessCheck(cwd) {
  try {
    const state = loadState(cwd);
    const readiness = state.migration && state.migration.readiness ? state.migration.readiness : null;
    const blockers = (state.blocked_actions || []).filter((item) => item.blocking).map((item) => ({
      code: 'MIGRATION_BLOCKED_ACTION',
      message: item.description,
      remediation: 'Resolve or clear the migrated blocked action.'
    }));
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: blockers.length === 0,
      readiness,
      blocking: blockers,
      warnings: []
    };
  } catch (error) {
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: false,
      blocking: [{
        code: 'MIGRATION_READINESS_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        remediation: 'Run terrace init or terrace port gsd before checking migration readiness.'
      }],
      warnings: []
    };
  }
}

function commandCheck(cwd, command, category) {
  try {
    execFileSync(command[0], command.slice(1), { cwd, stdio: 'ignore' });
    return { category, command: command.join(' '), passed: true, blocking: [] };
  } catch (error) {
    return {
      category,
      command: command.join(' '),
      passed: false,
      blocking: [{
        code: 'QUALITY_GATE_FAILED',
        message: command.join(' ') + ' failed.',
        remediation: 'Run the command locally and fix the reported failures.'
      }]
    };
  }
}

function shipCheck(cwd) {
  const categories = [
    staticCheck(runDoctor(cwd), 'doctor', 'terrace doctor'),
    staticCheck(runAudit(cwd), 'audit', 'terrace audit'),
    migrationReadinessCheck(cwd),
    commandCheck(cwd, ['npm', 'run', 'typecheck'], 'typecheck'),
    commandCheck(cwd, ['npm', 'run', 'lint'], 'lint'),
    commandCheck(cwd, ['npm', 'test'], 'test'),
    commandCheck(cwd, ['npm', 'run', 'test:coverage'], 'coverage'),
    commandCheck(cwd, ['npm', 'run', 'package:dry-run'], 'package'),
    commandCheck(cwd, ['git', 'diff', '--quiet'], 'dirty_tree')
  ];
  const blockers = categories.flatMap((category) => category.blocking || []);
  const warnings = categories.flatMap((category) => category.warnings || []);
  return {
    passed: blockers.length === 0,
    categories,
    blockers,
    warnings
  };
}

function shipPrepare(cwd) {
  const result = shipCheck(cwd);
  const shipRef = 'docs/terrace/ship/SHIP.md';
  writeMarkdown(cwd, shipRef, [
    '# Release Readiness',
    '',
    '## Status',
    '- Passed: ' + String(result.passed),
    '- Blocking issue count: ' + String(result.blockers.length),
    '- Warning count: ' + String(result.warnings.length),
    '',
    '## Categories',
    ...result.categories.map((category) => '- ' + category.category + ': ' + (category.passed ? 'passed' : 'failed') + ' (`' + category.command + '`)'),
    '',
    '## Blockers',
    ...(result.blockers.length > 0 ? result.blockers.map((blocker) => '- ' + blocker.code + ': ' + blocker.message) : ['- None.']),
    '',
    '## Next Command',
    '- terrace ship check'
  ]);
  return {
    ...result,
    ship_ref: shipRef,
    next_command: 'terrace ship check'
  };
}

function routePlainText(cwd, text) {
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Usage: terrace do <plain text>');
  }
  const lowered = input.toLowerCase();
  const state = loadState(cwd);
  const phase = findPhaseByText(state, input);

  if (/\b(next|what next|continue)\b/.test(lowered)) {
    return { input, command: 'terrace next', result: nextWorkflow(cwd) };
  }
  if (/\bresume\b/.test(lowered)) {
    return { input, command: 'terrace resume', result: resumeWorkflow(cwd) };
  }
  if (/\bhistory\b/.test(lowered)) {
    return { input, command: 'terrace history', result: historySummary(cwd) };
  }
  if (phase && /\b(plan|planning|\/gsd:plan-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase plan ' + phase.id, result: phasePlan(cwd, phase.id) };
  }
  if (phase && /\b(execute|executing|\/gsd:execute-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase execute ' + phase.id, result: phaseExecute(cwd, phase.id) };
  }
  if (phase && /\b(validate|validation|\/gsd:validate-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase validate ' + phase.id, result: phaseValidate(cwd, phase.id) };
  }
  if (phase && /\b(review|\/gsd:review)\b/.test(lowered)) {
    return { input, command: 'terrace phase review ' + phase.id, result: phaseReview(cwd, phase.id) };
  }
  if (phase && /\b(complete|finish|done)\b/.test(lowered)) {
    return { input, command: 'terrace phase complete ' + phase.id, result: phaseComplete(cwd, phase.id) };
  }
  if (/\bquick\b/.test(lowered) && /\b(list|show)\b/.test(lowered)) {
    return { input, command: 'terrace quick list', result: quickList(cwd) };
  }
  if (/\bquick\b/.test(lowered)) {
    const title = input
      .replace(/^.*?\bquick(?:\s+task)?\b\s*/i, '')
      .replace(/^(plan|create|add|execute|run)\s+/i, '')
      .trim();
    if (title) {
      return { input, command: 'terrace quick plan ' + title, result: quickPlan(cwd, title) };
    }
  }
  if (/\bship\b/.test(lowered) && /\b(prepare|pr|release)\b/.test(lowered)) {
    return { input, command: 'terrace ship prepare', result: shipPrepare(cwd) };
  }
  if (/\bship\b/.test(lowered)) {
    return { input, command: 'terrace ship check', result: shipCheck(cwd) };
  }
  throw new Error('Unsupported plain-text Terrace command: ' + input);
}

module.exports = {
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
};
