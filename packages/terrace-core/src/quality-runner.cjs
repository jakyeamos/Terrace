'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { packageManagerFor } = require('./package-manager.cjs');
const { readConfig } = require('./config.cjs');

const DEFAULTS = {
  enabled: false,
  analysis_mode: 'balanced',
  cache_mode: 'external',
  command: 'quality-runner',
  block_on: ['hard', 'stale', 'missing_evidence', 'plan_coverage'],
  performance_budget_seconds: 30
};

function qualityRunnerConfig(cwd) {
  const configured = readConfig(cwd).quality_runner;
  if (configured === undefined) {
    return { ...DEFAULTS };
  }
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    return {
      ...DEFAULTS,
      enabled: true,
      invalid: true,
      error: 'quality_runner must be an object'
    };
  }
  const config = {
    ...DEFAULTS,
    ...configured,
    block_on: Array.isArray(configured.block_on) ? configured.block_on : DEFAULTS.block_on
  };
  const valid = ['balanced', 'full'].includes(config.analysis_mode)
    && ['repo', 'external', 'disabled'].includes(config.cache_mode)
    && typeof config.command === 'string'
    && config.command.trim().length > 0
    && Array.isArray(config.block_on)
    && config.block_on.every((item) => typeof item === 'string');
  if (!valid) {
    return { ...config, enabled: true, invalid: true, error: 'invalid quality_runner settings' };
  }
  return config;
}

function qualityRunnerEnabled(cwd) {
  return qualityRunnerConfig(cwd).enabled === true;
}

function runQualityRunner(cwd, config, args) {
  const result = spawnSync(config.command, [...args, '--json'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) {
    return {
      status: 'blocked',
      blockers: [{
        code: 'QR_COMMAND_FAILED',
        description: String(result.error && result.error.message || result.stderr || 'Quality Runner command failed').trim()
      }],
      stderr: String(result.stderr || '').trim()
    };
  }
  try {
    const parsed = JSON.parse(String(result.stdout || '').trim());
    return parsed && typeof parsed === 'object' ? parsed : {
      status: 'blocked',
      blockers: [{ code: 'QR_INVALID_RESPONSE', description: 'Quality Runner returned a non-object JSON response.' }]
    };
  } catch (error) {
    return {
      status: 'blocked',
      blockers: [{
        code: 'QR_INVALID_RESPONSE',
        description: 'Quality Runner did not return parseable JSON: ' + error.message
      }],
      stdout: String(result.stdout || '').trim()
    };
  }
}

function safeProjectRelative(cwd, value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  const rootCandidate = path.resolve(cwd);
  const resolvedCandidate = path.resolve(cwd, value);
  const root = fs.realpathSync.native(rootCandidate);
  const resolved = fs.existsSync(resolvedCandidate)
    ? fs.realpathSync.native(resolvedCandidate)
    : resolvedCandidate;
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return path.relative(root, resolved).split(path.sep).join('/');
}

function packageManagerConflict(cwd) {
  const terracePackageManager = packageManagerFor(cwd);
  if (terracePackageManager !== 'npm') {
    return null;
  }
  return {
    terrace: terracePackageManager,
    quality_runner: 'pnpm',
    message: 'Terrace detected npm while Quality Runner uses its pnpm-managed development surface; commands were not rewritten.'
  };
}

function contractSummary(cwd, config, payload, phaseId) {
  const contractPath = safeProjectRelative(cwd, payload.contract_path);
  if (!contractPath || typeof payload.contract_id !== 'string') {
    return {
      enabled: true,
      status: 'blocked',
      blockers: [{ code: 'QR_CONTRACT_REFERENCE_MISSING', description: 'Quality Runner did not return a safe contract reference.' }]
    };
  }
  const obligations = Array.isArray(payload.obligations) ? payload.obligations : [];
  return {
    enabled: true,
    status: 'ready',
    contract_id: payload.contract_id,
    contract_path: contractPath,
    run_id: Array.isArray(payload.qr_run_refs) && payload.qr_run_refs[0]
      ? payload.qr_run_refs[0].run_id || null
      : null,
    phase_id: phaseId,
    analysis_mode: config.analysis_mode,
    cache_mode: config.cache_mode,
    latency_budget_seconds: config.performance_budget_seconds,
    performance: payload.performance || null,
    obligations,
    verification_commands: obligations.flatMap((item) => Array.isArray(item.verification_commands) ? item.verification_commands : []),
    blockers: Array.isArray(payload.blockers) ? payload.blockers : [],
    package_manager_conflict: packageManagerConflict(cwd),
    result_file: 'docs/terrace/phases/' + phaseId + '/QUALITY-RUNNER-RESULT.json'
  };
}

function prepareQualityRunner(cwd, phase, context) {
  const config = qualityRunnerConfig(cwd);
  if (!config.enabled) {
    return { enabled: false };
  }
  if (config.invalid) {
    return {
      enabled: true,
      status: 'blocked',
      blockers: [{ code: 'QR_CONFIG_INVALID', description: config.error }]
    };
  }
  const planId = Array.isArray(phase.plans) && phase.plans[0] && phase.plans[0].id
    ? phase.plans[0].id
    : phase.id;
  const previous = phase.quality_runner;
  const baseArgs = [
    'plan', 'contract', previous && previous.contract_path ? 'refresh' : 'prepare', cwd,
    '--phase-id', phase.id,
    '--plan-id', planId,
    '--intent', phase.title,
    '--analysis-mode', config.analysis_mode,
    '--cache-mode', config.cache_mode,
    '--performance-budget-seconds', String(config.performance_budget_seconds)
  ];
  if (previous && previous.contract_path) {
    baseArgs.splice(4, 0, '--contract', path.resolve(cwd, previous.contract_path));
  }
  for (const sourceRef of context.source_refs || []) {
    baseArgs.push('--context-ref', sourceRef);
  }
  const payload = runQualityRunner(cwd, config, baseArgs);
  if (payload.status === 'blocked') {
    return { enabled: true, ...payload, package_manager_conflict: packageManagerConflict(cwd) };
  }
  return contractSummary(cwd, config, payload, phase.id);
}

function preflightQualityRunner(cwd, phase, planRef) {
  const qualityRunner = phase.quality_runner;
  if (!qualityRunner || qualityRunner.enabled !== true) {
    return { enabled: false };
  }
  if (qualityRunner.status === 'blocked' || !qualityRunner.contract_path) {
    return {
      enabled: true,
      status: 'blocked',
      blockers: qualityRunner.blockers || [{ code: 'QR_CONTRACT_UNAVAILABLE', description: 'Quality Runner contract is unavailable.' }]
    };
  }
  const config = qualityRunnerConfig(cwd);
  const payload = runQualityRunner(cwd, config, [
    'plan', 'preflight', cwd,
    '--contract', path.resolve(cwd, qualityRunner.contract_path),
    '--plan-file', path.resolve(cwd, planRef)
  ]);
  return {
    ...payload,
    enabled: true,
    contract_id: qualityRunner.contract_id,
    contract_path: qualityRunner.contract_path
  };
}

function reconcileQualityRunner(cwd, phase) {
  const qualityRunner = phase.quality_runner;
  if (!qualityRunner || qualityRunner.enabled !== true) {
    return { enabled: false };
  }
  const resultFile = qualityRunner.result_file;
  if (!resultFile || !fs.existsSync(path.resolve(cwd, resultFile))) {
    return {
      enabled: true,
      status: 'blocked',
      blockers: [{
        code: 'QR_DELIVERY_RESULT_MISSING',
        description: 'Write one structured Quality Runner delivery result for this phase before validation.',
        result_file: resultFile
      }]
    };
  }
  const config = qualityRunnerConfig(cwd);
  const payload = runQualityRunner(cwd, config, [
    'plan', 'reconcile', cwd,
    '--contract', path.resolve(cwd, qualityRunner.contract_path),
    '--result-file', path.resolve(cwd, resultFile)
  ]);
  return {
    ...payload,
    enabled: true,
    contract_id: qualityRunner.contract_id,
    contract_path: qualityRunner.contract_path,
    result_file: resultFile
  };
}

function qualityRunnerBlocks(result) {
  if (!result || result.enabled !== true || result.status === 'reconciled' || result.status === 'ready') {
    return [];
  }
  const blockers = Array.isArray(result.blockers) ? result.blockers.map((item) => ({
    code: item.code || 'QR_BLOCKED',
    description: item.description || item.message || 'Quality Runner delivery contract is blocked.',
    quality_runner: true,
    ...item
  })) : [];
  return blockers.length > 0
    ? blockers
    : [{ code: 'QR_BLOCKED', description: 'Quality Runner returned an incomplete or non-ready result.', quality_runner: true }];
}

module.exports = {
  qualityRunnerConfig,
  qualityRunnerEnabled,
  prepareQualityRunner,
  preflightQualityRunner,
  reconcileQualityRunner,
  qualityRunnerBlocks,
  packageManagerConflict
};
