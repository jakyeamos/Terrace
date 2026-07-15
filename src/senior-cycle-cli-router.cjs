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

  function result(data) {
    return { handled: true, kind: 'result', data };
  }

  function error(message) {
    return { handled: true, kind: 'error', message };
  }

  function route(input) {
    const { command, args, rawArgs, cwd } = input;
    if (command === 'align') {
      return result(alignFeature(cwd, args[1], optionsFor(rawArgs)));
    }
    if (command === 'interrogate') {
      if (['init', 'adjust', 'risk', 'milestone'].includes(args[1])) {
        return result(interrogateMode(cwd, args[1], args[2], optionsFor(rawArgs)));
      }
      return result(interrogateFeature(cwd, args[1], optionsFor(rawArgs)));
    }
    if (command === 'map-codebase') {
      return result(mapCodebase(cwd));
    }
    const featureHandlers = {
      design: designFeature,
      'test-plan': testPlanFeature,
      observe: observeFeature,
      'validate-prod': validateProdFeature,
      cleanup: cleanupFeature
    };
    if (Object.prototype.hasOwnProperty.call(featureHandlers, command)) {
      return result(featureHandlers[command](cwd, args[1], optionsFor(rawArgs)));
    }
    if (command !== 'ui') {
      return { handled: false };
    }
    const sub = args[1];
    const feature = args[2];
    const uiHandlers = {
      'import-stitch': uiImportStitch,
      'plan-refresh': uiPlanRefresh,
      diff: uiDiff
    };
    if (!Object.prototype.hasOwnProperty.call(uiHandlers, sub)) {
      return error('Unknown ui subcommand: ' + sub + '. Use: import-stitch, plan-refresh, diff');
    }
    return result(uiHandlers[sub](cwd, feature));
  }

  return { route };
}

module.exports = {
  createSeniorCycleCliRouter
};
