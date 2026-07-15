'use strict';

function createReportCliRouter(dependencies) {
  const {
    reportRead,
    reportUpdate,
    reportOpen,
    reportHistory,
    reportCeremony
  } = dependencies;

  function result(data, exitCode) {
    return { handled: true, kind: 'result', data, exitCode };
  }

  function error(message) {
    return { handled: true, kind: 'error', message };
  }

  function route(input) {
    const { command, args, cwd } = input;
    if (command !== 'report') {
      return { handled: false };
    }
    const sub = args[1];
    if (!sub) {
      return result(reportRead(cwd));
    }
    if (sub === 'update') {
      return result(reportUpdate(cwd, { command: 'terrace report update' }));
    }
    if (sub === 'open') {
      return result(reportOpen(cwd));
    }
    if (sub === 'history') {
      return result(reportHistory(cwd));
    }
    if (sub === 'ceremony') {
      const data = reportCeremony(cwd);
      return result(data, data.passed ? undefined : 1);
    }
    return error('Unknown report subcommand: ' + sub + '. Use: update, open, history, ceremony');
  }

  return { route };
}

module.exports = {
  createReportCliRouter
};
