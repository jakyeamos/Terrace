'use strict';

function normalizeFeatureId(feature) {
  const id = String(feature || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || id.split(/[.-]+/).every((part) => part === '')) {
    throw new Error('Usage: terrace <senior-cycle-command> <feature>');
  }
  return id;
}

function normalizeTier(tier) {
  const normalized = String(tier || '').toLowerCase();
  if (['small', 'medium', 'large'].includes(normalized)) {
    return normalized;
  }
  return 'medium';
}

function featureRef(featureId) {
  return 'docs/terrace/features/' + featureId;
}

function seniorArtifactRefs(featureId) {
  const base = featureRef(featureId);
  return {
    alignment: base + '/ALIGNMENT.md',
    interrogation: base + '/INTERROGATION.md',
    design: base + '/DESIGN.md',
    test_plan: 'docs/testing/TEST-PLAN.md',
    observability: base + '/OBSERVABILITY.md',
    validation: base + '/VALIDATION.md',
    cleanup: base + '/CLEANUP.md',
    codebase_map: 'docs/terrace/codebase/MAP.md',
    codebase_architecture: 'docs/terrace/codebase/ARCHITECTURE.md',
    codebase_risks: 'docs/terrace/codebase/RISKS.md',
    codebase_testing: 'docs/terrace/codebase/TESTING.md',
    codebase_observability: 'docs/terrace/codebase/OBSERVABILITY.md'
  };
}

function seniorRequirements(featureId, tier) {
  const refs = seniorArtifactRefs(featureId);
  const normalizedTier = normalizeTier(tier);
  if (normalizedTier === 'small') {
    return {
      tier: normalizedTier,
      execute: [refs.test_plan],
      implement: [refs.test_plan],
      ship: [],
      complete: [],
      all: [refs.test_plan]
    };
  }
  if (normalizedTier === 'medium') {
    return {
      tier: normalizedTier,
      execute: [refs.alignment, refs.test_plan],
      implement: [refs.test_plan],
      ship: [refs.observability, refs.validation],
      complete: [refs.cleanup],
      all: [refs.alignment, refs.test_plan, refs.observability, refs.validation, refs.cleanup]
    };
  }
  return {
    tier: normalizedTier,
    execute: [
      refs.alignment,
      refs.interrogation,
      refs.codebase_map,
      refs.codebase_architecture,
      refs.codebase_risks,
      refs.design,
      refs.test_plan
    ],
    implement: [refs.test_plan],
    ship: [refs.observability, refs.validation],
    complete: [refs.cleanup],
    all: [
      refs.alignment,
      refs.interrogation,
      refs.codebase_map,
      refs.codebase_architecture,
      refs.codebase_risks,
      refs.codebase_testing,
      refs.codebase_observability,
      refs.design,
      refs.test_plan,
      refs.observability,
      refs.validation,
      refs.cleanup
    ]
  };
}

function blockerForArtifact(artifact) {
  if (artifact.endsWith('/ALIGNMENT.md')) {
    return { code: 'ALIGNMENT_REQUIRED', artifact, message: 'Tier 2+ work requires alignment before execution.' };
  }
  if (artifact.endsWith('/INTERROGATION.md')) {
    return { code: 'INTERROGATION_REQUIRED', artifact, message: 'Large/risky work requires explicit edge-case and failure-mode interrogation.' };
  }
  if (artifact.includes('/codebase/')) {
    return { code: 'CODEBASE_MAPPING_REQUIRED', artifact, message: 'Large/risky work requires codebase context before execution.' };
  }
  if (artifact.endsWith('/DESIGN.md')) {
    return { code: 'DESIGN_REQUIRED', artifact, message: 'Large/risky work requires architecture and maintainability decisions before execution.' };
  }
  if (artifact.endsWith('/TEST-PLAN.md')) {
    return { code: 'TEST_PLAN_REQUIRED', artifact, message: 'No implementation without a behavior-first test plan.' };
  }
  if (artifact.endsWith('/OBSERVABILITY.md')) {
    return { code: 'OBSERVABILITY_REQUIRED', artifact, message: 'No ship without observability and debugging intent.' };
  }
  if (artifact.endsWith('/VALIDATION.md')) {
    return { code: 'VALIDATION_REQUIRED', artifact, message: 'No ship without production validation and rollback conditions.' };
  }
  if (artifact.endsWith('/CLEANUP.md')) {
    return { code: 'CLEANUP_REQUIRED', artifact, message: 'No completion without cleanup ownership.' };
  }
  return { code: 'SENIOR_ARTIFACT_REQUIRED', artifact, message: 'Required senior-cycle artifact is missing.' };
}

function commandForMissingArtifact(featureId, artifact) {
  if (artifact.endsWith('/ALIGNMENT.md')) {
    return 'terrace align ' + featureId;
  }
  if (artifact.endsWith('/INTERROGATION.md')) {
    return 'terrace interrogate ' + featureId;
  }
  if (artifact.includes('/codebase/')) {
    return 'terrace map-codebase';
  }
  if (artifact.endsWith('/DESIGN.md')) {
    return 'terrace design ' + featureId;
  }
  if (artifact.endsWith('/TEST-PLAN.md')) {
    return 'terrace test-plan ' + featureId;
  }
  if (artifact.endsWith('/OBSERVABILITY.md')) {
    return 'terrace observe ' + featureId;
  }
  if (artifact.endsWith('/VALIDATION.md')) {
    return 'terrace validate-prod ' + featureId;
  }
  if (artifact.endsWith('/CLEANUP.md')) {
    return 'terrace cleanup ' + featureId;
  }
  return 'terrace next';
}

function missingFrom(requiredArtifacts, existingArtifacts) {
  return requiredArtifacts.filter((artifact) => !existingArtifacts.has(artifact));
}

function unique(items) {
  return Array.from(new Set(items));
}

function seniorCycleGateStatus(input) {
  const featureId = normalizeFeatureId(input && input.feature);
  const normalizedTier = normalizeTier(input && input.tier);
  const existingArtifacts = new Set(input && Array.isArray(input.existingArtifacts) ? input.existingArtifacts : []);
  const requirements = seniorRequirements(featureId, normalizedTier);
  const missingExecute = missingFrom(requirements.execute, existingArtifacts);
  const missingImplement = missingFrom(requirements.implement, existingArtifacts);
  const missingShip = missingFrom(requirements.ship, existingArtifacts);
  const missingComplete = missingFrom(requirements.complete, existingArtifacts);
  const missingArtifacts = unique([...missingExecute, ...missingImplement, ...missingShip, ...missingComplete]);
  const blockers = missingArtifacts.map((artifact) => blockerForArtifact(artifact));
  return {
    feature_id: featureId,
    tier: normalizedTier,
    architecture_default: 'sustainable',
    no_band_aid_rule: true,
    required_artifacts: requirements.all,
    missing_artifacts: missingArtifacts,
    allowed: {
      execute: missingExecute.length === 0,
      implement: missingImplement.length === 0,
      ship: missingShip.length === 0,
      complete: missingComplete.length === 0
    },
    blockers,
    next_command: blockers.length > 0 ? commandForMissingArtifact(featureId, blockers[0].artifact) : 'terrace ship check'
  };
}

function buildPhaseExecutionQueue(phase, context, discovered) {
  const ctx = context || {};
  const checks = discovered && Array.isArray(discovered.checks) ? discovered.checks : [];
  const plans = Array.isArray(ctx.plans) && ctx.plans.length > 0
    ? ctx.plans
    : [{ id: phase.id + '-plan', title: phase.title, source_ref: phase.plan_ref || phase.source_ref || null }];
  const likelyFiles = Array.isArray(ctx.likely_files) ? ctx.likely_files : [];
  const commands = checks.filter((check) => check.exists).map((check) => check.command);
  return plans.map((plan, index) => ({
    id: plan.id || phase.id + '-task-' + String(index + 1),
    title: plan.title || 'Execute ' + phase.title,
    source_ref: plan.source_ref || null,
    status: 'ready',
    wave: index + 1,
    likely_files: likelyFiles,
    validation_commands: commands,
    agent_prompt: 'Implement ' + (plan.title || phase.title) + ' for ' + phase.id + ', then run the listed validation commands and update Terrace state.'
  }));
}

module.exports = {
  normalizeFeatureId,
  normalizeTier,
  featureRef,
  seniorArtifactRefs,
  seniorRequirements,
  blockerForArtifact,
  commandForMissingArtifact,
  seniorCycleGateStatus,
  buildPhaseExecutionQueue
};
