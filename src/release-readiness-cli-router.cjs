'use strict';

function createReleaseReadinessCliRouter(dependencies) {
  const {
    releasePreflight,
    shipCheck,
    shipPrepare,
    releaseOptionsFor,
    shipOptionsFor
  } = dependencies;

  function result(data) {
    return {
      handled: true,
      kind: 'result',
      data,
      exitCode: data.passed ? undefined : 1
    };
  }

  function error(message) {
    return { handled: true, kind: 'error', message };
  }

  function route(input) {
    const { command_id: commandId, family_id: familyId, args, raw_args: rawArgs, cwd } = input;
    if (familyId === 'release') {
      return error('Unknown release subcommand: ' + args[1] + '. Use: preflight');
    }
    if (familyId === 'ship') {
      return error('Unknown ship subcommand: ' + args[1] + '. Use: check, prepare');
    }
    if (commandId === 'release-preflight') {
      return result(releasePreflight(cwd, releaseOptionsFor(rawArgs)));
    }
    if (commandId === 'ship.check') {
      return result(shipCheck(cwd, shipOptionsFor(rawArgs)));
    }
    if (commandId === 'ship.prepare') {
      return result(shipPrepare(cwd, shipOptionsFor(rawArgs)));
    }
    return { handled: false };
  }

  return { route };
}

module.exports = {
  createReleaseReadinessCliRouter
};
