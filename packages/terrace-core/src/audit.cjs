'use strict';

const { baselineStatus, enforceProtectedChanges } = require('./baseline.cjs');
const { validateArtifacts } = require('./validate.cjs');

function runAudit(cwd, config) {
  const baseline = baselineStatus(cwd);
  const validation = validateArtifacts(cwd, config || {});
  const blocking = [...baseline.blocking, ...validation.blocking];
  const warnings = [...validation.warnings];

  for (const specRef of baseline.requirements_without_protected_anchor) {
    warnings.push({
      code: 'REQUIREMENT_WITHOUT_PROTECTED_ANCHOR',
      message: 'Requirement has no protected baseline anchor: ' + specRef,
      spec_ref: specRef
    });
  }

  return {
    blocking,
    warnings,
    healthy: blocking.length === 0,
    baseline
  };
}

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
  runAudit,
  runCiCheck
};
