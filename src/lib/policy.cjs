'use strict';

const path = require('path');
const { readJson, writeJson } = require('./core.cjs');

const POLICY_MODES = ['lightweight', 'standard', 'strict', 'recovery'];

function policyPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'policy.json');
}

function evaluatePolicy(cwd, now) {
  const currentTime = now || new Date();
  const policyPath = policyPathFor(cwd);
  const policy = readJson(policyPath, {});
  const mode = policy.mode || policy.policy_mode || 'standard';
  const warnings = [];
  const actions = [];

  if (!POLICY_MODES.includes(mode)) {
    return { mode: 'standard', warnings: ['Invalid policy mode; using standard'], actions };
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
    const nextMode = policy.previous_mode || 'standard';
    const updated = { ...policy, mode: nextMode, recovery_expired_at: currentTime.toISOString() };
    writeJson(policyPath, updated);
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
