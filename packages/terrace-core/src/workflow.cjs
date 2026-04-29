'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');
const { runDoctor } = require('./health.cjs');
const {
  reportUpdate,
  reportShipCheck,
  preflightShipCheck,
  debtShipCheck,
  documentationShipCheck,
  testEvalShipCheck,
  aiReviewShipCheck,
  ruleAuditShipCheck
} = require('./lifecycle.cjs');

function nowIso() {
  return new Date().toISOString();
}

function ensureDirFor(cwd, relativeFilePath) {
  fs.mkdirSync(path.dirname(path.resolve(cwd, relativeFilePath)), { recursive: true });
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  ensureDirFor(cwd, relativeFilePath);
  fs.writeFileSync(path.resolve(cwd, relativeFilePath), lines.join('\n') + '\n', 'utf8');
  return relativeFilePath;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTextIfExists(cwd, relativeFilePath) {
  if (!relativeFilePath) {
    return null;
  }
  const filePath = path.resolve(cwd, relativeFilePath);
  if (!filePath.startsWith(path.resolve(cwd) + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function firstLines(text, maxLines) {
  return String(text || '').split(/\r?\n/).slice(0, maxLines).join('\n').trim();
}

function extractLikelyFiles(text) {
  const matches = String(text || '').match(/[A-Za-z0-9_./()[\]-]+\.(?:ts|tsx|js|jsx|cjs|mjs|json|md|sql|css|scss|yml|yaml)/g) || [];
  return Array.from(new Set(matches)).slice(0, 12);
}

function phasesFromState(state) {
  return state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
}

function findPhase(state, phaseId) {
  const phase = phasesFromState(state).find((candidate) => candidate.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  return phase;
}

function phaseRef(phase) {
  return 'docs/terrace/phases/' + phase.id;
}

function phaseContext(cwd, state, phase) {
  const plans = Array.isArray(phase.plans) ? phase.plans : [];
  const sourceRefs = plans
    .map((plan) => plan.source_ref)
    .filter((sourceRef) => typeof sourceRef === 'string' && sourceRef.length > 0);
  const sourceSnippets = sourceRefs.map((sourceRef) => {
    const content = readTextIfExists(cwd, sourceRef);
    return {
      source_ref: sourceRef,
      found: Boolean(content),
      snippet: content ? firstLines(content, 18) : ''
    };
  });
  const phaseNumberMatch = String(phase.title || phase.id).match(/phase\s+(\d+(?:\.\d+)?)/i);
  const phaseNumber = phaseNumberMatch ? phaseNumberMatch[1] : null;
  const quickTasks = quickTasksFromState(state).filter((item) => {
    const haystack = [item.title, item.source_dir, item.plan_ref, item.summary_ref].filter(Boolean).join(' ').toLowerCase();
    return phaseNumber ? haystack.includes('phase ' + phaseNumber) || haystack.includes('phase-' + phaseNumber) : haystack.includes(String(phase.id).toLowerCase());
  }).slice(0, 8);
  const likelyFiles = Array.from(new Set(sourceSnippets.flatMap((item) => extractLikelyFiles(item.snippet))));
  return {
    plans,
    source_refs: sourceRefs,
    source_snippets: sourceSnippets,
    quick_tasks: quickTasks,
    likely_files: likelyFiles
  };
}

function planLinesForPhase(phase, blockers, context, discovered) {
  const ctx = context || { plans: [], source_refs: [], source_snippets: [], quick_tasks: [], likely_files: [] };
  const criteria = Array.isArray(phase.success_criteria) ? phase.success_criteria : [];
  const commands = discovered && Array.isArray(discovered.checks)
    ? discovered.checks.filter((check) => check.exists).map((check) => check.command)
    : [];
  return [
    '# ' + phase.title,
    '',
    '## Objective',
    'Execute `' + phase.id + '` with Terrace gates and preserved GSD context.',
    '',
    '## Source',
    '- Phase source: ' + (phase.source_ref || 'Terrace roadmap'),
    '- Existing plan count: ' + String(ctx.plans.length),
    '',
    '## Existing Plans',
    ...(ctx.plans.length > 0 ? ctx.plans.map((plan) => '- ' + (plan.title || plan.id) + ' (' + (plan.source_ref || plan.id || 'no source') + ')') : ['- No migrated plans were attached.']),
    '',
    '## Migrated Context',
    ...(ctx.source_snippets.length > 0 ? ctx.source_snippets.flatMap((item) => [
      '### ' + item.source_ref,
      item.found ? '```md' : '',
      item.found ? item.snippet : 'Not found in this repo copy.',
      item.found ? '```' : ''
    ]) : ['- No source artifacts were attached to this phase.']),
    '',
    '## Likely Files',
    ...(ctx.likely_files.length > 0 ? ctx.likely_files.map((filePath) => '- ' + filePath) : ['- No likely files detected from migrated artifacts.']),
    '',
    '## Related Quick Tasks',
    ...(ctx.quick_tasks.length > 0 ? ctx.quick_tasks.map((item) => '- ' + item.id + ': ' + item.title) : ['- No related quick tasks detected.']),
    '',
    '## Execution Waves',
    '- Wave 1: inspect migrated context, confirm assumptions, and write or update RED tests.',
    '- Wave 2: execute attached plans in order, keeping each change tied to a source artifact.',
    '- Wave 3: run validation commands, review the diff, update state, and prepare completion notes.',
    '',
    '## Acceptance Criteria',
    ...(criteria.length > 0 ? criteria.map((item) => '- ' + item) : ['- Typecheck, lint, tests, audit, and ship checks are deterministic.']),
    '',
    '## Project Commands',
    ...(commands.length > 0 ? commands.map((command) => '- ' + command) : ['- No executable project quality scripts were discovered.']),
    '',
    '## Blockers',
    ...(blockers.length > 0 ? blockers.map((item) => '- BLOCKING: ' + item.description) : ['- None recorded.']),
    '',
    '## Next Commands',
    '- terrace phase execute ' + phase.id,
    '- terrace phase validate ' + phase.id,
    '- terrace phase review ' + phase.id,
    '- terrace phase complete ' + phase.id
  ];
}

function updatePhase(state, phaseId, fields) {
  return {
    ...state,
    roadmap: {
      ...state.roadmap,
      phases: phasesFromState(state).map((phase) => phase.id === phaseId ? { ...phase, ...fields } : phase)
    }
  };
}

function executionQueueForPhase(phase, context, discovered) {
  const plans = context.plans.length > 0 ? context.plans : [{ id: phase.id + '-plan', title: phase.title, source_ref: phase.plan_ref || phase.source_ref || null }];
  const commands = discovered.checks.filter((check) => check.exists).map((check) => check.command);
  return plans.map((plan, index) => ({
    id: plan.id || phase.id + '-task-' + String(index + 1),
    title: plan.title || 'Execute ' + phase.title,
    source_ref: plan.source_ref || null,
    status: 'ready',
    wave: index + 1,
    likely_files: context.likely_files,
    validation_commands: commands,
    agent_prompt: 'Implement ' + (plan.title || phase.title) + ' for ' + phase.id + ', then run the listed validation commands and update Terrace state.'
  }));
}

function executionLinesForPhase(phase, queue, discovered) {
  return [
    '# Execution Queue: ' + phase.title,
    '',
    '## Mode',
    '- Terrace prepares an execution queue and gate evidence; product-code edits remain explicit agent work.',
    '',
    '## Tasks',
    ...queue.flatMap((task) => [
      '### ' + task.id + ': ' + task.title,
      '- Source: ' + (task.source_ref || 'Terrace generated'),
      '- Status: ' + task.status,
      '- Wave: ' + String(task.wave),
      '- Agent prompt: ' + task.agent_prompt,
      '- Likely files: ' + (task.likely_files.length > 0 ? task.likely_files.join(', ') : 'none detected'),
      '- Validation: ' + (task.validation_commands.length > 0 ? task.validation_commands.join(' && ') : 'no project scripts discovered')
    ]),
    '',
    '## Project Commands',
    ...discovered.checks.map((check) => '- ' + check.category + ': ' + (check.exists ? check.command : 'missing; suggested ' + check.suggested)),
    '',
    '## Next Command',
    '- terrace phase validate ' + phase.id
  ];
}

function quickTasksFromState(state) {
  return Array.isArray(state.quick_tasks) ? state.quick_tasks : [];
}

function quickTaskRef(itemId) {
  return 'docs/terrace/quick/' + itemId;
}

function nextQuickId(items) {
  let counter = items.length + 1;
  let candidate = 'terrace-quick-' + String(counter);
  const existing = new Set(items.map((item) => item.id));
  while (existing.has(candidate)) {
    counter += 1;
    candidate = 'terrace-quick-' + String(counter);
  }
  return candidate;
}

function findQuickTask(state, itemId) {
  const item = quickTasksFromState(state).find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('Unknown quick task: ' + itemId);
  }
  return item;
}

function updateQuickTask(state, itemId, fields) {
  return {
    ...state,
    quick_tasks: quickTasksFromState(state).map((item) => item.id === itemId ? { ...item, ...fields } : item)
  };
}

function findPhaseByText(state, text) {
  const match = text.match(/(?:phase|plan-phase|execute-phase|validate-phase|review-phase|complete-phase)\s+([a-z0-9_.-]+)/i);
  if (!match) {
    return null;
  }
  const token = match[1].toLowerCase();
  return phasesFromState(state).find((phase) => {
    if (String(phase.id || '').toLowerCase() === token) {
      return true;
    }
    const titleMatch = String(phase.title || '').match(/phase\s+(\d+(?:\.\d+)?)/i);
    return titleMatch && titleMatch[1] === token;
  }) || null;
}

function packageManagerFor(cwd) {
  if (fs.existsSync(path.resolve(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.resolve(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

function runCommandFor(packageManager, scriptName) {
  if (packageManager === 'yarn') {
    return ['yarn', scriptName];
  }
  return [packageManager, 'run', scriptName];
}

function discoverProjectCommands(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const packageManager = packageManagerFor(cwd);
  const desired = [
    { category: 'typecheck', script: 'typecheck', required: false, suggested: 'tsc --noEmit' },
    { category: 'lint', script: 'lint', required: true, suggested: 'eslint .' },
    { category: 'test', script: 'test', required: false, suggested: 'vitest run or npm test equivalent' },
    { category: 'coverage', script: 'test:coverage', required: false, suggested: 'vitest run --coverage or project equivalent' },
    { category: 'package', script: 'package:dry-run', required: false, suggested: 'npm pack --dry-run' },
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
  return {
    package_manager: packageManager,
    scripts,
    checks
  };
}

function normalizeFeatureId(feature) {
  const id = String(feature || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) {
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

function missingArtifacts(cwd, artifacts) {
  return artifacts.filter((artifact) => !artifactExists(cwd, artifact));
}

function seniorCycleStatus(cwd, feature, tier) {
  const featureId = normalizeFeatureId(feature);
  const normalizedTier = normalizeTier(tier);
  const requirements = seniorRequirements(featureId, normalizedTier);
  const missingExecute = missingArtifacts(cwd, requirements.execute);
  const missingImplement = missingArtifacts(cwd, requirements.implement);
  const missingShip = missingArtifacts(cwd, requirements.ship);
  const missingComplete = missingArtifacts(cwd, requirements.complete);
  const blockers = Array.from(new Set([...missingExecute, ...missingImplement, ...missingShip, ...missingComplete]))
    .map((artifact) => blockerForArtifact(artifact));
  return {
    feature_id: featureId,
    tier: normalizedTier,
    architecture_default: 'sustainable',
    no_band_aid_rule: true,
    required_artifacts: requirements.all,
    missing_artifacts: Array.from(new Set([...missingExecute, ...missingImplement, ...missingShip, ...missingComplete])),
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
        command: 'terrace senior-cycle status',
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
      command: 'terrace senior-cycle status ' + feature.feature_id,
      passed: blocking.length === 0,
      senior_cycle: status,
      blocking,
      warnings: []
    };
  } catch (error) {
    return {
      category: 'senior_cycle',
      command: 'terrace senior-cycle status',
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

function verificationBlocker(artifact) {
  return {
    code: 'VERIFICATION_REQUIRED',
    artifact,
    message: 'No completion without verification evidence.',
    remediation: 'Write verification evidence before completing this quick task.'
  };
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

function alignFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).alignment;
  writeMarkdown(cwd, artifact, [
    '# Alignment: ' + featureId,
    '',
    '## Customer',
    '- TODO: Identify the customer or operator who benefits from this change.',
    '',
    '## Problem',
    '- TODO: State the problem in observable terms.',
    '',
    '## Success Metrics',
    '- TODO: Define big-picture success signals.',
    '',
    '## Non-goals',
    '- TODO: List what this change intentionally will not solve.',
    '',
    '## Edge Cases',
    '- TODO: Capture important boundaries, invalid inputs, and degraded paths.',
    '',
    '## Risks',
    '- TODO: List product, technical, migration, data, security, and operations risks.',
    '',
    '## Feature Flag Decision',
    '- Decision: required for risky rollout, optional only when the blast radius is clearly small.',
    '- TODO: Record flag name, rollout owner, and cleanup trigger or explain why no flag is needed.',
    '',
    '## Observability Plan',
    '- TODO: Name logs, metrics, traces, analytics, and debugging entry points.',
    '',
    '## Validation Plan',
    '- TODO: Define post-deploy success signals and rollback conditions.',
    '',
    '## Cleanup Plan',
    '- TODO: Name temporary code, flags, docs, and follow-up ownership.',
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
  writeMarkdown(cwd, artifact, [
    '# Interrogation: ' + featureId,
    '',
    '## Assumptions To Challenge',
    '- TODO: What are we assuming about customer behavior, data shape, timing, permissions, and dependencies?',
    '',
    '## How Does This Fail?',
    '- TODO: Describe failure modes, degraded behavior, confusing states, and recovery paths.',
    '',
    '## Edge Case Inventory',
    '- TODO: List boundary cases before implementation.',
    '',
    '## Pessimistic Review',
    '- TODO: Identify the most likely way this becomes hard to maintain.',
    '',
    '## Exit Criteria',
    '- Failure modes are explicit enough to test or consciously defer.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'interrogation', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace design ' + featureId };
}

function mapCodebase(cwd) {
  const discovered = discoverProjectCommands(cwd);
  const refs = seniorArtifactRefs('codebase');
  const artifacts = [
    refs.codebase_map,
    refs.codebase_architecture,
    refs.codebase_risks,
    refs.codebase_testing,
    refs.codebase_observability
  ];
  writeMarkdown(cwd, refs.codebase_map, [
    '# Codebase Map',
    '',
    '## Purpose',
    '- Identify the major source areas, ownership boundaries, and likely change paths before feature work.',
    '',
    '## Source Areas',
    '- TODO: Fill with module directories and responsibilities.',
    '',
    '## Commands',
    ...discovered.checks.map((check) => '- ' + check.category + ': ' + (check.exists ? check.command : 'missing'))
  ]);
  writeMarkdown(cwd, refs.codebase_architecture, [
    '# Codebase Architecture',
    '',
    '## Current Architecture',
    '- TODO: Document core runtime boundaries and extension points.',
    '',
    '## Maintainability Constraints',
    '- No Band-Aid Rule: default to sustainable architecture and avoid shortcuts that block future expansion.'
  ]);
  writeMarkdown(cwd, refs.codebase_risks, [
    '# Codebase Risks',
    '',
    '## Known Risks',
    '- TODO: Document fragile modules, migration concerns, data loss risks, and operational hazards.'
  ]);
  writeMarkdown(cwd, refs.codebase_testing, [
    '# Codebase Testing',
    '',
    '## Test Strategy',
    '- TODO: Document test layers, critical paths, and gaps.'
  ]);
  writeMarkdown(cwd, refs.codebase_observability, [
    '# Codebase Observability',
    '',
    '## Debugging Surface',
    '- TODO: Document logs, metrics, traces, dashboards, and production investigation paths.'
  ]);
  return { artifacts, next_command: 'terrace design <feature>' };
}

function designFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).design;
  writeMarkdown(cwd, artifact, [
    '# Design: ' + featureId,
    '',
    '## Architecture Decision',
    '- TODO: Describe the design and how it fits existing boundaries.',
    '',
    '## Tradeoffs',
    '- TODO: Record rejected alternatives and why this approach wins.',
    '',
    '## Maintainability',
    '- TODO: Explain how this supports future development and expansion.',
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
  writeMarkdown(cwd, artifact, [
    '# Test Plan',
    '',
    '## Feature',
    '- ' + featureId,
    '',
    '## What Is Tested',
    '- TODO: Define behavior-first tests before implementation.',
    '',
    '## What Is NOT Tested',
    '- TODO: Record consciously deferred cases and why.',
    '',
    '## Failure Scenarios',
    '- TODO: List failures that must be proven by tests or manual verification.',
    '',
    '## Critical Paths',
    '- TODO: Name the end-to-end paths that cannot regress.',
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
  writeMarkdown(cwd, artifact, [
    '# Observability: ' + featureId,
    '',
    '## Logs',
    '- TODO: Name structured logs and useful fields.',
    '',
    '## Metrics',
    '- TODO: Name counters, rates, latency, and failure metrics.',
    '',
    '## Traces',
    '- TODO: Name traced boundaries and correlation IDs.',
    '',
    '## User Analytics',
    '- TODO: Name product signals that prove user-visible behavior.',
    '',
    '## Debugging Path',
    '- TODO: Describe how an on-call engineer investigates post-launch issues.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'observability', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace validate-prod ' + featureId };
}

function validateProdFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).validation;
  writeMarkdown(cwd, artifact, [
    '# Production Validation: ' + featureId,
    '',
    '## Success Signals',
    '- TODO: Define post-deploy signals that prove the change works.',
    '',
    '## Monitoring Plan',
    '- TODO: Define dashboards, alert checks, log queries, and review timing.',
    '',
    '## Rollback Conditions',
    '- TODO: Define thresholds or symptoms that trigger rollback.',
    '',
    '## Owner',
    '- TODO: Name who watches the launch window.'
  ]);
  recordSeniorArtifact(cwd, featureId, tier, 'validation', artifact);
  return { feature_id: featureId, tier, artifact, next_command: 'terrace cleanup ' + featureId };
}

function cleanupFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const tier = normalizeTier(options && options.tier);
  const artifact = seniorArtifactRefs(featureId).cleanup;
  writeMarkdown(cwd, artifact, [
    '# Cleanup: ' + featureId,
    '',
    '## Flags To Remove',
    '- TODO: List feature flags and removal trigger.',
    '',
    '## Temporary Code To Refactor',
    '- TODO: List temporary choices and the intended durable shape.',
    '',
    '## Documentation Updates',
    '- TODO: List docs that must change before completion.',
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
  writeMarkdown(cwd, artifact, [
    '# Stitch Import: ' + featureId,
    '',
    '## Purpose',
    '- Capture imported Stitch design intent before UI implementation.',
    '',
    '## Source',
    '- TODO: Record Stitch URL, export path, screenshot path, or design handoff reference.',
    '',
    '## Greenfield Build Notes',
    '- TODO: Identify primary screens, components, states, responsive behavior, and assets.',
    '',
    '## Brownfield Constraints',
    '- TODO: Identify existing routes, components, data contracts, and visual conventions to preserve.',
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
  writeMarkdown(cwd, artifact, [
    '# UI Refresh: ' + featureId,
    '',
    '## Brownfield Refresh Plan',
    '- TODO: Map current screens/components to target design changes.',
    '',
    '## Greenfield Plan',
    '- TODO: Define new routes, components, states, and asset requirements when no prior UI exists.',
    '',
    '## Interaction States',
    '- TODO: Cover loading, empty, error, success, disabled, and responsive states.',
    '',
    '## Test Strategy',
    '- TODO: Define UI behavior tests and visual verification steps before implementation.',
    '',
    '## Architecture Fit',
    '- TODO: Explain how components remain reusable, localized, and consistent with existing patterns.'
  ]);
  recordSeniorArtifact(cwd, featureId, 'medium', 'ui_refresh', artifact);
  return { feature_id: featureId, artifact, next_command: 'terrace ui diff ' + featureId };
}

function uiDiff(cwd, feature) {
  const featureId = normalizeFeatureId(feature);
  const artifact = featureRef(featureId) + '/UI-DIFF.md';
  writeMarkdown(cwd, artifact, [
    '# UI Diff: ' + featureId,
    '',
    '## Source vs Target',
    '- TODO: Record visual, interaction, content, and responsive differences.',
    '',
    '## Reuse Plan',
    '- TODO: Identify components to reuse, extend, or replace.',
    '',
    '## Risk Notes',
    '- TODO: Identify regressions, accessibility concerns, layout risks, and design ambiguities.',
    '',
    '## Verification',
    '- TODO: Capture screenshots or browser checks required before ship.'
  ]);
  recordSeniorArtifact(cwd, featureId, 'medium', 'ui_diff', artifact);
  return { feature_id: featureId, artifact, next_command: 'terrace test-plan ' + featureId };
}

function phaseList(cwd) {
  const state = loadState(cwd);
  return {
    phases: phasesFromState(state)
  };
}

function phaseShow(cwd, phaseId) {
  return { phase: findPhase(loadState(cwd), phaseId) };
}

function phasePlan(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const context = phaseContext(cwd, state, phase);
  const discovered = discoverProjectCommands(cwd);
  const planRef = phaseRef(phase) + '/PLAN.md';
  writeMarkdown(cwd, planRef, planLinesForPhase(phase, blockers, context, discovered));
  const plannedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'planned',
      plan_ref: planRef,
      planned_at: plannedAt,
      source_refs: context.source_refs,
      likely_files: context.likely_files,
      next_command: 'terrace phase execute ' + phase.id
    }),
    workflow: {
      ...state.workflow,
      status: 'slice_planned',
      active_feature: phase.id
    },
    active_slice: {
      id: phase.id,
      title: phase.title,
      source_ref: phase.source_ref,
      plans: phase.plans || [],
      spec_refs: phase.spec_refs || [],
      success_criteria: phase.success_criteria || [],
      test_intent: []
    }
  };
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'slice_planned',
    plan_ref: planRef,
    source_refs: context.source_refs,
    likely_files: context.likely_files,
    related_quick_tasks: context.quick_tasks,
    blocked: blockers.length > 0,
    blockers,
    next_command: 'terrace phase execute ' + phase.id,
    active_slice: nextState.active_slice
  };
}

function phaseExecute(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const context = phaseContext(cwd, state, phase);
  const discovered = discoverProjectCommands(cwd);
  const queue = executionQueueForPhase(phase, context, discovered);
  if (blockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      queue,
      blockers,
      required_action: 'Resolve blocking handoff actions before execution.'
    };
  }
  const seniorFeature = seniorFeatureForState(state, phase.id, 'medium');
  const seniorGate = seniorCycleStatus(cwd, phase.id, seniorFeature.tier);
  if (!seniorGate.allowed.execute) {
    return {
      allowed: false,
      phase_id: phase.id,
      queue,
      blockers: seniorGate.blockers,
      senior_cycle: seniorGate,
      required_action: 'Complete senior-cycle gates before execution.'
    };
  }
  const startedAt = nowIso();
  const waves = [
    { id: 'red', status: 'required', command: 'terrace phase validate ' + phase.id },
    { id: 'implementation', status: 'pending', command: 'terrace phase review ' + phase.id },
    { id: 'completion', status: 'pending', command: 'terrace phase complete ' + phase.id }
  ];
  const executionRef = phaseRef(phase) + '/EXECUTION.md';
  writeMarkdown(cwd, executionRef, executionLinesForPhase(phase, queue, discovered));
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'executing',
      execution_started_at: startedAt,
      execution_ref: executionRef,
      execution: {
        status: 'red_required',
        queue,
        waves
      },
      next_command: 'terrace phase validate ' + phase.id
    }),
    workflow: {
      ...state.workflow,
      status: 'red_required',
      active_feature: phase.id
    },
    active_slice: state.active_slice && state.active_slice.id === phase.id ? state.active_slice : {
      id: phase.id,
      title: phase.title,
      source_ref: phase.source_ref,
      plans: phase.plans || [],
      spec_refs: phase.spec_refs || [],
      success_criteria: phase.success_criteria || [],
      test_intent: []
    }
  };
  saveState(cwd, nextState);
  return {
    allowed: true,
    phase_id: phase.id,
    status: 'red_required',
    execution_ref: executionRef,
    queue,
    waves,
    next_action: 'Add RED evidence before implementation.'
  };
}

function phaseValidate(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const discovered = discoverProjectCommands(cwd);
  const commands = discovered.checks.filter((check) => check.exists).map((check) => check.command);
  const validationRef = phaseRef(phase) + '/VALIDATION.md';
  writeMarkdown(cwd, validationRef, [
    '# Validation: ' + phase.title,
    '',
    '## Required Evidence',
    '- RED evidence exists before implementation work is marked complete.',
    '- Typecheck, lint, tests, and audit are run before phase completion.',
    '',
    '## Commands',
    ...(commands.length > 0 ? commands.map((command) => '- ' + command) : ['- No project quality scripts were discovered.']),
    '- terrace audit',
    '',
    '## Missing Script Recommendations',
    ...discovered.checks.filter((check) => !check.exists).map((check) => '- ' + check.category + ': add `' + check.script + '` such as `' + check.suggested + '`.'),
    '',
    '## Next Command',
    '- terrace phase review ' + phase.id
  ]);
  const nextState = updatePhase(state, phase.id, {
    status: 'validation_ready',
    validation_ref: validationRef,
    validated_at: nowIso(),
    next_command: 'terrace phase review ' + phase.id
  });
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'validation_ready',
    validation_ref: validationRef,
    next_command: 'terrace phase review ' + phase.id
  };
}

function phaseReview(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const reviewRef = phaseRef(phase) + '/REVIEW.md';
  writeMarkdown(cwd, reviewRef, [
    '# Review: ' + phase.title,
    '',
    '## Review Checklist',
    '- Diff is scoped to the phase objective.',
    '- Tests prove the behavior and failure modes.',
    '- State, docs, and migration notes are current.',
    '- No user-authored files are overwritten without intent.',
    '',
    '## Next Command',
    '- terrace phase complete ' + phase.id
  ]);
  const nextState = updatePhase(state, phase.id, {
    status: 'review_ready',
    review_ref: reviewRef,
    reviewed_at: nowIso(),
    next_command: 'terrace phase complete ' + phase.id
  });
  saveState(cwd, nextState);
  return {
    phase_id: phase.id,
    status: 'review_ready',
    review_ref: reviewRef,
    next_command: 'terrace phase complete ' + phase.id
  };
}

function phaseComplete(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const seniorFeature = seniorFeatureForState(state, phase.id, 'medium');
  const seniorGate = seniorCycleStatus(cwd, phase.id, seniorFeature.tier);
  if (!seniorGate.allowed.complete) {
    return {
      allowed: false,
      phase_id: phase.id,
      blockers: seniorGate.blockers.filter((blocker) => blocker.code === 'CLEANUP_REQUIRED'),
      senior_cycle: seniorGate,
      required_action: 'Complete senior-cycle cleanup before phase completion.'
    };
  }
  const summaryRef = phaseRef(phase) + '/SUMMARY.md';
  writeMarkdown(cwd, summaryRef, [
    '# Summary: ' + phase.title,
    '',
    '## Completed Work',
    '- Phase marked complete through Terrace workflow state.',
    '',
    '## Evidence',
    '- Plan: ' + (phase.plan_ref || phaseRef(phase) + '/PLAN.md'),
    '- Validation: ' + (phase.validation_ref || phaseRef(phase) + '/VALIDATION.md'),
    '- Review: ' + (phase.review_ref || phaseRef(phase) + '/REVIEW.md'),
    '',
    '## Follow-up',
    '- Run terrace ship check before release.'
  ]);
  const completedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'completed',
      summary_ref: summaryRef,
      completed_at: completedAt,
      next_command: 'terrace ship check'
    }),
    workflow: {
      ...state.workflow,
      status: 'protected',
      active_feature: phase.id
    }
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace phase complete ' + phase.id });
  return {
    allowed: true,
    phase_id: phase.id,
    status: 'completed',
    summary_ref: summaryRef,
    next_command: 'terrace ship check'
  };
}

function resumeWorkflow(cwd) {
  const state = loadState(cwd);
  const handoff = state.handoff || {};
  return {
    status: handoff.status || state.workflow.status,
    next_action: handoff.next_action || null,
    phase: handoff.phase || null,
    blocked_actions: state.blocked_actions || [],
    sessions: state.sessions || []
  };
}

function nextWorkflow(cwd) {
  const state = loadState(cwd);
  const blockers = (state.blocked_actions || []).filter((item) => item.blocking);
  const seniorFeature = activeSeniorFeature(state);
  if (seniorFeature) {
    const seniorGate = seniorCycleStatus(cwd, seniorFeature.feature_id, seniorFeature.tier);
    if (seniorGate.blockers.length > 0) {
      return {
        command: seniorGate.next_command,
        blocked: true,
        blockers: [...blockers, ...seniorGate.blockers],
        next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null,
        senior_cycle: seniorGate
      };
    }
  }
  const nextCommand = state.migration && state.migration.next_command
    ? state.migration.next_command
    : inferNextCommand(state);
  return {
    command: nextCommand,
    blocked: blockers.length > 0,
    blockers,
    next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null
  };
}

function inferNextCommand(state) {
  const action = state.handoff && state.handoff.next_action ? state.handoff.next_action : '';
  const phaseMatch = action.match(/phase\s+(\d+(?:\.\d+)?)/i);
  if (phaseMatch && state.roadmap && Array.isArray(state.roadmap.phases)) {
    const phase = state.roadmap.phases.find((candidate) => {
      const titleMatch = String(candidate.title || '').match(/phase\s+(\d+(?:\.\d+)?)/i);
      return titleMatch && Number(titleMatch[1]) === Number(phaseMatch[1]);
    });
    if (phase) {
      return 'terrace phase show ' + phase.id;
    }
  }
  const phase = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases[0] : null;
  return phase ? 'terrace phase show ' + phase.id : 'terrace doctor';
}

function backlogList(cwd) {
  const state = loadState(cwd);
  return {
    items: state.backlog && Array.isArray(state.backlog.items) ? state.backlog.items : []
  };
}

function backlogAdd(cwd, title) {
  if (!title) {
    throw new Error('Usage: terrace backlog add <title>');
  }
  const state = loadState(cwd);
  const backlog = state.backlog && Array.isArray(state.backlog.items) ? state.backlog : { items: [] };
  const item = {
    id: 'backlog-' + String(backlog.items.length + 1),
    title,
    status: 'open',
    source_ref: 'terrace backlog add'
  };
  backlog.items.push(item);
  state.backlog = backlog;
  saveState(cwd, state);
  return { item, items: backlog.items };
}

function quickList(cwd) {
  const state = loadState(cwd);
  return {
    items: quickTasksFromState(state)
  };
}

function quickShow(cwd, itemId) {
  const item = quickList(cwd).items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error('Unknown quick task: ' + itemId);
  }
  return { item };
}

function quickPlan(cwd, title) {
  if (!title) {
    throw new Error('Usage: terrace quick plan <title>');
  }
  const state = loadState(cwd);
  const items = quickTasksFromState(state);
  const itemId = nextQuickId(items);
  const planRef = quickTaskRef(itemId) + '/PLAN.md';
  const item = {
    id: itemId,
    title,
    status: 'planned',
    source_ref: 'terrace quick plan',
    plan_ref: planRef,
    created_at: nowIso(),
    next_command: 'terrace quick execute ' + itemId
  };
  writeMarkdown(cwd, planRef, [
    '# Quick Task: ' + title,
    '',
    '## Intent',
    'Complete a tightly scoped task with Terrace state tracking.',
    '',
    '## Guardrails',
    '- Keep the diff atomic.',
    '- Run the smallest relevant verification before completion.',
    '- No Band-Aid Rule: choose the maintainable path by default, even for quick work.',
    '- Confirm the choice enables future development and expansion before executing.',
    '',
    '## Next Command',
    '- terrace quick execute ' + itemId
  ]);
  const nextState = {
    ...state,
    quick_tasks: [...items, item],
    workflow: {
      ...state.workflow,
      active_feature: itemId
    }
  };
  saveState(cwd, nextState);
  return {
    item,
    next_command: item.next_command
  };
}

function quickExecute(cwd, itemId) {
  const state = loadState(cwd);
  findQuickTask(state, itemId);
  const seniorGate = seniorCycleStatus(cwd, itemId, 'small');
  if (!seniorGate.allowed.execute) {
    return {
      allowed: false,
      item_id: itemId,
      blockers: seniorGate.blockers,
      senior_cycle: seniorGate,
      required_action: 'Complete quick-task test plan before execution.'
    };
  }
  const nextCommand = 'terrace quick complete ' + itemId;
  const nextState = updateQuickTask(state, itemId, {
    status: 'red_required',
    execution_started_at: nowIso(),
    next_command: nextCommand
  });
  nextState.workflow = {
    ...state.workflow,
    status: 'red_required',
    active_feature: itemId
  };
  saveState(cwd, nextState);
  return {
    allowed: true,
    item: findQuickTask(nextState, itemId),
    next_command: nextCommand
  };
}

function quickComplete(cwd, itemId) {
  const state = loadState(cwd);
  const item = findQuickTask(state, itemId);
  const verificationRef = item.verification_ref || quickTaskRef(itemId) + '/VERIFICATION.md';
  if (!artifactExists(cwd, verificationRef)) {
    return {
      allowed: false,
      item_id: itemId,
      blockers: [verificationBlocker(verificationRef)],
      required_action: 'Add quick-task verification evidence before completion.'
    };
  }
  const summaryRef = quickTaskRef(itemId) + '/SUMMARY.md';
  writeMarkdown(cwd, summaryRef, [
    '# Quick Task Summary: ' + item.title,
    '',
    '## Result',
    '- Quick task marked complete through Terrace workflow state.',
    '',
    '## Evidence',
    '- Plan: ' + (item.plan_ref || quickTaskRef(itemId) + '/PLAN.md'),
    '',
    '## Follow-up',
    '- Run terrace ship check when preparing a release.'
  ]);
  const nextState = updateQuickTask(state, itemId, {
    status: 'completed',
    summary_ref: summaryRef,
    completed_at: nowIso(),
    next_command: 'terrace ship check'
  });
  nextState.workflow = {
    ...state.workflow,
    status: 'protected',
    active_feature: itemId
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace quick complete ' + itemId });
  return {
    allowed: true,
    item: findQuickTask(nextState, itemId),
    next_command: 'terrace ship check'
  };
}

function historySummary(cwd) {
  const state = loadState(cwd);
  const quickTasks = Array.isArray(state.quick_tasks) ? state.quick_tasks : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const decisions = Array.isArray(state.decisions) ? state.decisions : [];
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  return {
    quick_tasks: {
      total: quickTasks.length,
      completed: quickTasks.filter((item) => item.status === 'completed').length
    },
    sessions: {
      total: sessions.length
    },
    decisions: {
      total: decisions.length
    },
    phases: {
      total: phases.length,
      with_plans: phases.filter((phase) => Array.isArray(phase.plans) && phase.plans.length > 0).length
    },
    recent_quick_tasks: quickTasks.slice(-5).reverse(),
    recent_sessions: sessions.slice(-5).reverse()
  };
}

function staticCheck(result, category, command) {
  return {
    category,
    command,
    passed: result.blocking.length === 0,
    blocking: result.blocking || [],
    warnings: result.warnings || []
  };
}

function migrationReadinessCheck(cwd) {
  try {
    const state = loadState(cwd);
    const readiness = state.migration && state.migration.readiness ? state.migration.readiness : null;
    const blockers = (state.blocked_actions || []).filter((item) => item.blocking).map((item) => ({
      code: 'MIGRATION_BLOCKED_ACTION',
      message: item.description,
      remediation: 'Resolve or clear the migrated blocked action.'
    }));
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: blockers.length === 0,
      readiness,
      blocking: blockers,
      warnings: []
    };
  } catch (error) {
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: false,
      blocking: [{
        code: 'MIGRATION_READINESS_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        remediation: 'Run terrace init or terrace port gsd before checking migration readiness.'
      }],
      warnings: []
    };
  }
}

function commandCheck(cwd, command, category) {
  try {
    execFileSync(command[0], command.slice(1), { cwd, stdio: 'ignore' });
    return { category, command: command.join(' '), passed: true, blocking: [] };
  } catch (error) {
    return {
      category,
      command: command.join(' '),
      passed: false,
      blocking: [{
        code: 'QUALITY_GATE_FAILED',
        message: command.join(' ') + ' failed.',
        remediation: 'Run the command locally and fix the reported failures.'
      }]
    };
  }
}

function missingScriptCheck(check) {
  return {
    category: check.category,
    command: check.script ? 'npm run ' + check.script : null,
    passed: true,
    skipped: true,
    blocking: [],
    warnings: [{
      code: 'QUALITY_SCRIPT_MISSING',
      message: 'No package script was found for ' + check.category + '.',
      remediation: 'Add a `' + check.script + '` script such as `' + check.suggested + '` if this gate should be enforced.'
    }]
  };
}

function scriptCheck(cwd, discovered, check) {
  if (!check.exists) {
    return missingScriptCheck(check);
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), check.category);
}

function shipCheck(cwd) {
  const discovered = discoverProjectCommands(cwd);
  const categories = [
    staticCheck(runDoctor(cwd), 'doctor', 'terrace doctor'),
    staticCheck(runAudit(cwd), 'audit', 'terrace audit'),
    reportShipCheck(cwd),
    migrationReadinessCheck(cwd),
    seniorCycleShipCheck(cwd),
    preflightShipCheck(cwd),
    aiReviewShipCheck(cwd),
    debtShipCheck(cwd),
    documentationShipCheck(cwd),
    testEvalShipCheck(cwd),
    ruleAuditShipCheck(cwd),
    ...discovered.checks.map((check) => scriptCheck(cwd, discovered, check)),
    commandCheck(cwd, ['git', 'diff', '--quiet'], 'dirty_tree')
  ];
  const blockers = categories.flatMap((category) => category.blocking || []);
  const warnings = categories.flatMap((category) => category.warnings || []);
  return {
    passed: blockers.length === 0,
    project_commands: discovered,
    categories,
    blockers,
    warnings
  };
}

function shipPrepare(cwd) {
  const result = shipCheck(cwd);
  const shipRef = 'docs/terrace/ship/SHIP.md';
  writeMarkdown(cwd, shipRef, [
    '# Release Readiness',
    '',
    '## Status',
    '- Passed: ' + String(result.passed),
    '- Blocking issue count: ' + String(result.blockers.length),
    '- Warning count: ' + String(result.warnings.length),
    '',
    '## Categories',
    ...result.categories.map((category) => '- ' + category.category + ': ' + (category.passed ? 'passed' : 'failed') + ' (`' + category.command + '`)'),
    '',
    '## Blockers',
    ...(result.blockers.length > 0 ? result.blockers.map((blocker) => '- ' + blocker.code + ': ' + blocker.message) : ['- None.']),
    '',
    '## Next Command',
    '- terrace ship check'
  ]);
  return {
    ...result,
    ship_ref: shipRef,
    next_command: 'terrace ship check'
  };
}

function phaseIdFromCommand(command) {
  const match = String(command || '').match(/terrace\s+phase\s+(?:show|plan|execute|validate|review|complete)\s+([^\s]+)/);
  return match ? match[1] : null;
}

function autonomousWorkflow(cwd) {
  const next = nextWorkflow(cwd);
  const state = loadState(cwd);
  const seniorPhase = next.senior_cycle
    ? phasesFromState(state).find((phase) => phase.id === next.senior_cycle.feature_id)
    : null;
  const phaseId = phaseIdFromCommand(next.command) || (seniorPhase ? seniorPhase.id : null);
  if (!phaseId) {
    return {
      status: 'no_phase',
      next,
      next_command: next.command || 'terrace next'
    };
  }
  const planned = phasePlan(cwd, phaseId);
  const execution = phaseExecute(cwd, phaseId);
  const status = execution.allowed ? 'ready_for_agent_execution' : 'blocked';
  return {
    status,
    next,
    planned,
    execution,
    next_command: execution.allowed ? 'terrace phase validate ' + phaseId : planned.next_command
  };
}

function routePlainText(cwd, text) {
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Usage: terrace do <plain text>');
  }
  const lowered = input.toLowerCase();
  const state = loadState(cwd);
  const phase = findPhaseByText(state, input);

  if (/\/gsd:plan-phase\s+/i.test(input) && phase) {
    return { input, command: 'terrace phase plan ' + phase.id, result: phasePlan(cwd, phase.id) };
  }
  if (/\/gsd:execute-phase\s+/i.test(input) && phase) {
    return { input, command: 'terrace phase execute ' + phase.id, result: phaseExecute(cwd, phase.id) };
  }
  if (/\/gsd:quick\b/i.test(input)) {
    const title = input.replace(/^.*?\/gsd:quick\b\s*/i, '').trim();
    if (title) {
      return { input, command: 'terrace quick plan ' + title, result: quickPlan(cwd, title) };
    }
  }
  if (/\/gsd:ship\b/i.test(input)) {
    return { input, command: 'terrace ship prepare', result: shipPrepare(cwd) };
  }
  if (/\b(run|execute|start)\s+the\s+next\s+phase\b/.test(lowered) || /\bautonomous\b/.test(lowered)) {
    return { input, command: 'terrace autonomous', result: autonomousWorkflow(cwd) };
  }
  if (/\b(next|what next|continue)\b/.test(lowered)) {
    return { input, command: 'terrace next', result: nextWorkflow(cwd) };
  }
  if (/\bresume\b/.test(lowered)) {
    return { input, command: 'terrace resume', result: resumeWorkflow(cwd) };
  }
  if (/\bhistory\b/.test(lowered)) {
    return { input, command: 'terrace history', result: historySummary(cwd) };
  }
  if (phase && /\b(plan|planning|\/gsd:plan-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase plan ' + phase.id, result: phasePlan(cwd, phase.id) };
  }
  if (phase && /\b(execute|executing|\/gsd:execute-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase execute ' + phase.id, result: phaseExecute(cwd, phase.id) };
  }
  if (phase && /\b(validate|validation|\/gsd:validate-phase)\b/.test(lowered)) {
    return { input, command: 'terrace phase validate ' + phase.id, result: phaseValidate(cwd, phase.id) };
  }
  if (phase && /\b(review|\/gsd:review)\b/.test(lowered)) {
    return { input, command: 'terrace phase review ' + phase.id, result: phaseReview(cwd, phase.id) };
  }
  if (phase && /\b(complete|finish|done)\b/.test(lowered)) {
    return { input, command: 'terrace phase complete ' + phase.id, result: phaseComplete(cwd, phase.id) };
  }
  if (/\bquick\b/.test(lowered) && /\b(list|show)\b/.test(lowered)) {
    return { input, command: 'terrace quick list', result: quickList(cwd) };
  }
  if (/\bquick\b/.test(lowered)) {
    const title = input
      .replace(/^.*?\bquick(?:\s+task)?\b\s*/i, '')
      .replace(/^(plan|create|add|execute|run|fix)\s+/i, '')
      .trim();
    if (title) {
      return { input, command: 'terrace quick plan ' + title, result: quickPlan(cwd, title) };
    }
  }
  if (/\bship\b/.test(lowered) && /\b(prepare|pr|release)\b/.test(lowered)) {
    return { input, command: 'terrace ship prepare', result: shipPrepare(cwd) };
  }
  if (/\bship\b/.test(lowered)) {
    return { input, command: 'terrace ship check', result: shipCheck(cwd) };
  }
  throw new Error('Unsupported plain-text Terrace command: ' + input);
}

module.exports = {
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  resumeWorkflow,
  nextWorkflow,
  historySummary,
  backlogList,
  backlogAdd,
  quickList,
  quickShow,
  quickPlan,
  quickExecute,
  quickComplete,
  shipPrepare,
  routePlainText,
  autonomousWorkflow,
  discoverProjectCommands,
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
  uiDiff,
  seniorCycleStatus,
  shipCheck
};
