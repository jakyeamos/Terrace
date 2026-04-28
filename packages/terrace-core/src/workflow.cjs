'use strict';

const { execFileSync } = require('child_process');
const { loadState, saveState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');
const { runDoctor } = require('./health.cjs');

function phaseList(cwd) {
  const state = loadState(cwd);
  return {
    phases: state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : []
  };
}

function phaseShow(cwd, phaseId) {
  const phases = phaseList(cwd).phases;
  const phase = phases.find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  return { phase };
}

function phasePlan(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = (state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : []).find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  const nextState = {
    ...state,
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
    next_command: 'terrace phase execute ' + phase.id,
    active_slice: nextState.active_slice
  };
}

function phaseExecute(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = (state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : []).find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  if (blockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers,
      required_action: 'Resolve blocking handoff actions before execution.'
    };
  }
  const nextState = {
    ...state,
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
    next_action: 'Add RED evidence before implementation.'
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
    items: Array.isArray(state.quick_tasks) ? state.quick_tasks : []
  };
}

function quickShow(cwd, itemId) {
  const item = quickList(cwd).items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('Unknown quick task: ' + itemId);
  }
  return { item };
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

module.exports = {
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  resumeWorkflow,
  nextWorkflow,
  historySummary,
  backlogList,
  backlogAdd,
  quickList,
  quickShow,
  shipCheck
};
