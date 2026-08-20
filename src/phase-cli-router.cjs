'use strict';

const PHASE_ALIAS_ACTIONS = Object.freeze({
  'phase.plan.alias': 'plan',
  'phase.execute.alias': 'execute',
  'phase.validate.alias': 'validate',
  'phase.review.alias': 'review',
  'phase.complete.alias': 'complete'
});

const PHASE_ACTIONS = Object.freeze({
  'phase.show': 'show',
  'phase.plan': 'plan',
  'phase.execute': 'execute',
  'phase.validate': 'validate',
  'phase.review': 'review',
  'phase.complete': 'complete'
});

function createPhaseCliRouter(dependencies) {
  const {
    phaseList,
    phaseShow,
    phasePlan,
    phaseExecute,
    phaseValidate,
    phaseReview,
    phaseComplete,
    phaseCompleteWorkflow,
    parallelPlan,
    parallelStart,
    parallelStatus,
    parallelResume,
    parallelMerge,
    parallelFail,
    parallelCleanup,
    loadState,
    saveState,
    transitionState
  } = dependencies;
  const handlers = {
    show: phaseShow,
    plan: phasePlan,
    execute: phaseExecute,
    validate: phaseValidate,
    review: phaseReview,
    complete: phaseComplete
  };

  function result(data) {
    return { handled: true, kind: 'result', data };
  }

  function error(message) {
    return { handled: true, kind: 'error', message };
  }

  function phaseFamilyError(args) {
    return error('Unknown phase subcommand: ' + args[1] + '. Use: list, show, plan, execute, validate, review, complete, set');
  }

  function route(input) {
    const { command_id: commandId, family_id: familyId, args, cwd } = input;
    const rawArgs = Array.isArray(input.raw_args) ? input.raw_args : (Array.isArray(args) ? args : []);
    if (familyId === 'phase') {
      return phaseFamilyError(args);
    }
    if (Object.prototype.hasOwnProperty.call(PHASE_ALIAS_ACTIONS, commandId)) {
      const action = PHASE_ALIAS_ACTIONS[commandId];
      const phaseId = args[1];
      if (!phaseId) {
        return error('Usage: terrace ' + action + '-phase <phase-id>');
      }
      if (action === 'execute' && rawArgs.includes('--parallel')) {
        return result({
          command_alias: 'terrace phase execute ' + phaseId + ' --parallel',
          result: parallelStart(cwd, phaseId)
        });
      }
      return result({
        command_alias: 'terrace phase ' + action + ' ' + phaseId,
        result: handlers[action](cwd, phaseId)
      });
    }
    if (commandId === 'phase.execute-complete') {
      const phaseId = args[1];
      if (!phaseId) {
        return error('Usage: terrace execute-phase-complete <phase-id>');
      }
      return result(rawArgs.includes('--parallel')
        ? parallelStart(cwd, phaseId)
        : phaseCompleteWorkflow(cwd, phaseId));
    }
    if (commandId === 'parallel.plan' || commandId === 'parallel.start' || commandId === 'parallel.status' || commandId === 'parallel.resume' || commandId === 'parallel.merge' || commandId === 'parallel.fail' || commandId === 'parallel.cleanup') {
      const target = args[2];
      if (!target) {
        return error('Usage: terrace parallel plan|start|status|resume|merge|cleanup <phase-id>');
      }
      if (commandId === 'parallel.plan') return result(parallelPlan(cwd, target));
      if (commandId === 'parallel.start') return result(parallelStart(cwd, target));
      if (commandId === 'parallel.status') return result(parallelStatus(cwd, target));
      if (commandId === 'parallel.resume') return result(parallelResume(cwd, target));
      if (commandId === 'parallel.merge') return result(parallelMerge(cwd, target));
      if (commandId === 'parallel.cleanup') return result(parallelCleanup(cwd, target, { force: rawArgs.includes('--force') }));
      const planId = args[3];
      if (!planId) return error('Usage: terrace parallel fail <phase-id> <plan-id> --reason <text>');
      const reasonIndex = rawArgs.indexOf('--reason');
      const reason = reasonIndex === -1 ? null : rawArgs[reasonIndex + 1] || null;
      return result(parallelFail(cwd, target, planId, reason));
    }
    if (commandId === 'phase.list') {
      return result(phaseList(cwd));
    }
    if (Object.prototype.hasOwnProperty.call(PHASE_ACTIONS, commandId)) {
      const action = PHASE_ACTIONS[commandId];
      const phaseId = args[2];
      if (!phaseId) {
        return error('Usage: terrace phase ' + action + ' <phase-id>');
      }
      if (action === 'execute' && rawArgs.includes('--parallel')) {
        return result(parallelStart(cwd, phaseId));
      }
      return result(handlers[action](cwd, phaseId));
    }
    if (commandId !== 'phase.set') {
      return { handled: false };
    }
    const nextStatus = args[2];
    if (!nextStatus) {
      return error('Usage: terrace phase set <workflow-status>');
    }
    const updated = transitionState(loadState(cwd), nextStatus);
    saveState(cwd, updated);
    return result(updated);
  }

  return { route };
}

module.exports = {
  createPhaseCliRouter
};
