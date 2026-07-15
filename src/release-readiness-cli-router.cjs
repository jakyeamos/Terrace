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
    const { command, args, rawArgs, cwd } = input;
    if (command === 'release-preflight' || command === 'release') {
      if (command === 'release' && args[1] !== 'preflight') {
        return error('Unknown release subcommand: ' + args[1] + '. Use: preflight');
      }
      return result(releasePreflight(cwd, releaseOptionsFor(rawArgs)));
    }
    if (command !== 'ship') {
      return { handled: false };
    }
    const sub = args[1];
    if (!sub || sub === 'check') {
      return result(shipCheck(cwd, shipOptionsFor(rawArgs)));
    }
    if (sub === 'prepare') {
      return result(shipPrepare(cwd, shipOptionsFor(rawArgs)));
    }
    return error('Unknown ship subcommand: ' + sub + '. Use: check, prepare');
  }

  return { route };
}

module.exports = {
  createReleaseReadinessCliRouter
};
