'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const {
  preflightFeature,
  docuFeature,
  reviewAi,
  workstreamsPlan,
  createHandoff,
  testEvalShipCheck
} = require('./lifecycle.cjs');
const { reportRead } = require('./reporting.cjs');
const { securityShipCheck } = require('./security-check.cjs');
const { evaluateDebt } = require('./debt-assessment.cjs');

function normalizeFeatureId(feature) {
  const id = String(feature || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || id.split(/[.-]+/).every((part) => part === '')) {
    throw new Error('Usage: terrace workbench prepare <feature>');
  }
  return id;
}

function normalizeTier(tier) {
  return ['small', 'medium', 'large'].includes(tier) ? tier : 'medium';
}

function activeFeature(state) {
  return state.senior_cycle && state.senior_cycle.active_feature
    ? state.senior_cycle.active_feature
    : state.workflow && state.workflow.active_feature
      ? state.workflow.active_feature
      : null;
}

function featureBase(featureId) {
  return 'docs/terrace/features/' + featureId;
}

function seniorArtifactRefs(featureId) {
  const base = featureBase(featureId);
  return [
    base + '/ALIGNMENT.md',
    base + '/INTERROGATION.md',
    'docs/terrace/codebase/MAP.md',
    'docs/terrace/codebase/ARCHITECTURE.md',
    'docs/terrace/codebase/RISKS.md',
    base + '/DESIGN.md',
    'docs/testing/TEST-PLAN.md',
    base + '/OBSERVABILITY.md',
    base + '/VALIDATION.md',
    base + '/CLEANUP.md'
  ];
}

function relativeExists(cwd, relativeFilePath) {
  return fs.existsSync(path.resolve(cwd, relativeFilePath));
}

function latestForFeature(entries, featureId) {
  return entries.slice().reverse().find((entry) => entry.feature_id === featureId) || null;
}

function debtStatus(state, featureId) {
  const assessment = evaluateDebt(state.debt, { featureId });
  return {
    open_count: assessment.open_count,
    entries: assessment.entries,
    blockers: assessment.blockers.map((blocker) => ({
      code: blocker.code,
      id: blocker.id,
      message: blocker.message
    })),
    warnings: assessment.warnings,
    passed: assessment.passed
  };
}

function statusForFeature(cwd, state, featureId) {
  const seniorCycle = state.senior_cycle || {};
  const features = seniorCycle.features || {};
  const feature = features[featureId] || {};
  const tier = feature.tier || 'medium';
  const preflight = state.preflights && state.preflights[featureId] ? state.preflights[featureId] : null;
  const documentation = state.documentation && state.documentation[featureId] ? state.documentation[featureId] : null;
  const reviews = Array.isArray(state.ai_reviews) ? state.ai_reviews : [];
  const aiReview = latestForFeature(reviews.filter((entry) => entry.mode === 'release'), featureId) || latestForFeature(reviews, featureId);
  const workstreams = state.workstreams && state.workstreams[featureId] ? state.workstreams[featureId] : null;
  const missingGates = seniorArtifactRefs(featureId).filter((artifact) => !relativeExists(cwd, artifact));
  const debt = debtStatus(state, featureId);
  const report = reportRead(cwd).report_card;
  const nextCommands = [];
  if (missingGates.length > 0) nextCommands.push('terrace align ' + featureId);
  if (!preflight) nextCommands.push('terrace preflight ' + featureId);
  if (!documentation) nextCommands.push('terrace docu ' + featureId + ' --type runbook');
  if (!aiReview) nextCommands.push('terrace review ai --mode release --feature ' + featureId);
  if (!workstreams) nextCommands.push('terrace workstreams plan ' + featureId);
  nextCommands.push('terrace ship check --fast');

  return {
    feature_id: featureId,
    tier,
    active: activeFeature(state) === featureId,
    senior_cycle: {
      missing_gates: missingGates,
      missing_count: missingGates.length
    },
    preflight: {
      present: Boolean(preflight),
      artifact: preflight ? preflight.artifact : null
    },
    documentation: {
      present: Boolean(documentation),
      artifact: documentation ? documentation.artifact : null
    },
    ai_review: {
      present: Boolean(aiReview),
      mode: aiReview ? aiReview.mode : null,
      artifact: aiReview ? aiReview.artifact : null,
      markdown: aiReview ? aiReview.markdown : null
    },
    workstreams: {
      present: Boolean(workstreams),
      artifact: workstreams ? workstreams.artifact : null,
      json_ref: workstreams ? workstreams.json_ref : null
    },
    debt,
    security: securityShipCheck(cwd),
    test_eval: testEvalShipCheck(cwd),
    report_card: {
      score: report.score,
      status_label: report.status_label,
      claim_scope: report.claim_scope
    },
    next_commands: nextCommands
  };
}

function workbenchStatus(cwd, options) {
  const opts = options || {};
  const state = loadState(cwd);
  const featureId = opts.feature ? normalizeFeatureId(opts.feature) : activeFeature(state);
  if (!featureId) {
    return {
      mode: 'status',
      read_only: true,
      feature_id: null,
      status: 'no_active_feature',
      next_commands: ['terrace workbench prepare <feature> --tier medium']
    };
  }
  return {
    mode: 'status',
    read_only: true,
    status: 'ready',
    ...statusForFeature(cwd, state, featureId)
  };
}

function activateFeature(cwd, featureId, tier) {
  const state = loadState(cwd);
  const seniorCycle = state.senior_cycle || {};
  const features = seniorCycle.features || {};
  const current = features[featureId] || { feature_id: featureId };
  saveState(cwd, {
    ...state,
    workflow: {
      ...state.workflow,
      active_feature: featureId
    },
    senior_cycle: {
      ...seniorCycle,
      active_feature: featureId,
      features: {
        ...features,
        [featureId]: {
          ...current,
          feature_id: featureId,
          tier,
          architecture_default: current.architecture_default || 'sustainable',
          no_band_aid_rule: current.no_band_aid_rule !== false,
          artifacts: current.artifacts || {},
          updated_at: new Date().toISOString()
        }
      }
    }
  });
}

function workbenchPrepare(cwd, options) {
  const opts = options || {};
  const featureId = normalizeFeatureId(opts.feature);
  const tier = normalizeTier(opts.tier);
  activateFeature(cwd, featureId, tier);
  const preflight = preflightFeature(cwd, featureId, { mode: 'pre-ship' });
  const runbook = docuFeature(cwd, featureId, { type: 'runbook' });
  const aiReview = reviewAi(cwd, { mode: 'release', feature: featureId });
  const workstreams = workstreamsPlan(cwd, featureId);
  const handoff = opts.for ? createHandoff(cwd, { feature: featureId, for: opts.for }) : null;
  return {
    mode: 'prepare',
    feature_id: featureId,
    tier,
    target: opts.for || null,
    artifacts: {
      preflight: preflight.artifact,
      runbook: runbook.artifact,
      ai_review: aiReview.artifact,
      ai_review_markdown: aiReview.markdown,
      workstreams: workstreams.artifact,
      workstreams_json: workstreams.json_ref,
      handoff: handoff ? handoff.artifacts.markdown : null,
      handoff_json: handoff ? handoff.artifacts.json : null
    },
    status: workbenchStatus(cwd, { feature: featureId }),
    next_command: 'terrace workbench status --feature ' + featureId
  };
}

module.exports = {
  workbenchStatus,
  workbenchPrepare
};
