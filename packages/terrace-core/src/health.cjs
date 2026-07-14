'use strict';

const fs = require('fs');
const path = require('path');
const { agentAssetStatus } = require('./agents.cjs');
const { warning } = require('./guidance.cjs');

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

  const agentAssets = agentAssetStatus(cwd);
  if (agentAssets.partial) {
    warnings.push(warning({
      code: 'PARTIAL_AGENT_ASSETS',
      message: 'Generated Terrace agent assets are partially installed.',
      why_blocked: 'Codex or Claude may only discover a subset of Terrace commands until missing generated assets are installed.',
      next_command: 'terrace agents repair',
      remediation: 'Run `terrace agents repair`; it installs missing generated agent assets without changing workflow state or overwriting user-owned files.'
    }));
  }

  return {
    blocking,
    warnings,
    agent_assets: agentAssets,
    healthy: blocking.length === 0
  };
}

module.exports = {
  runDoctor
};
