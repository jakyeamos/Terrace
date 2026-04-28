'use strict';

const { execFileSync } = require('child_process');
const { loadState, saveState } = require('./state.cjs');

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
    commandCheck(cwd, ['npm', 'run', 'typecheck'], 'typecheck'),
    commandCheck(cwd, ['npm', 'run', 'lint'], 'lint'),
    commandCheck(cwd, ['npm', 'test'], 'test'),
    commandCheck(cwd, ['npm', 'run', 'test:coverage'], 'coverage'),
    commandCheck(cwd, ['npm', 'run', 'package:dry-run'], 'package'),
    commandCheck(cwd, ['git', 'diff', '--quiet'], 'dirty_tree')
  ];
  const blockers = categories.flatMap((category) => category.blocking);
  return {
    passed: blockers.length === 0,
    categories,
    blockers,
    warnings: []
  };
}

module.exports = {
  phaseList,
  phaseShow,
  resumeWorkflow,
  nextWorkflow,
  backlogList,
  backlogAdd,
  shipCheck
};
