'use strict';

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
    loadState,
    saveState,
    transitionState
  } = dependencies;
  const handlers = {
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

  function route(input) {
    const { command, args, cwd } = input;
    if (['plan-phase', 'execute-phase', 'validate-phase', 'review-phase', 'complete-phase'].includes(command)) {
      const phaseId = args[1];
      if (!phaseId) {
        return error('Usage: terrace ' + command + ' <phase-id>');
      }
      const action = command.replace('-phase', '');
      return result({
        command_alias: 'terrace phase ' + action + ' ' + phaseId,
        result: handlers[action](cwd, phaseId)
      });
    }
    if (command === 'execute-phase-complete') {
      const phaseId = args[1];
      if (!phaseId) {
        return error('Usage: terrace execute-phase-complete <phase-id>');
      }
      return result(phaseCompleteWorkflow(cwd, phaseId));
    }
    if (command !== 'phase') {
      return { handled: false };
    }
    const sub = args[1];
    if (sub === 'list') {
      return result(phaseList(cwd));
    }
    const phaseHandlers = {
      show: phaseShow,
      plan: phasePlan,
      execute: phaseExecute,
      validate: phaseValidate,
      review: phaseReview,
      complete: phaseComplete
    };
    if (Object.prototype.hasOwnProperty.call(phaseHandlers, sub)) {
      const phaseId = args[2];
      if (!phaseId) {
        return error('Usage: terrace phase ' + sub + ' <phase-id>');
      }
      return result(phaseHandlers[sub](cwd, phaseId));
    }
    if (sub !== 'set') {
      return error('Unknown phase subcommand: ' + sub + '. Use: list, show, plan, execute, validate, review, complete, set');
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
