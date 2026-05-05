'use strict';

const fs = require('fs');
const path = require('path');

function detectCommands(cwd) {
  const packagePath = path.resolve(cwd, 'package.json');
  if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = pkg.scripts || {};
    return {
      test_command: scripts.test ? 'npm test' : null,
      typecheck_command: scripts.typecheck ? 'npm run typecheck' : null,
      lint_command: scripts.lint ? 'npm run lint' : null
    };
  }
  if (fs.existsSync(path.resolve(cwd, 'pyproject.toml'))) {
    return { test_command: 'pytest', typecheck_command: null, lint_command: null };
  }
  if (fs.existsSync(path.resolve(cwd, 'Cargo.toml'))) {
    return { test_command: 'cargo test', typecheck_command: 'cargo check', lint_command: null };
  }
  return { test_command: null, typecheck_command: null, lint_command: null };
}

function configPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'config.json');
}

function writeConfig(cwd, config) {
  const filePath = configPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return filePath;
}

function readConfig(cwd) {
  const filePath = configPathFor(cwd);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
