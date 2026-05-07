'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { phaseEffortDefault } = require('./config.cjs');
const { runAudit } = require('./audit.cjs');
const { agentAssetStatus } = require('./agents.cjs');
const { blocker, topBlockers, warning } = require('./guidance.cjs');
const { runDoctor } = require('./health.cjs');
const { analyzeRepository, bulletList } = require('./repo-analysis.cjs');
const { securityShipCheck } = require('./security-check.cjs');
const { requireInterrogationAnswers, answerLines } = require('./interrogation.cjs');
const {
  reportUpdate,
  reportShipCheck,
  preflightShipCheck,
  debtShipCheck,
  documentationShipCheck,
  testEvalShipCheck,
  aiReviewShipCheck,
  ruleAuditShipCheck,
  waiverShipCheck
} = require('./lifecycle.cjs');

function nowIso() {
  return new Date().toISOString();
}

function safeResolve(cwd, relativeFilePath) {
  const root = path.resolve(cwd);
  const resolved = path.resolve(cwd, relativeFilePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('UNSAFE_PATH: generated artifact path is outside the project root');
  }
  return resolved;
}

function ensureDirFor(cwd, relativeFilePath) {
  fs.mkdirSync(path.dirname(safeResolve(cwd, relativeFilePath)), { recursive: true });
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  ensureDirFor(cwd, relativeFilePath);
  fs.writeFileSync(safeResolve(cwd, relativeFilePath), lines.join('\n') + '\n', 'utf8');
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

function effortGuidance(effort) {
  if (effort === 'fast') {
    return [
      '- Use the narrowest plan that can satisfy stated acceptance criteria.',
      '- Prefer existing tests and targeted verification before broader exploratory work.'
    ];
  }
  if (effort === 'thorough') {
    return [
      '- Expand source review to adjacent files, historical plans, and failure modes before implementation.',
      '- Include adversarial review, security implications, regression risk, and release evidence before completion.'
    ];
  }
  return [
    '- Cover migrated context, likely files, required gates, and focused regression risk.',
    '- Escalate to thorough handling only when the phase changes shared contracts or release-critical behavior.'
  ];
}

function planLinesForPhase(phase, blockers, context, discovered, effort) {
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
    '## Effort',
    '- Default: ' + effort,
    ...effortGuidance(effort),
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

function executionLinesForPhase(phase, queue, discovered, effort) {
  return [
    '# Execution Queue: ' + phase.title,
    '',
    '## Mode',
    '- Terrace prepares an execution queue and gate evidence; product-code edits remain explicit agent work.',
    '',
    '## Effort',
    '- Default: ' + effort,
    ...effortGuidance(effort),
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
  const match = text.match(/(?:phase|plan-phase|execute-phase|validate-phase|review-phase|complete-phase|execute-phase-complete|phase-complete-workflow)\s+([a-z0-9_.-]+)/i);
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
  const agentAssets = agentAssetStatus(cwd);
  return {
    package_manager: packageManager,
    scripts,
    checks,
    agent_assets: agentAssets,
    warnings: agentAssets.partial ? [warning({
      code: 'PARTIAL_AGENT_ASSETS',
      message: 'Generated Terrace agent assets are partially installed.',
      why_blocked: 'Codex or Claude may only discover a subset of Terrace commands until missing generated assets are installed.',
      next_command: 'terrace init',
      remediation: 'Run `terrace init`; it installs missing generated agent assets without overwriting user-owned files.'
    })] : []
  };
}

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
  return blocker({
    code: 'VERIFICATION_REQUIRED',
    artifact,
    message: 'No completion without verification evidence.',
    why_blocked: 'Completion requires evidence that the planned behavior was verified.',
    next_command: 'terrace quick complete <quick-task-id>',
    remediation: 'Write verification evidence before completing this quick task.'
  });
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
  const effort = phaseEffortDefault(cwd);
  const planRef = phaseRef(phase) + '/PLAN.md';
  writeMarkdown(cwd, planRef, planLinesForPhase(phase, blockers, context, discovered, effort));
  const plannedAt = nowIso();
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'planned',
      plan_ref: planRef,
      planned_at: plannedAt,
      effort,
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
    effort,
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
  const effort = phaseEffortDefault(cwd);
  const queue = executionQueueForPhase(phase, context, discovered);
  if (blockers.length > 0) {
    return {
      allowed: false,
      phase_id: phase.id,
      effort,
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
      effort,
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
  writeMarkdown(cwd, executionRef, executionLinesForPhase(phase, queue, discovered, effort));
  const nextState = {
    ...updatePhase(state, phase.id, {
      status: 'executing',
      execution_started_at: startedAt,
      execution_ref: executionRef,
      effort,
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
    effort,
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
    const blockers = (state.blocked_actions || []).filter((item) => item.blocking).map((item) => blocker({
      code: 'MIGRATION_BLOCKED_ACTION',
      message: item.description,
      why_blocked: 'Migrated GSD state recorded a human action as blocking release readiness.',
      next_command: 'terrace next',
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
      blocking: [blocker({
        code: 'MIGRATION_READINESS_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        why_blocked: 'Terrace cannot inspect migration readiness until the repo has Terrace state.',
        next_command: 'terrace init',
        remediation: 'Run terrace init or terrace port gsd before checking migration readiness.'
      })],
      warnings: []
    };
  }
}

function commandCheck(cwd, command, category) {
  try {
    if (process.platform === 'win32' && command[0] === 'npm') {
      execFileSync(command.join(' '), { cwd, stdio: 'ignore', shell: true });
    } else {
      execFileSync(command[0], command.slice(1), { cwd, stdio: 'ignore' });
    }
    return { category, command: command.join(' '), passed: true, blocking: [] };
  } catch (error) {
    return {
      category,
      command: command.join(' '),
      passed: false,
      blocking: [blocker({
        code: 'QUALITY_GATE_FAILED',
        message: command.join(' ') + ' failed.',
        why_blocked: 'Release readiness requires the project quality gate to pass.',
        next_command: command.join(' '),
        remediation: 'Run the command locally and fix the reported failures.'
      })]
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
    warnings: [warning({
      code: 'QUALITY_SCRIPT_MISSING',
      message: 'No package script was found for ' + check.category + '.',
      why_blocked: 'Terrace could not enforce this optional quality signal because the script is missing.',
      next_command: 'npm pkg set scripts.' + check.script + '="' + check.suggested + '"',
      remediation: 'Add a `' + check.script + '` script such as `' + check.suggested + '` if this gate should be enforced.'
    })]
  };
}

function scriptCheck(cwd, discovered, check) {
  if (!check.exists) {
    return missingScriptCheck(check);
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), check.category);
}

function timedCategory(factory) {
  const started = Date.now();
  const category = factory();
  const elapsed = Date.now() - started;
  return {
    category: {
      ...category,
      elapsed_ms: elapsed
    },
    timing: {
      category: category.category,
      elapsed_ms: elapsed
    }
  };
}

function shipCheck(cwd, options) {
  const opts = options || {};
  const mode = ['fast', 'local', 'full'].includes(opts.mode) ? opts.mode : 'full';
  const discovered = discoverProjectCommands(cwd);
  const factories = [
    () => staticCheck(runDoctor(cwd), 'doctor', 'terrace doctor'),
    () => staticCheck(runAudit(cwd), 'audit', 'terrace audit'),
    () => securityShipCheck(cwd),
    () => reportShipCheck(cwd),
    () => migrationReadinessCheck(cwd),
    () => seniorCycleShipCheck(cwd),
    () => preflightShipCheck(cwd),
    () => aiReviewShipCheck(cwd),
    () => debtShipCheck(cwd),
    () => waiverShipCheck(cwd),
    () => documentationShipCheck(cwd),
    () => testEvalShipCheck(cwd),
    () => ruleAuditShipCheck(cwd)
  ];
  if (mode === 'full') {
    for (const check of discovered.checks) {
      factories.push(() => scriptCheck(cwd, discovered, check));
    }
  }
  if (mode === 'local' || mode === 'full') {
    factories.push(() => commandCheck(cwd, ['git', 'diff', '--quiet'], 'dirty_tree'));
  }
  const timed = factories.map((factory) => timedCategory(factory));
  const categories = timed.map((item) => item.category);
  const timings = timed.map((item) => item.timing);
  const blockers = categories.flatMap((category) => category.blocking || []);
  const warnings = categories.flatMap((category) => category.warnings || []);
  return {
    mode,
    passed: blockers.length === 0,
    project_commands: discovered,
    categories,
    timings,
    blockers,
    warnings,
    top_blockers: topBlockers(blockers, 3),
    next_command: blockers.length > 0 ? (blockers[0].next_command || 'terrace ship check --fast') : 'terrace ship prepare',
    recheck_command: 'terrace ship check --fast'
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
    ...(result.blockers.length > 0 ? result.blockers.map((item) => '- ' + item.code + ': ' + item.message + (item.next_command ? ' Next: `' + item.next_command + '`.' : '')) : ['- None.']),
    '',
    '## Next Command',
    '- terrace ship check'
  ]);
  return {
    ...result,
    ship_ref: shipRef,
    next_command: 'terrace ship check',
    recheck_command: 'terrace ship check --fast'
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

function phaseCompleteWorkflow(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = findPhase(state, phaseId);
  const steps = [];
  const planned = phasePlan(cwd, phase.id);
  steps.push({ command: 'terrace phase plan ' + phase.id, result: planned });
  const execution = phaseExecute(cwd, phase.id);
  steps.push({ command: 'terrace phase execute ' + phase.id, result: execution });
  if (!execution.allowed) {
    return {
      status: 'blocked',
      phase_id: phase.id,
      effort: planned.effort,
      steps,
      blockers: execution.blockers || planned.blockers || [],
      required_action: execution.required_action || 'Resolve blockers before continuing phase completion.',
      next_command: 'terrace phase execute ' + phase.id
    };
  }
  const validated = phaseValidate(cwd, phase.id);
  steps.push({ command: 'terrace phase validate ' + phase.id, result: validated });
  const reviewed = phaseReview(cwd, phase.id);
  steps.push({ command: 'terrace phase review ' + phase.id, result: reviewed });
  const completed = phaseComplete(cwd, phase.id);
  steps.push({ command: 'terrace phase complete ' + phase.id, result: completed });
  if (!completed.allowed) {
    return {
      status: 'blocked',
      phase_id: phase.id,
      effort: planned.effort,
      steps,
      blockers: completed.blockers || [],
      required_action: completed.required_action,
      next_command: 'terrace phase complete ' + phase.id
    };
  }
  return {
    status: 'completed',
    phase_id: phase.id,
    effort: planned.effort,
    steps,
    next_command: completed.next_command
  };
}

function routePlainText(cwd, text) {
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Usage: terrace do <intent>');
  }
  const lowered = input.toLowerCase();
  const state = loadState(cwd);
  const phase = findPhaseByText(state, input);

  if (/\/(?:terrace:)?execute-phase-complete\s+/i.test(input) && phase) {
    return { input, command: 'terrace execute-phase-complete ' + phase.id, result: phaseCompleteWorkflow(cwd, phase.id) };
  }
  if (/\/(?:terrace:)?goal\b/i.test(input)) {
    const goal = input.replace(/^.*?\/(?:terrace:)?goal\b\s*/i, '').trim();
    if (goal) {
      return routePlainText(cwd, goal);
    }
  }
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
  if (phase && /\b(end[-\s]?to[-\s]?end|complete\s+workflow|full\s+phase|execute\s+phase\s+complete|phase\s+complete\s+workflow)\b/.test(lowered)) {
    return { input, command: 'terrace execute-phase-complete ' + phase.id, result: phaseCompleteWorkflow(cwd, phase.id) };
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
  phaseCompleteWorkflow,
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
