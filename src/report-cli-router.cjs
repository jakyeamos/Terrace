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
    const { command_id: commandId, family_id: familyId, args, cwd } = input;
    if (familyId === 'report') {
      return error('Unknown report subcommand: ' + args[1] + '. Use: update, open, history, ceremony');
    }
    if (commandId === 'report') {
      return result(reportRead(cwd));
    }
    if (commandId === 'report.update') {
      return result(reportUpdate(cwd, { command: 'terrace report update' }));
    }
    if (commandId === 'report.open') {
      return result(reportOpen(cwd));
    }
    if (commandId === 'report.history') {
      return result(reportHistory(cwd));
    }
    if (commandId === 'report.ceremony') {
      const data = reportCeremony(cwd);
      return result(data, data.passed ? undefined : 1);
    }
    return { handled: false };
  }

  return { route };
}

module.exports = {
  createReportCliRouter
};
