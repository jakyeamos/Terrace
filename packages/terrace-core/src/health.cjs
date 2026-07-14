'use strict';

const fs = require('fs');
const path = require('path');
const { agentAssetStatus, preflightAgentBootstrap } = require('./agents.cjs');
const { warning } = require('./guidance.cjs');
const { managedArtifactExists } = require('./managed-artifacts.cjs');
const { defaultRuleFiles } = require('./rules.cjs');

function lstatIfExists(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function unsafeArtifactDiagnostic(error) {
  const details = error && error.details ? error.details : {};
  return {
    code: details.code || 'UNSAFE_MANAGED_ARTIFACT_PATH',
    message: error && error.message ? error.message : 'Terrace managed artifact path is unsafe.',
    remediation: details.remediation || 'Replace the unsafe filesystem object before rerunning terrace doctor.'
  };
}

function runDoctor(cwd) {
  const blocking = [];
  const warnings = [];
  const terraceDir = path.resolve(cwd, '.terrace');
  const terraceStat = lstatIfExists(terraceDir);

  if (!terraceStat) {
    blocking.push({
      code: 'MISSING_TERRACE_DIR',
      message: 'Missing .terrace/ directory',
      remediation: 'Run `terrace init` in the repo root.'
    });
  } else if (terraceStat.isSymbolicLink() || !terraceStat.isDirectory()) {
    blocking.push({
      code: 'MANAGED_ARTIFACT_PATH_UNSAFE',
      message: '.terrace must be a real directory owned by the project.',
      remediation: 'Replace the unsafe .terrace path before rerunning terrace doctor.'
    });
  } else {
    const managedArtifacts = [
      { relativePath: 'state.json', missing: 'state' },
      { relativePath: 'config.json' },
      { relativePath: 'events.jsonl' },
      { relativePath: 'policy.json' },
      { relativePath: 'presets/registry.json', missing: 'registry' },
      { relativePath: 'agents/manifest.json' },
      ...defaultRuleFiles().map((relativePath) => ({ relativePath: relativePath.slice('.terrace/'.length) }))
    ];
    for (const artifact of managedArtifacts) {
      try {
        const exists = managedArtifactExists(cwd, artifact.relativePath);
        if (!exists && artifact.missing === 'state') {
          blocking.push({
            code: 'MISSING_PROJECT_STATE',
            message: 'Missing .terrace/state.json',
            remediation: 'Re-run `terrace init` to create state.json.'
          });
        }
        if (!exists && artifact.missing === 'registry') {
          warnings.push({
            code: 'MISSING_PRESET_REGISTRY',
            message: 'Missing .terrace/presets/registry.json'
          });
        }
      } catch (error) {
        blocking.push(unsafeArtifactDiagnostic(error));
      }
    }
    try {
      preflightAgentBootstrap(cwd);
    } catch (error) {
      blocking.push(unsafeArtifactDiagnostic(error));
    }
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
