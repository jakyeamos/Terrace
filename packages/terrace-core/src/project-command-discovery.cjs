'use strict';

const fs = require('fs');
const path = require('path');
const { agentAssetStatus } = require('./agents.cjs');
const { readConfig } = require('./config.cjs');
const { warning } = require('./guidance.cjs');
const {
  packageDryRunCommand,
  packageManagerFor,
  runCommandFor
} = require('./package-manager.cjs');

function readPackageJson(cwd) {
  const packagePath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function deadCodeGateConfig(cwd) {
  const config = readConfig(cwd);
  const gate = config.ship_gates && config.ship_gates.dead_code && typeof config.ship_gates.dead_code === 'object'
    ? config.ship_gates.dead_code
    : {};
  const configuredScripts = Array.isArray(gate.scripts)
    ? gate.scripts.filter((script) => typeof script === 'string' && script.trim()).map((script) => script.trim())
    : typeof gate.script === 'string' && gate.script.trim()
      ? [gate.script.trim()]
      : [];
  return {
    enabled: gate.enabled !== false,
    reason: typeof gate.reason === 'string' ? gate.reason : null,
    configured: configuredScripts.length > 0,
    scripts: configuredScripts.length > 0 ? configuredScripts : ['dead-code', 'deadcode', 'knip', 'unused', 'unused:check', 'depcheck']
  };
}

function discoverDeadCodeGate(cwd, scripts, packageManager) {
  const config = deadCodeGateConfig(cwd);
  const foundScript = config.enabled
    ? config.scripts.find((script) => Object.prototype.hasOwnProperty.call(scripts, script)) || null
    : null;
  return {
    enabled: config.enabled,
    configured: config.configured,
    skipped: !config.enabled,
    reason: config.reason,
    scripts: config.scripts,
    script: foundScript || config.scripts[0] || null,
    exists: Boolean(foundScript),
    command: foundScript ? runCommandFor(packageManager, foundScript).join(' ') : null
  };
}

function discoverProjectCommands(cwd) {
  const packageJson = readPackageJson(cwd);
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const packageManager = packageManagerFor(cwd);
  const desired = [
    { category: 'typecheck', script: 'typecheck', required: false, suggested: 'tsc --noEmit' },
    { category: 'lint', script: 'lint', required: true, suggested: 'eslint .' },
    { category: 'test', script: 'test', required: false, suggested: 'vitest run or project test equivalent' },
    { category: 'coverage', script: 'test:coverage', required: false, suggested: 'vitest run --coverage or project equivalent' },
    { category: 'package', script: 'package:dry-run', required: false, suggested: packageDryRunCommand(packageManager) },
    { category: 'build', script: 'build', required: false, suggested: 'framework build command' }
  ];
  const checks = desired.map((item) => {
    const exists = Object.prototype.hasOwnProperty.call(scripts, item.script);
    return {
      ...item,
      exists,
      command: exists ? runCommandFor(packageManager, item.script).join(' ') : null
    };
  });
  const agentAssets = agentAssetStatus(cwd);
  return {
    package_manager: packageManager,
    scripts,
    checks,
    dead_code: discoverDeadCodeGate(cwd, scripts, packageManager),
    agent_assets: agentAssets,
    warnings: [
      ...(agentAssets.missing_count > 0 ? [warning({
        code: 'PARTIAL_AGENT_ASSETS',
        message: 'Generated Terrace agent assets are partially installed.',
        why_blocked: 'Codex or Claude may only discover a subset of Terrace commands until missing generated assets are installed.',
        next_command: 'terrace agents repair',
        remediation: 'Run `terrace agents repair`; it installs missing generated agent assets without changing workflow state or overwriting user-owned files.'
      })] : []),
      ...(agentAssets.outdated_count > 0 ? [warning({
        code: 'OUTDATED_AGENT_ASSETS',
        message: 'Generated Terrace agent assets differ from the installed templates.',
        why_blocked: 'Existing agent entrypoints can retain older command semantics even when all files are present.',
        remediation: agentAssets.remediation
      })] : [])
    ]
  };
}

module.exports = {
  discoverProjectCommands
};
