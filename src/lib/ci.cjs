'use strict';

const { baselineStatus, enforceProtectedChanges } = require('./baseline.cjs');
const { runAudit } = require('./audit.cjs');

function runCiCheck(cwd, changedFiles) {
  const audit = runAudit(cwd);
  const enforcement = enforceProtectedChanges(cwd, changedFiles || []);
  const status = baselineStatus(cwd);
  const blocking = [...audit.blocking, ...enforcement.blocking];

  return {
    blocking,
    warnings: audit.warnings,
    passed: blocking.length === 0,
    registry_entries: status.entries.length
  };
}

module.exports = {
  runCiCheck
};
