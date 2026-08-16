'use strict';

const fs = require('fs');
const path = require('path');
const { packageManagerFor, scriptCommand, testCommand } = require('./package-manager.cjs');
const { readManagedJson, withManagedArtifactLock, writeManagedJson } = require('./managed-artifacts.cjs');

function detectCommands(cwd) {
  const packagePath = path.resolve(cwd, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = pkg.scripts || {};
    const packageManager = packageManagerFor(cwd);
    return {
      package_manager: packageManager,
      test_command: scripts.test ? testCommand(packageManager) : null,
      typecheck_command: scripts.typecheck ? scriptCommand(packageManager, 'typecheck') : null,
      lint_command: scripts.lint ? scriptCommand(packageManager, 'lint') : null
    };
  }
  if (fs.existsSync(path.resolve(cwd, 'pyproject.toml'))) {
    return { package_manager: null, test_command: 'pytest', typecheck_command: null, lint_command: null };
  }
  if (fs.existsSync(path.resolve(cwd, 'Cargo.toml'))) {
    return { package_manager: null, test_command: 'cargo test', typecheck_command: 'cargo check', lint_command: null };
  }
  return { package_manager: null, test_command: null, typecheck_command: null, lint_command: null };
}

function configPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'config.json');
}

function writeConfig(cwd, config) {
  const filePath = configPathFor(cwd);
  writeManagedJson(cwd, 'config.json', config);
  return filePath;
}

function readConfig(cwd) {
  return readManagedJson(cwd, 'config.json', {});
}

function normalizePhaseEffort(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');
  if (['fast', 'standard', 'thorough'].includes(normalized)) {
    return normalized;
  }
  throw new Error('Usage: terrace settings effort <fast|standard|thorough>');
}

function phaseEffortDefault(cwd) {
  const config = readConfig(cwd);
  const configured = config.execution_policy && config.execution_policy.phase_effort_default;
  return configured ? normalizePhaseEffort(configured) : 'standard';
}

function settingsShow(cwd) {
  const config = readConfig(cwd);
  return {
    config,
    phase_effort_default: phaseEffortDefault(cwd)
  };
}

function settingsSetEffort(cwd, effort) {
  const normalized = normalizePhaseEffort(effort);
  return withManagedArtifactLock(cwd, () => {
    const config = readConfig(cwd);
    const nextConfig = {
      ...config,
      execution_policy: {
        ...(config.execution_policy || {}),
        phase_effort_default: normalized
      }
    };
    writeConfig(cwd, nextConfig);
    return {
      phase_effort_default: normalized,
      config_path: '.terrace/config.json',
      next_command: 'terrace settings show'
    };
  });
}

module.exports = {
  detectCommands,
  writeConfig,
  readConfig,
  normalizePhaseEffort,
  phaseEffortDefault,
  settingsShow,
  settingsSetEffort
};
