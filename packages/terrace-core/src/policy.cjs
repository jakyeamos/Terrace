'use strict';

const fs = require('fs');
const path = require('path');

const POLICY_MODES = ['low_effort', 'standard', 'strict', 'recovery'];

function policyPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'policy.json');
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function evaluatePolicy(cwd, now) {
  const currentTime = now || new Date();
  const policyPath = policyPathFor(cwd);
  const policy = readJson(policyPath, {});
  const mode = policy.mode || policy.policy_mode || 'strict';
  const warnings = [];
  const actions = [];

  if (!POLICY_MODES.includes(mode)) {
    return { mode: 'strict', warnings: ['Invalid policy mode; using strict'], actions };
  }

  if (mode !== 'recovery') {
    return { mode, warnings, actions };
  }

  if (!policy.recovery_expires_at) {
    warnings.push('Recovery mode requires recovery_expires_at.');
    return { mode, warnings, actions };
  }

  const expires = new Date(policy.recovery_expires_at);
  if (!Number.isNaN(expires.getTime()) && expires <= currentTime) {
    const nextMode = policy.previous_mode || 'strict';
    writeJson(policyPath, { ...policy, mode: nextMode, recovery_expired_at: currentTime.toISOString() });
    actions.push('reverted_recovery_mode');
    return { mode: nextMode, warnings, actions };
  }

  warnings.push('Recovery mode active until ' + policy.recovery_expires_at);
  actions.push('warned_recovery_mode');
  return { mode, warnings, actions };
}

module.exports = {
  POLICY_MODES,
  evaluatePolicy
};
