'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { analyzeRepository, bulletList } = require('./repo-analysis.cjs');
const { requireInterrogationAnswers, answerLines } = require('./interrogation.cjs');
const { discoverProjectCommands } = require('./project-command-discovery.cjs');
const {
  featureRef,
  normalizeFeatureId,
  normalizeTier,
  seniorArtifactRefs,
  seniorRequirements,
  seniorCycleGateStatus
} = require('./workflow-helpers.cjs');
const { preflightProjectArtifacts, writeProjectText } = require('./managed-artifacts.cjs');

function nowIso() {
  return new Date().toISOString();
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  writeProjectText(cwd, relativeFilePath, lines.join('\n') + '\n');
  return relativeFilePath;
}

function artifactExists(cwd, relativeFilePath) {
  return fs.existsSync(path.resolve(cwd, relativeFilePath));
}

function recordSeniorArtifact(cwd, featureId, tier, artifactKey, artifactRef) {
  const state = loadState(cwd);
  const seniorCycle = state.senior_cycle || { features: {} };
  const features = seniorCycle.features || {};
  const current = features[featureId] || { feature_id: featureId };
  const artifacts = current.artifacts || {};
  const nextState = {
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
          architecture_default: 'sustainable',
          no_band_aid_rule: true,
          artifacts: {
            ...artifacts,
            [artifactKey]: artifactRef
          },
          updated_at: nowIso()
        }
      }
    }
  };
  saveState(cwd, nextState);
}

function seniorCycleStatus(cwd, feature, tier) {
  const featureId = normalizeFeatureId(feature);
  const normalizedTier = normalizeTier(tier);
  const requirements = seniorRequirements(featureId, normalizedTier);
  const existingArtifacts = requirements.all.filter((artifact) => artifactExists(cwd, artifact));
  return seniorCycleGateStatus({ feature: featureId, tier: normalizedTier, existingArtifacts });
}

function seniorFeatureForState(state, featureId, fallbackTier) {
  const seniorCycle = state.senior_cycle || {};
  const features = seniorCycle.features || {};
  const current = features[featureId] || {};
  return {
    feature_id: featureId,
    tier: current.tier || fallbackTier || 'medium',
    opted_in: Boolean(features[featureId])
  };
}

function activeSeniorFeature(state) {
  const seniorCycle = state.senior_cycle || {};
  const activeFeature = seniorCycle.active_feature || (state.workflow && state.workflow.active_feature);
  if (!activeFeature) {
    return null;
  }
  return seniorFeatureForState(state, activeFeature, 'medium');
}

function seniorCycleShipCheck(cwd) {
  try {
    const state = loadState(cwd);
    const feature = activeSeniorFeature(state);
    if (!feature) {
      return {
        category: 'senior_cycle',
        command: 'terrace workbench status',
        passed: true,
        skipped: true,
        blocking: [],
        warnings: []
      };
    }
    const status = seniorCycleStatus(cwd, feature.feature_id, feature.tier);
    const blocking = status.allowed.ship ? [] : status.blockers.filter((blocker) => {
      return blocker.code === 'OBSERVABILITY_REQUIRED' || blocker.code === 'VALIDATION_REQUIRED';
    });
    return {
      category: 'senior_cycle',
      command: 'terrace workbench status --feature ' + feature.feature_id,
      passed: blocking.length === 0,
      senior_cycle: status,
      blocking,
      warnings: []
    };
  } catch (error) {
    return {
      category: 'senior_cycle',
      command: 'terrace workbench status',
      passed: false,
      blocking: [{
        code: 'SENIOR_CYCLE_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        remediation: 'Run terrace init before checking senior-cycle readiness.'
      }],
      warnings: []
    };
  }
}

function alignFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).alignment;
  const repo = analyzeRepository(cwd);
  const changed = repo.changed_files.slice(0, 10);
  const riskFiles = repo.files.filter((file) => /(auth|billing|payment|migration|schema|api|route|cache|env)/i.test(file)).slice(0, 10);
  writeMarkdown(cwd, artifact, [
    '# Alignment: ' + featureId,
    '',
    '## Customer',
    '- Primary users and operators of ' + featureId + '.',
    '',
    '## Problem',
    '- Repository evidence indicates this feature touches ' + (changed.length > 0 ? changed.join(', ') : 'the current project surface') + '.',
    '',
    '## Success Metrics',
    '- `terrace ship check` passes.',
    '- User-visible paths and changed tests pass verification.',
    '',
    '## Non-goals',
    '- Do not expand beyond files and artifacts linked to ' + featureId + ' without a new alignment update.',
    '',
    '## Edge Cases',
    '- Invalid input, permission denial, partial deploy, stale cache, and rollback behavior.',
    '',
    '## Risks',
    ...(riskFiles.length > 0 ? riskFiles.map((file) => '- Review risk-bearing file: ' + file) : ['- No risk-bearing files detected from current repository names.']),
    '',
    '## Feature Flag Decision',
    '- Decision: required for risky rollout, optional only when the blast radius is clearly small.',
    '- If risk-bearing files are modified, use a flag or documented rollout guard.',
    '',
    '## Observability Plan',
    '- Use detected observability files or add feature-specific logs before release.',
    '',
    '## Validation Plan',
    '- Run tests, security check, review, preflight, and post-deploy signal checks.',
    '',
    '## Cleanup Plan',
    '- Track temporary flags, rollout code, docs drift, and cleanup ownership in `terrace cleanup ' + featureId + '`.',
    '',
    '## No Band-Aid Rule',
    '- Default to sustainable architecture. Do not choose a quick fix unless it explicitly preserves future development and expansion.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'alignment', artifact);
  return { feature_id: featureId, tier, artifact, next_command: tier === 'large' ? 'terrace interrogate ' + featureId : 'terrace test-plan ' + featureId };
}

function interrogateFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).interrogation;
  const repo = analyzeRepository(cwd);
  const interrogation = requireInterrogationAnswers(featureId, 'init', repo, options);
  writeMarkdown(cwd, artifact, [
    '# Interrogation: ' + featureId,
    '',
    '## User Answers',
    ...answerLines(interrogation.userAnswers).map((line) => line.length > 0 ? line : ''),
    '',
    '## Questions Asked',
    ...interrogation.questions.map((question) => '- ' + question),
    '',
    '## Assumptions To Challenge',
    '- Customer behavior must match changed routes/components: ' + (repo.route_hints.concat(repo.component_hints).slice(0, 8).join(', ') || 'no UI files detected'),
    '- Data shape must match migrations/schema files: ' + (repo.migrations.slice(0, 8).join(', ') || 'no migrations detected'),
    '',
    '## How Does This Fail?',
    '- Permission checks can reject valid users or allow invalid access.',
    '- API/client calls can time out, retry incorrectly, or show stale state.',
    '- Migrations and cache changes can make rollback unsafe.',
    '',
    '## Edge Case Inventory',
    '- Empty input, malformed input, unauthorized user, expired session, slow dependency, duplicate submit, rollback after deploy.',
    '',
    '## Pessimistic Review',
    '- The highest maintenance risk is hidden coupling across shared files, schemas, auth, billing, or route exports.',
    '',
    '## Exit Criteria',
    '- Failure modes are explicit enough to test or consciously defer.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'interrogation', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace design ' + featureId };
}

function mapCodebase(cwd) {
  const discovered = discoverProjectCommands(cwd);
  const repo = analyzeRepository(cwd);
  const refs = seniorArtifactRefs('codebase');
  const artifacts = [
    refs.codebase_map,
    refs.codebase_architecture,
    refs.codebase_risks,
    refs.codebase_testing,
    refs.codebase_observability
  ];
  preflightProjectArtifacts(cwd, artifacts);
  writeMarkdown(cwd, refs.codebase_map, [
    '# Codebase Map',
    '',
    '## Purpose',
    '- Identify the major source areas, ownership boundaries, and likely change paths before feature work.',
    '',
    '## Source Areas',
    ...bulletList(Object.entries(repo.lanes).filter((entry) => entry[1].length > 0).map((entry) => entry[0] + ': ' + entry[1].slice(0, 6).join(', ')), 'No source areas detected.'),
    '',
    '## Commands',
    ...discovered.checks.map((check) => '- ' + check.category + ': ' + (check.exists ? check.command : 'missing'))
  ]);
  writeMarkdown(cwd, refs.codebase_architecture, [
    '# Codebase Architecture',
    '',
    '## Current Architecture',
    '- Runtime files: ' + repo.source_files.slice(0, 12).join(', '),
    '- Package scripts: ' + Object.keys(repo.scripts).join(', '),
    '- Internal imports sampled: ' + repo.imports.filter((item) => item.source.startsWith('.')).slice(0, 10).map((item) => item.file + ' -> ' + item.source).join('; '),
    '',
    '## Maintainability Constraints',
    '- No Band-Aid Rule: default to sustainable architecture and avoid shortcuts that block future expansion.'
  ]);
  writeMarkdown(cwd, refs.codebase_risks, [
    '# Codebase Risks',
    '',
    '## Known Risks',
    ...bulletList(repo.files.filter((file) => /(auth|billing|payment|migration|schema|api|route|cache|env|workflow)/i.test(file)).slice(0, 20), 'No filename-based risk hotspots detected.')
  ]);
  writeMarkdown(cwd, refs.codebase_testing, [
    '# Codebase Testing',
    '',
    '## Test Strategy',
    '- Test files detected: ' + String(repo.test_files.length),
    ...bulletList(repo.test_files.slice(0, 20), 'No test files detected.')
  ]);
  writeMarkdown(cwd, refs.codebase_observability, [
    '# Codebase Observability',
    '',
    '## Debugging Surface',
    ...bulletList(repo.files.filter((file) => /(observability|telemetry|logger|logging|metrics|trace|sentry|datadog)/i.test(file)).slice(0, 20), 'No observability/debugging files detected.')
  ]);
  return { artifacts, next_command: 'terrace design <feature>' };
}

function designFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).design;
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# Design: ' + featureId,
    '',
    '## Architecture Decision',
    '- Implement within detected project boundaries: ' + Object.keys(repo.scripts).join(', '),
    '- Keep changes close to related source files: ' + (repo.changed_files.slice(0, 8).join(', ') || repo.source_files.slice(0, 8).join(', ')),
    '',
    '## Tradeoffs',
    '- Prefer local changes over broad framework rewrites because Terrace found focused source and artifact boundaries.',
    '',
    '## Maintainability',
    '- Preserve package scripts, public exports, and shared schema/auth boundaries unless explicitly reviewed.',
    '',
    '## No Band-Aid Rule',
    '- A quick fix is not acceptable unless it leaves a clear path to the long-term design and documents the cleanup contract.',
    '',
    '## Exit Criteria',
    '- The implementation path is clear enough to test first and maintain after release.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'design', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace test-plan ' + featureId };
}

function testPlanFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).test_plan;
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# Test Plan',
    '',
    '## Feature',
    '- ' + featureId,
    '',
    '## What Is Tested',
    '- Behavior around changed files: ' + (repo.changed_files.slice(0, 8).join(', ') || 'feature implementation files once identified'),
    '- Existing test files: ' + (repo.test_files.slice(0, 8).join(', ') || 'none detected'),
    '',
    '## What Is NOT Tested',
    '- External services are covered by contract or fixture behavior unless integration evidence is added.',
    '',
    '## Failure Scenarios',
    '- Unauthorized access, invalid input, dependency failure, rollback-sensitive data change, and stale UI state.',
    '',
    '## Critical Paths',
    ...bulletList(repo.route_hints.slice(0, 10), 'No route files detected; identify critical paths from feature scope.'),
    '',
    '## TDD Gate',
    '- RED evidence must exist before implementation is treated as allowed.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'test_plan', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace observe ' + featureId };
}

function observeFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).observability;
  const repo = analyzeRepository(cwd);
  const observability = repo.files.filter((file) => /(observability|telemetry|logger|logging|metrics|trace|sentry|datadog)/i.test(file)).slice(0, 12);
  writeMarkdown(cwd, artifact, [
    '# Observability: ' + featureId,
    '',
    '## Logs',
    '- Use structured logs around feature entry, failure, and rollback paths.',
    ...bulletList(observability, 'No logging files detected.'),
    '',
    '## Metrics',
    '- Track success rate, error rate, latency, retry count, and rollback trigger count.',
    '',
    '## Traces',
    '- Trace API/server boundaries and propagate request or operation correlation IDs.',
    '',
    '## User Analytics',
    '- Track user-visible completion, abandonment, and error recovery signals.',
    '',
    '## Debugging Path',
    '- Start with release logs, then inspect changed route/API files and preflight evidence.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'observability', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace validate-prod ' + featureId };
}

function validateProdFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).validation;
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# Production Validation: ' + featureId,
    '',
    '## Success Signals',
    '- Tests and `terrace ship check` pass.',
    '- Runtime signals show stable success rate for changed entrypoints.',
    '',
    '## Monitoring Plan',
    '- Review logs and metrics for files/routes: ' + (repo.route_hints.slice(0, 8).join(', ') || repo.source_files.slice(0, 8).join(', ')),
    '',
    '## Rollback Conditions',
    '- Roll back on elevated error rate, failed migration behavior, auth failures, or user-visible data loss.',
    '',
    '## Owner',
    '- Release owner assigned by the active workstream or PR owner.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'validation', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace cleanup ' + featureId };
}

function cleanupFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).cleanup;
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# Cleanup: ' + featureId,
    '',
    '## Flags To Remove',
    '- Remove feature flags after rollout signals are stable and rollback window closes.',
    '',
    '## Temporary Code To Refactor',
    '- Inspect changed files for temporary rollout code: ' + (repo.changed_files.slice(0, 8).join(', ') || 'no git diff files detected'),
    '',
    '## Documentation Updates',
    '- Update feature docs, release notes, and runbook artifacts generated by Terrace.',
    '',
    '## Completion Gate',
    '- Cleanup is complete when temporary rollout code, stale flags, and outdated docs are removed or intentionally tracked.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'cleanup', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace ship check' };
}

function uiImportStitch(cwd, feature) {
  const featureId = normalizeFeatureId(feature);
  const artifact = featureRef(featureId) + '/UI-STITCH.md';
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# Stitch Import: ' + featureId,
    '',
    '## Purpose',
    '- Capture imported Stitch design intent before UI implementation.',
    '',
    '## Source',
    '- Stitch source reference must be provided in the design-source import command for final evidence.',
    '',
    '## Greenfield Build Notes',
    ...bulletList(repo.route_hints.concat(repo.component_hints), 'No existing UI files detected; create routes/components from the imported design.'),
    '',
    '## Brownfield Constraints',
    '- Preserve existing route and component conventions from detected UI files.',
    '',
    '## No Band-Aid Rule',
    '- UI implementation must fit the app architecture and remain maintainable after the design import.'
  ]);
  recordSeniorArtifact(cwd, featureId, 'medium', 'ui_stitch', artifact);
  return { feature_id: featureId, artifact, next_command: 'terrace ui plan-refresh ' + featureId };
}

function uiPlanRefresh(cwd, feature) {
  const featureId = normalizeFeatureId(feature);
  const artifact = featureRef(featureId) + '/UI-REFRESH.md';
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# UI Refresh: ' + featureId,
    '',
    '## Brownfield Refresh Plan',
    ...bulletList(repo.route_hints.concat(repo.component_hints), 'No current screens/components detected.'),
    '',
    '## Greenfield Plan',
    '- Create routes/components only where no detected UI surface already fits the feature.',
    '',
    '## Interaction States',
    '- Cover loading, empty, error, success, disabled, and responsive states.',
    '',
    '## Test Strategy',
    '- Add UI behavior tests and screenshot/browser verification for changed routes.',
    '',
    '## Architecture Fit',
    '- Keep components reusable and consistent with detected component directories.'
  ]);
  recordSeniorArtifact(cwd, featureId, 'medium', 'ui_refresh', artifact);
  return { feature_id: featureId, artifact, next_command: 'terrace ui diff ' + featureId };
}

function uiDiff(cwd, feature) {
  const featureId = normalizeFeatureId(feature);
  const artifact = featureRef(featureId) + '/UI-DIFF.md';
  const repo = analyzeRepository(cwd);
  writeMarkdown(cwd, artifact, [
    '# UI Diff: ' + featureId,
    '',
    '## Source vs Target',
    '- Compare imported target against current files: ' + (repo.route_hints.concat(repo.component_hints).slice(0, 10).join(', ') || 'no UI files detected'),
    '',
    '## Reuse Plan',
    '- Reuse detected component files before adding parallel UI structures.',
    '',
    '## Risk Notes',
    '- Verify accessibility, responsive behavior, layout stability, and design ambiguity before ship.',
    '',
    '## Verification',
    '- Capture mobile and desktop screenshots plus interaction checks for changed routes.'
  ]);
  recordSeniorArtifact(cwd, featureId, 'medium', 'ui_diff', artifact);
  return { feature_id: featureId, artifact, next_command: 'terrace test-plan ' + featureId };
}


module.exports = {
  seniorCycleStatus,
  seniorFeatureForState,
  activeSeniorFeature,
  seniorCycleShipCheck,
  alignFeature,
  interrogateFeature,
  mapCodebase,
  designFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  uiImportStitch,
  uiPlanRefresh,
  uiDiff
};
