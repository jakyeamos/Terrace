'use strict';

const fs = require('fs');
const path = require('path');

function runDoctor(cwd) {
  const blocking = [];
  const warnings = [];
  const terraceDir = path.resolve(cwd, '.terrace');
  const statePath = path.join(terraceDir, 'state.json');
  const registryPath = path.join(terraceDir, 'presets', 'registry.json');

  if (!fs.existsSync(terraceDir)) {
    blocking.push({
      code: 'MISSING_TERRACE_DIR',
      message: 'Missing .terrace/ directory',
      remediation: 'Run `terrace init` in the repo root.'
    });
  }

  if (fs.existsSync(terraceDir) && !fs.existsSync(statePath)) {
    blocking.push({
      code: 'MISSING_PROJECT_STATE',
      message: 'Missing .terrace/state.json',
      remediation: 'Re-run `terrace init` to create state.json.'
    });
  }

  if (fs.existsSync(terraceDir) && !fs.existsSync(registryPath)) {
    warnings.push({
      code: 'MISSING_PRESET_REGISTRY',
      message: 'Missing .terrace/presets/registry.json'
    });
  }

  return {
    blocking,
    warnings,
    healthy: blocking.length === 0
  };
}

module.exports = {
  runDoctor
};
