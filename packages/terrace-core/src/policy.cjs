'use strict';

const { readManagedJson, withManagedArtifactLock, writeManagedJson } = require('./managed-artifacts.cjs');

const POLICY_MODES = ['low_effort', 'standard', 'strict', 'recovery'];

function policyDecision(policy, currentTime) {
  const mode = policy.mode || policy.policy_mode || 'strict';
  const warnings = [];
  const actions = [];

  if (!POLICY_MODES.includes(mode)) {
    return { mode: 'strict', warnings: ['Invalid policy mode; using strict'], actions, nextPolicy: null };
  }

  if (mode !== 'recovery') {
    return { mode, warnings, actions, nextPolicy: null };
  }

  if (!policy.recovery_expires_at) {
    warnings.push('Recovery mode requires recovery_expires_at.');
    return { mode, warnings, actions, nextPolicy: null };
  }

  const expires = new Date(policy.recovery_expires_at);
  if (!Number.isNaN(expires.getTime()) && expires <= currentTime) {
    const nextMode = policy.previous_mode || 'strict';
    actions.push('reverted_recovery_mode');
    return {
      mode: nextMode,
      warnings,
      actions,
      nextPolicy: { ...policy, mode: nextMode, recovery_expired_at: currentTime.toISOString() }
    };
  }

  warnings.push('Recovery mode active until ' + policy.recovery_expires_at);
  actions.push('warned_recovery_mode');
  return { mode, warnings, actions, nextPolicy: null };
}

function resultForDecision(decision) {
  return { mode: decision.mode, warnings: decision.warnings, actions: decision.actions };
}

function evaluatePolicy(cwd, now) {
  const currentTime = now || new Date();
  const decision = policyDecision(readManagedJson(cwd, 'policy.json', {}), currentTime);
  if (!decision.nextPolicy) {
    return resultForDecision(decision);
  }

  return withManagedArtifactLock(cwd, () => {
    const freshDecision = policyDecision(readManagedJson(cwd, 'policy.json', {}), currentTime);
    if (freshDecision.nextPolicy) {
      writeManagedJson(cwd, 'policy.json', freshDecision.nextPolicy);
    }
    return resultForDecision(freshDecision);
  });
}

module.exports = {
  POLICY_MODES,
  evaluatePolicy
};
