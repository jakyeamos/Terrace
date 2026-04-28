'use strict';

const { baselineStatus } = require('./baseline.cjs');
const { validateArtifacts } = require('./validate.cjs');
const { loadConfig } = require('./core.cjs');

function runAudit(cwd) {
  const baseline = baselineStatus(cwd);
  const validation = validateArtifacts(cwd, loadConfig(cwd));
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

module.exports = {
  runAudit
};
