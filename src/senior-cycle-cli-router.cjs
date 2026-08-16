'use strict';

function createSeniorCycleCliRouter(dependencies) {
  const {
    optionsFor,
    alignFeature,
    interrogateFeature,
    interrogateMode,
    mapCodebase,
    designFeature,
    testPlanFeature,
    observeFeature,
    validateProdFeature,
    cleanupFeature,
    uiImportStitch,
    uiPlanRefresh,
    uiDiff
  } = dependencies;
  const featureHandlers = {
    align: alignFeature,
    design: designFeature,
    'test-plan': testPlanFeature,
    observe: observeFeature,
    'validate-prod': validateProdFeature,
    cleanup: cleanupFeature
  };
  const uiHandlers = {
    'ui.import-stitch': uiImportStitch,
    'ui.plan-refresh': uiPlanRefresh,
    'ui.diff': uiDiff
  };

  function result(data) {
    return { handled: true, kind: 'result', data };
  }

  function error(message) {
    return { handled: true, kind: 'error', message };
  }

  function route(input) {
    const { command_id: commandId, family_id: familyId, args, raw_args: rawArgs, cwd } = input;
    if (familyId === 'ui') {
      return error('Unknown ui subcommand: ' + args[1] + '. Use: import-stitch, plan-refresh, diff');
    }
    if (Object.prototype.hasOwnProperty.call(featureHandlers, commandId)) {
      return result(featureHandlers[commandId](cwd, args[1], optionsFor(rawArgs)));
    }
    if (commandId === 'interrogate') {
      return result(interrogateFeature(cwd, args[1], optionsFor(rawArgs)));
    }
    if (commandId === 'interrogate.mode') {
      return result(interrogateMode(cwd, args[1], args[2], optionsFor(rawArgs)));
    }
    if (commandId === 'map-codebase') {
      return result(mapCodebase(cwd));
    }
    if (Object.prototype.hasOwnProperty.call(uiHandlers, commandId)) {
      return result(uiHandlers[commandId](cwd, args[2]));
    }
    return { handled: false };
  }

  return { route };
}

module.exports = {
  createSeniorCycleCliRouter
};
