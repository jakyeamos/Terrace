'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { phaseEffortDefault } = require('./config.cjs');
const { runAudit } = require('./audit.cjs');
const { blocker, guidanceError, topBlockers, warning } = require('./guidance.cjs');
const { runDoctor } = require('./health.cjs');
const { analyzeRepository, bulletList, listProjectFiles, readSmallText } = require('./repo-analysis.cjs');
const { securityShipCheck } = require('./security-check.cjs');
const { requireInterrogationAnswers, answerLines } = require('./interrogation.cjs');
const { runCommandFor, setScriptCommand } = require('./package-manager.cjs');
const { discoverProjectCommands } = require('./project-command-discovery.cjs');
const {
  buildPhaseExecutionQueue,
  featureRef,
  normalizeFeatureId,
  normalizeTier,
  seniorArtifactRefs,
  seniorRequirements,
  seniorCycleGateStatus
} = require('./workflow-helpers.cjs');
const { preflightProjectArtifacts, withManagedArtifactLock, writeProjectText } = require('./managed-artifacts.cjs');
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
const { resolveIntentCommand } = require('./intent-catalog.cjs');

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

function writeMarkdown(cwd, relativeFilePath, lines) {
  writeProjectText(cwd, relativeFilePath, lines.join('\n') + '\n');
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
  const queue = buildPhaseExecutionQueue(phase, context, discovered);
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
  const migrationCommand = state.migration && state.migration.next_command;
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
    if (!migrationCommand && seniorFeature.opted_in) {
      const activePhase = phasesFromState(state).find((phase) => phase.id === seniorFeature.feature_id);
      const nextCommand = activePhase
        ? 'terrace phase show ' + activePhase.id
        : 'terrace workbench status --feature ' + seniorFeature.feature_id;
      const activeFeatureHandoff = blocker({
        code: activePhase ? 'ACTIVE_FEATURE_REQUIRES_EXPLICIT_PHASE_ACTION' : 'ACTIVE_FEATURE_NOT_ROADMAP_PHASE',
        feature_id: seniorFeature.feature_id,
        message: activePhase
          ? 'The active senior-cycle feature is a roadmap phase and requires an explicit phase action.'
          : 'The active senior-cycle feature is not a roadmap phase, so automatic phase execution is unavailable.',
        why_blocked: activePhase
          ? 'Automatically replanning the active phase could overwrite its lifecycle state or artifacts.'
          : 'Selecting the first roadmap phase would replace the active feature and could write unrelated planning artifacts.',
        next_command: nextCommand,
        remediation: activePhase
          ? 'Review the active phase, then use an explicit phase command when a mutation is intended.'
          : 'Use the feature workbench or explicitly select a roadmap phase before running autonomous phase execution.'
      });
      return {
        command: nextCommand,
        blocked: true,
        blockers: [...blockers, activeFeatureHandoff],
        next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : null,
        senior_cycle: seniorGate,
        active_feature_handoff: activeFeatureHandoff
      };
    }
  }
  const nextCommand = migrationCommand
    ? migrationCommand
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

function commandCheck(cwd, command, category, options) {
  const opts = options || {};
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
        code: opts.failure_code || 'QUALITY_GATE_FAILED',
        message: opts.failure_message || command.join(' ') + ' failed.',
        why_blocked: opts.why_blocked || 'Release readiness requires the project quality gate to pass.',
        next_command: command.join(' '),
        remediation: opts.remediation || 'Run the command locally and fix the reported failures.'
      })]
    };
  }
}

function dirtyTreeCheck(cwd) {
  const command = 'git status --porcelain=v1 --untracked-files=all';
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (!output.trim()) {
      return { category: 'dirty_tree', command, passed: true, blocking: [] };
    }
    return {
      category: 'dirty_tree',
      command,
      passed: false,
      blocking: [blocker({
        code: 'DIRTY_TREE',
        message: 'Git status reports staged, unstaged, or untracked files.',
        why_blocked: 'Release readiness must be evaluated against a known repository snapshot.',
        next_command: 'git status --short',
        remediation: 'Commit, discard, or intentionally exclude every reported file before rerunning the local or full ship check.'
      })]
    };
  } catch (error) {
    return {
      category: 'dirty_tree',
      command,
      passed: false,
      blocking: [blocker({
        code: 'DIRTY_TREE_CHECK_UNAVAILABLE',
        message: error && error.message ? error.message : 'Git status could not inspect the working tree.',
        why_blocked: 'Terrace cannot verify repository cleanliness without Git status evidence.',
        next_command: 'git status --short',
        remediation: 'Run the ship check from a Git working tree or resolve the Git status error.'
      })]
    };
  }
}

function missingScriptCheck(discovered, check) {
  return {
    category: check.category,
    command: check.script ? runCommandFor(discovered.package_manager, check.script).join(' ') : null,
    passed: true,
    skipped: true,
    blocking: [],
    warnings: [warning({
      code: 'QUALITY_SCRIPT_MISSING',
      message: 'No package script was found for ' + check.category + '.',
      why_blocked: 'Terrace could not enforce this optional quality signal because the script is missing.',
      next_command: setScriptCommand(discovered.package_manager, check.script, check.suggested),
      remediation: 'Add a `' + check.script + '` script such as `' + check.suggested + '` if this gate should be enforced.'
    })]
  };
}

function scriptCheck(cwd, discovered, check) {
  if (!check.exists) {
    return missingScriptCheck(discovered, check);
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), check.category);
}

function deadCodeCheck(cwd, discovered) {
  const check = discovered.dead_code;
  if (!check.enabled) {
    return {
      category: 'dead_code',
      command: null,
      passed: true,
      skipped: true,
      blocking: [],
      warnings: [warning({
        code: 'DEAD_CODE_GATE_SKIPPED',
        message: 'Dead-code readiness gate is intentionally skipped.',
        why_blocked: 'Terrace did not enforce the dead-code signal because this repo disabled it in .terrace/config.json.',
        next_command: 'terrace ship check --full',
        remediation: 'Remove `ship_gates.dead_code.enabled: false` when the repo has a dead-code script to enforce.',
        reason: check.reason
      })]
    };
  }
  if (!check.exists) {
    const item = {
      code: 'DEAD_CODE_SCRIPT_MISSING',
      message: check.configured
        ? 'Configured dead-code package script was not found: ' + check.script + '.'
        : 'No package script was found for the dead-code readiness gate.',
      why_blocked: check.configured
        ? 'Terrace cannot enforce the configured dead-code gate until the package script exists.'
        : 'Terrace could not enforce this optional dead-code signal because the script is missing.',
      next_command: setScriptCommand(discovered.package_manager, check.script, 'knip or project dead-code command'),
      remediation: check.configured
        ? 'Add the configured `' + check.script + '` package script or update `ship_gates.dead_code.scripts` in `.terrace/config.json`.'
        : 'Add a package script such as `dead-code`, `knip`, or configure `ship_gates.dead_code.scripts`; set `ship_gates.dead_code.enabled` to false with a reason to skip intentionally.',
      scripts: check.scripts
    };
    return {
      category: 'dead_code',
      command: null,
      passed: !check.configured,
      skipped: !check.configured,
      blocking: check.configured ? [blocker(item)] : [],
      warnings: check.configured ? [] : [warning(item)]
    };
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), 'dead_code', {
    failure_code: 'DEAD_CODE_GATE_FAILED',
    failure_message: 'Dead-code readiness script failed: ' + check.command + '.',
    why_blocked: 'Release readiness requires the configured dead-code gate to pass.',
    remediation: 'Run the dead-code script locally and remove, justify, or configure the reported unused code.'
  });
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

const SHIP_CHECK_MODES = ['fast', 'local', 'full'];

function invalidShipModeResult(mode) {
  const invalidMode = typeof mode === 'string' && mode.trim() ? mode : String(mode);
  const invalid = blocker({
    code: 'SHIP_CHECK_MODE_INVALID',
    message: 'Unsupported ship-check mode: ' + invalidMode + '.',
    why_blocked: 'Terrace only accepts fast, local, or full ship-check modes and must not silently choose an execution-capable fallback.',
    next_command: 'terrace ship check --fast',
    remediation: 'Use `--fast` for the read-only default, `--local` to include the Git dirty-tree check, or `--full` only when you intend to execute project scripts.'
  });
  return {
    mode: invalidMode,
    passed: false,
    project_commands: null,
    categories: [],
    timings: [],
    blockers: [invalid],
    warnings: [],
    top_blockers: [invalid],
    next_command: invalid.next_command,
    recheck_command: 'terrace ship check --fast'
  };
}

function shipCheck(cwd, options) {
  const opts = options || {};
  if (opts.mode !== undefined && !SHIP_CHECK_MODES.includes(opts.mode)) {
    return invalidShipModeResult(opts.mode);
  }
  const mode = opts.mode || 'fast';
  const discovered = discoverProjectCommands(cwd);
  const dirtyTree = mode === 'local' || mode === 'full' ? dirtyTreeCheck(cwd) : null;
  const factories = [
    ...(dirtyTree ? [() => dirtyTree] : []),
    () => staticCheck(runDoctor(cwd), 'doctor', 'terrace doctor'),
    () => staticCheck(runAudit(cwd), 'audit', 'terrace audit'),
    () => securityShipCheck(cwd),
    () => reportShipCheck(cwd),
    () => migrationReadinessCheck(cwd),
    () => seniorCycleShipCheck(cwd),
    ...(opts.includeTrustedPublishing !== false && terracePackageReleaseTarget(cwd) ? [() => trustedPublishingShipCheck(cwd)] : []),
    () => preflightShipCheck(cwd),
    () => aiReviewShipCheck(cwd),
    () => debtShipCheck(cwd),
    () => waiverShipCheck(cwd),
    () => documentationShipCheck(cwd),
    () => testEvalShipCheck(cwd),
    () => ruleAuditShipCheck(cwd)
  ];
  if (mode === 'full' && (!dirtyTree || dirtyTree.passed)) {
    for (const check of discovered.checks) {
      factories.push(() => scriptCheck(cwd, discovered, check));
    }
    factories.push(() => deadCodeCheck(cwd, discovered));
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

function packageVersion(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  return typeof packageJson.version === 'string' ? packageJson.version : null;
}

function releaseArtifactFiles(cwd) {
  return listProjectFiles(cwd, { limit: 10000 }).filter((file) => {
    const normalized = file.replace(/\\/g, '/');
    return normalized === 'README.md' ||
      normalized === 'CHANGELOG.md' ||
      normalized === 'docs/RELEASE.md' ||
      normalized === 'package.json' ||
      normalized === 'scripts/package-dry-run.cjs' ||
      /^\.github\/workflows\/[^/]+\.ya?ml$/.test(normalized);
  });
}

const STALE_NPM_RELEASE_PATTERNS = [
  { code: 'NPM_TOKEN_REFERENCE', pattern: /\bNPM_TOKEN\b/ },
  { code: 'NODE_AUTH_TOKEN_REFERENCE', pattern: /\bNODE_AUTH_TOKEN\b/ },
  { code: 'NPM_LOGIN_INSTRUCTION', pattern: /\bnpm\s+(?:login|adduser|whoami)\b/i },
  { code: 'NPM_PUBLISH_INSTRUCTION', pattern: /\b(?:run|execute|use|call)\s+`?npm\s+publish\b/i },
  { code: 'NPM_AUTH_TOKEN_CONFIG', pattern: /\/\/registry\.npmjs\.org\/:_authToken/i },
  { code: 'PNPM_WHOAMI_INSTRUCTION', pattern: /\bpnpm\s+whoami\b/i }
];

function staleReleaseArtifactFindings(cwd) {
  const findings = [];
  for (const file of releaseArtifactFiles(cwd)) {
    const text = readSmallText(cwd, file, 250000);
    if (!text) {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const item of STALE_NPM_RELEASE_PATTERNS) {
        if (item.pattern.test(line)) {
          findings.push({
            code: item.code,
            file,
            line: index + 1,
            evidence: line.trim().slice(0, 180)
          });
        }
      }
    });
  }
  return findings;
}

function currentReleaseTags(cwd) {
  try {
    const output = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function gitCommitRef(cwd, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', ref], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

function releaseVersionTagCheck(cwd, targetVersion) {
  const version = packageVersion(cwd);
  const expectedTag = targetVersion ? 'v' + targetVersion : version ? 'v' + version : null;
  const currentTags = currentReleaseTags(cwd);
  const semverTagsAtHead = currentTags.filter((tag) => /^v\d+\.\d+\.\d+(?:[-+].+)?$/.test(tag));
  const headCommit = gitCommitRef(cwd, 'HEAD');
  const expectedTagTarget = expectedTag ? gitCommitRef(cwd, 'refs/tags/' + expectedTag) : null;
  const mismatches = [];
  const warnings = [];
  if (!version) {
    mismatches.push({
      code: 'PACKAGE_VERSION_MISSING',
      message: 'package.json does not declare a release version.'
    });
  }
  if (targetVersion && version && version !== targetVersion) {
    mismatches.push({
      code: 'TARGET_VERSION_MISMATCH',
      message: 'Requested release version ' + targetVersion + ' does not match package.json version ' + version + '.',
      package_version: version,
      target_version: targetVersion
    });
  }
  if (expectedTag && semverTagsAtHead.length > 0 && !semverTagsAtHead.includes(expectedTag)) {
    mismatches.push({
      code: 'HEAD_TAG_VERSION_MISMATCH',
      message: 'HEAD is tagged for ' + semverTagsAtHead.join(', ') + ' instead of ' + expectedTag + '.',
      expected_tag: expectedTag,
      tags_at_head: semverTagsAtHead
    });
  }
  if (expectedTag && expectedTagTarget && headCommit && expectedTagTarget !== headCommit) {
    mismatches.push({
      code: 'RELEASE_TAG_NOT_AT_HEAD',
      message: 'Expected release tag exists but does not point at HEAD: ' + expectedTag + '.',
      expected_tag: expectedTag,
      tag_target: expectedTagTarget,
      head: headCommit
    });
  }
  if (expectedTag && !expectedTagTarget) {
    warnings.push(warning({
      code: 'RELEASE_TAG_NOT_FOUND',
      message: 'Expected release tag does not exist yet: ' + expectedTag + '.',
      why_blocked: 'The release can be preflighted before tagging, but publish should happen from the reviewed version tag.',
      next_command: 'git tag ' + expectedTag,
      remediation: 'Create the reviewed release tag after version and changelog review.'
    }));
  }
  return {
    package_version: version,
    target_version: targetVersion || version,
    expected_tag: expectedTag,
    tags_at_head: currentTags,
    tag_exists: Boolean(expectedTagTarget),
    tag_target: expectedTagTarget,
    passed: mismatches.length === 0,
    mismatches,
    warnings,
    blocking: mismatches.map((item) => blocker({
      code: item.code,
      message: item.message,
      why_blocked: 'Release publishing requires package version and git tag intent to agree.',
      next_command: 'terrace release-preflight --target-version ' + (targetVersion || version || '<version>') + ' --json',
      remediation: 'Align package.json, the reviewed target version, and any release tag at HEAD before publishing.',
      expected_tag: item.expected_tag,
      tags_at_head: item.tags_at_head,
      tag_target: item.tag_target,
      head: item.head
    }))
  };
}

function containsAll(text, values) {
  return values.every((value) => text.includes(value));
}

function trustedPublishingCheck(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  const workflow = readSmallText(cwd, '.github/workflows/release-publish.yml', 250000) || '';
  const releaseDocs = readSmallText(cwd, 'docs/RELEASE.md', 250000) || '';
  const packageName = typeof packageJson.name === 'string' ? packageJson.name : null;
  const version = typeof packageJson.version === 'string' ? packageJson.version : null;
  const releaseTarget = packageName && version ? packageName + '@' + version : packageName || null;
  const manualPrerequisites = [
    'npm package trusted publishing is configured for @jakyeamos33/terrace and the GitHub repository before publishing v0.2.0.',
    'GitHub environment `npm` has the intended reviewer protection before publish jobs can run.',
    'The GitHub Release is created for the reviewed v0.2.0 tag.'
  ];
  const requirements = [
    {
      code: 'PUBLISH_CONFIG_PUBLIC',
      passed: packageJson.publishConfig && packageJson.publishConfig.access === 'public',
      evidence: 'package.json#publishConfig.access'
    },
    {
      code: 'PUBLISH_CONFIG_PROVENANCE',
      passed: packageJson.publishConfig && packageJson.publishConfig.provenance === true,
      evidence: 'package.json#publishConfig.provenance'
    },
    {
      code: 'RELEASE_WORKFLOW_PRESENT',
      passed: Boolean(workflow),
      evidence: '.github/workflows/release-publish.yml'
    },
    {
      code: 'OIDC_PERMISSION',
      passed: /id-token:\s*write/.test(workflow),
      evidence: 'release-publish.yml permissions'
    },
    {
      code: 'NPM_ENVIRONMENT',
      passed: /environment:\s*npm/.test(workflow),
      evidence: 'release-publish.yml environment'
    },
    {
      code: 'PROVENANCE_PUBLISH_COMMAND',
      passed: workflow.includes('pnpm publish --access public --provenance --no-git-checks --config.node-linker=hoisted'),
      evidence: 'release-publish.yml publish step'
    },
    {
      code: 'TOKENLESS_PUBLISH',
      passed: !/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/.test(workflow),
      evidence: 'release-publish.yml token scan'
    },
    {
      code: 'TRUSTED_PUBLISHING_DOCS',
      passed: /npm trusted publishing/i.test(releaseDocs) && /OIDC/i.test(releaseDocs),
      evidence: 'docs/RELEASE.md'
    }
  ];
  const missing = requirements.filter((item) => !item.passed);
  return {
    package_name: packageName,
    package_version: version,
    release_target: releaseTarget,
    passed: missing.length === 0,
    requirements,
    manual_prerequisites: manualPrerequisites,
    blocking: missing.map((item) => blocker({
      code: item.code,
      message: 'Trusted-publishing prerequisite is missing: ' + item.code + '.',
      why_blocked: 'Terrace releases must publish through GitHub OIDC trusted publishing without local npm auth tokens.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Update package metadata, release workflow, or release docs so trusted publishing is explicit and tokenless.',
      evidence: item.evidence
    })),
    warnings: [warning({
      code: 'TRUSTED_PUBLISHING_MANUAL_REVIEW',
      message: 'npm trusted-publishing package settings and GitHub environment reviewers cannot be verified from repo files.',
      why_blocked: 'Local preflight can verify repo-owned prerequisites only.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Confirm npm trusted publishing and GitHub environment reviewer settings in their admin UIs before publishing.',
      manual_prerequisites: manualPrerequisites
    })]
  };
}

function terracePackageReleaseTarget(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  return packageJson.name === '@jakyeamos33/terrace' && packageJson.version === '0.2.0';
}

function trustedPublishingShipCheck(cwd) {
  const result = trustedPublishingCheck(cwd);
  return {
    category: 'trusted_publishing',
    command: 'terrace release-preflight --json',
    passed: result.passed,
    package_name: result.package_name,
    package_version: result.package_version,
    release_target: result.release_target,
    requirements: result.requirements,
    manual_confirmation_required: result.manual_prerequisites.length > 0,
    manual_prerequisites: result.manual_prerequisites,
    blocking: result.blocking,
    warnings: result.warnings
  };
}

function releaseFlowChecks(cwd) {
  const packageJson = readJsonFile(path.resolve(cwd, 'package.json')) || {};
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const ciWorkflow = readSmallText(cwd, '.github/workflows/ci.yml', 250000) || '';
  const dryRunWorkflow = readSmallText(cwd, '.github/workflows/release-dry-run.yml', 250000) || '';
  const publishWorkflow = readSmallText(cwd, '.github/workflows/release-publish.yml', 250000) || '';
  const releaseDocs = readSmallText(cwd, 'docs/RELEASE.md', 250000) || '';
  return [
    {
      name: 'ci',
      command: 'pnpm run ci',
      present: typeof scripts.ci === 'string' && containsAll(ciWorkflow + dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm run ci'])
    },
    {
      name: 'dependency_audit',
      command: 'pnpm audit --audit-level moderate',
      present: containsAll(ciWorkflow + dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm audit --audit-level moderate'])
    },
    {
      name: 'package',
      command: 'pnpm package',
      present: typeof scripts.package === 'string' && typeof scripts['package:dry-run'] === 'string' && releaseDocs.includes('pnpm package')
    },
    {
      name: 'release_dry_run',
      command: 'pnpm run release:dry-run',
      present: typeof scripts['release:dry-run'] === 'string' && containsAll(dryRunWorkflow + publishWorkflow + releaseDocs, ['pnpm run release:dry-run'])
    },
    {
      name: 'ship_check',
      command: 'terrace ship check --json',
      present: releaseDocs.includes('ship check --json')
    }
  ];
}

function releaseFlowCommandResult(cwd, item, runCommands) {
  if (!item.present) {
    return {
      ...item,
      ran: false,
      passed: false,
      blocking: [blocker({
        code: 'RELEASE_FLOW_STEP_MISSING',
        message: 'Release flow step is not documented or configured: ' + item.name + '.',
        why_blocked: 'Terrace 0.2.0 release preflight requires CI, audit, package, release dry-run, and ship-check flow coverage.',
        next_command: 'terrace release-preflight --json',
        remediation: 'Restore the package script, workflow step, or release checklist entry for `' + item.command + '`.'
      })]
    };
  }
  if (!runCommands) {
    return { ...item, ran: false, passed: true, blocking: [] };
  }
  if (item.name === 'ship_check') {
    return { ...item, ran: 'in_process', passed: true, blocking: [] };
  }
  const parts = item.command.split(/\s+/);
  try {
    execFileSync(parts[0], parts.slice(1), { cwd, stdio: 'ignore' });
    return { ...item, ran: true, passed: true, blocking: [] };
  } catch (error) {
    return {
      ...item,
      ran: true,
      passed: false,
      blocking: [blocker({
        code: 'RELEASE_FLOW_STEP_FAILED',
        message: item.command + ' failed.',
        why_blocked: 'Terrace cannot mark the release preflight ready while a release flow command fails.',
        next_command: item.command,
        remediation: 'Run the failing command locally and fix the reported issue before publishing.'
      })]
    };
  }
}

function staleReleaseArtifactsCheck(cwd) {
  const findings = staleReleaseArtifactFindings(cwd);
  return {
    passed: findings.length === 0,
    findings,
    blocking: findings.map((finding) => blocker({
      code: 'STALE_NPM_RELEASE_INSTRUCTION',
      message: finding.file + ':' + finding.line + ' still references old npm-era release instructions.',
      why_blocked: 'Release artifacts must describe trusted publishing and pnpm-based release flow, not token-era npm publishing.',
      next_command: 'terrace release-preflight --json',
      remediation: 'Replace npm-token, npm-login, or direct npm-publish instructions with the trusted-publishing flow.',
      finding
    }))
  };
}

function releasePreflight(cwd, options) {
  const opts = options || {};
  const targetVersion = typeof opts.targetVersion === 'string' && opts.targetVersion.trim() ? opts.targetVersion.trim() : packageVersion(cwd);
  const runCommands = opts.runCommands !== false;
  const shipMode = opts.shipMode !== undefined ? opts.shipMode : (runCommands ? 'full' : 'fast');
  const modeBlocker = !SHIP_CHECK_MODES.includes(shipMode)
    ? blocker({
      code: 'RELEASE_PREFLIGHT_MODE_INVALID',
      message: 'Unsupported release-preflight ship-check mode: ' + String(shipMode) + '.',
      why_blocked: 'Terrace must validate the requested ship-check mode before any release-flow command can execute.',
      next_command: 'terrace release-preflight --static --json',
      remediation: 'Use `--fast`, `--local`, or `--full`; omit the mode to use the release-preflight default.'
    })
    : !runCommands && shipMode === 'full'
      ? blocker({
        code: 'RELEASE_STATIC_MODE_INVALID',
        message: 'release-preflight --static cannot run ship-check full mode.',
        why_blocked: 'The static release-preflight contract is read-only and must not execute project package scripts.',
        next_command: 'terrace release-preflight --static --fast --json',
        remediation: 'Use `--static` with the default fast mode or `--local`; omit `--static` when you intentionally authorize the full release flow.'
      })
      : null;
  const executionDirtyTree = !modeBlocker && runCommands ? dirtyTreeCheck(cwd) : null;
  const flow = modeBlocker
    ? []
    : executionDirtyTree && !executionDirtyTree.passed
      ? releaseFlowChecks(cwd).map((item) => ({
        ...item,
        ran: false,
        skipped: true,
        passed: false,
        blocking: []
      }))
      : releaseFlowChecks(cwd).map((item) => releaseFlowCommandResult(cwd, item, runCommands));
  const ship = modeBlocker
    ? {
      mode: shipMode,
      passed: false,
      blockers: [modeBlocker],
      warnings: [],
      categories: []
    }
    : shipCheck(cwd, {
      mode: shipMode,
      includeTrustedPublishing: false
    });
  const trustedPublishing = trustedPublishingCheck(cwd);
  const tagVersion = releaseVersionTagCheck(cwd, targetVersion);
  const staleArtifacts = staleReleaseArtifactsCheck(cwd);
  const flowBlockers = flow.flatMap((item) => item.blocking || []);
  const executionBlockers = executionDirtyTree && !executionDirtyTree.passed && shipMode === 'fast'
    ? executionDirtyTree.blocking
    : [];
  const blockers = [
    ...flowBlockers,
    ...executionBlockers,
    ...ship.blockers,
    ...trustedPublishing.blocking,
    ...tagVersion.blocking,
    ...staleArtifacts.blocking
  ];
  const warnings = [
    ...ship.warnings,
    ...trustedPublishing.warnings,
    ...tagVersion.warnings
  ];
  return {
    command: 'terrace release-preflight',
    release: targetVersion,
    passed: blockers.length === 0,
    flow,
    ship_check: {
      mode: ship.mode,
      passed: ship.passed,
      blocker_count: ship.blockers.length,
      warning_count: ship.warnings.length,
      categories: ship.categories.map((category) => ({
        category: category.category,
        passed: category.passed,
        skipped: Boolean(category.skipped),
        command: category.command || null
      }))
    },
    trusted_publishing: trustedPublishing,
    tag_version: tagVersion,
    stale_release_artifacts: staleArtifacts,
    blockers,
    warnings,
    top_blockers: topBlockers(blockers, 5),
    next_command: blockers.length > 0 ? (blockers[0].next_command || 'terrace release-preflight --json') : 'git tag ' + tagVersion.expected_tag,
    recheck_command: 'terrace release-preflight --json'
  };
}

function shipPrepare(cwd, options) {
  const opts = options || {};
  const mode = opts.mode === undefined ? 'full' : opts.mode;
  const result = shipCheck(cwd, { mode });
  if (!SHIP_CHECK_MODES.includes(mode)) {
    return {
      ...result,
      ship_ref: null,
      next_command: 'terrace ship check --fast',
      recheck_command: 'terrace ship check --fast'
    };
  }
  const shipRef = 'docs/terrace/ship/SHIP.md';
  writeMarkdown(cwd, shipRef, [
    '# Release Readiness',
    '',
    '## Status',
    '- Mode: ' + result.mode,
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
    '- terrace ship check --' + result.mode
  ]);
  return {
    ...result,
    ship_ref: shipRef,
    next_command: 'terrace ship check --' + result.mode,
    recheck_command: 'terrace ship check --fast'
  };
}

function phaseIdFromCommand(command) {
  const match = String(command || '').match(/terrace\s+phase\s+(?:show|plan|execute|validate|review|complete)\s+([^\s]+)/);
  return match ? match[1] : null;
}

function autonomousWorkflow(cwd) {
  const next = nextWorkflow(cwd);
  if (next.active_feature_handoff) {
    return {
      status: 'blocked',
      next,
      blockers: next.blockers,
      active_feature_handoff: next.active_feature_handoff,
      required_action: next.active_feature_handoff.remediation,
      next_command: next.command
    };
  }
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

function encodePlainTextIntentPlan(plan) {
  return Buffer.from(JSON.stringify({
    version: 1,
    input: plan.input,
    intent_id: plan.intent_id,
    parameters: plan.parameters,
    state_revision: plan.state_revision
  }), 'utf8').toString('base64url');
}

function decodePlainTextIntentPlan(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,16384}$/.test(token)) {
    throw guidanceError('Terrace needs a plan token returned by `terrace do <intent>` before it can apply a natural-language write.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and pass its returned plan token to `terrace do --apply <plan-token>`.'
    });
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw guidanceError('Terrace could not read the natural-language plan token.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and use the returned plan token unchanged.'
    });
  }
  if (!payload || payload.version !== 1 || typeof payload.input !== 'string' || typeof payload.intent_id !== 'string'
    || !payload.parameters || typeof payload.parameters !== 'object' || Array.isArray(payload.parameters)
    || !Number.isInteger(payload.state_revision) || payload.state_revision < 0) {
    throw guidanceError('Terrace received an invalid natural-language plan token.', {
      code: 'INTENT_PLAN_TOKEN_INVALID',
      next_command: 'terrace do <intent>',
      remediation: 'Preview the intended natural-language route again and use the returned plan token unchanged.'
    });
  }
  const intent = resolveIntentCommand(payload.intent_id, payload.parameters);
  if (intent.effect !== 'write') {
    throw guidanceError('Only write-capable natural-language plans can be applied.', {
      code: 'INTENT_PLAN_NOT_WRITABLE',
      next_command: 'terrace do <intent>',
      remediation: 'Run the read-only command directly, or preview a write-capable route before applying it.'
    });
  }
  return payload;
}

function buildPlainTextIntentPlan(input, intentId, parameters, stateRevision) {
  const params = { ...(parameters || {}) };
  const intent = resolveIntentCommand(intentId, params);
  const plan = {
    input,
    intent_id: intent.id,
    command_id: intent.command_id,
    argv: intent.argv,
    command: intent.command,
    effect: intent.effect,
    parameters: params,
    state_revision: stateRevision,
    writes: intent.writes,
    execution: intent.execution,
    lock: intent.lock
  };
  if (intent.effect === 'write') {
    const token = encodePlainTextIntentPlan(plan);
    return {
      ...plan,
      mode: 'plan',
      requires_apply: true,
      apply: {
        plan_token: token,
        argv: ['do', '--apply', token],
        command: 'terrace do --apply ' + token
      }
    };
  }
  return {
    ...plan,
    mode: 'read',
    read_only: true
  };
}

function planPlainTextIntent(cwd, text) {
  const input = String(text || '').trim();
  if (!input) {
    throw new Error('Usage: terrace do <intent>');
  }
  const lowered = input.toLowerCase();
  const state = loadState(cwd);
  const phase = findPhaseByText(state, input);
  const plannedIntent = (intentId, parameters) => buildPlainTextIntentPlan(input, intentId, parameters, state.state_revision);

  if (/\b(gsd\s+replacement|replace\s+gsd|replacing\s+gsd|workflow\s+parity|adoption\s+status|terrace\s+ready|is\s+terrace\s+ready)\b/.test(lowered)) {
    return plannedIntent('adoption_status');
  }
  if (/\b(production\s+workbench|ship-ready|ship\s+ready|handoff\s+this\s+feature|make\s+this\s+feature\s+ship-ready)\b/.test(lowered)) {
    const featureId = state.senior_cycle && state.senior_cycle.active_feature
      ? state.senior_cycle.active_feature
      : state.workflow && state.workflow.active_feature
        ? state.workflow.active_feature
        : null;
    const wantsPrepare = /\b(prepare|make|handoff)\b/.test(lowered);
    if (wantsPrepare && featureId) {
      const target = /\bhandoff\b/.test(lowered) ? 'generic' : null;
      return plannedIntent('workbench_prepare', {
        feature_id: featureId,
        target
      });
    }
    return plannedIntent('workbench_status', {
      feature_id: featureId
    });
  }
  if (/\/(?:terrace:)?execute-phase-complete\s+/i.test(input) && phase) {
    return plannedIntent('phase_complete_workflow', { phase_id: phase.id });
  }
  if (/\/(?:terrace:)?goal\b/i.test(input)) {
    const goal = input.replace(/^.*?\/(?:terrace:)?goal\b\s*/i, '').trim();
    if (goal) {
      const nestedPlan = planPlainTextIntent(cwd, goal);
      return nestedPlan.effect === 'write'
        ? buildPlainTextIntentPlan(input, nestedPlan.intent_id, nestedPlan.parameters, nestedPlan.state_revision)
        : { ...nestedPlan, input };
    }
  }
  if (/\/gsd:plan-phase\s+/i.test(input) && phase) {
    return plannedIntent('phase_plan', { phase_id: phase.id });
  }
  if (/\/gsd:execute-phase\s+/i.test(input) && phase) {
    return plannedIntent('phase_execute', { phase_id: phase.id });
  }
  if (/\/gsd:quick\b/i.test(input)) {
    const title = input.replace(/^.*?\/gsd:quick\b\s*/i, '').trim();
    if (title) {
      return plannedIntent('quick_plan', { title });
    }
  }
  if (/\/gsd:ship\b/i.test(input)) {
    return plannedIntent('ship_prepare');
  }
  if (/\b(run|execute|start)\s+the\s+next\s+phase\b/.test(lowered) || /\bautonomous\b/.test(lowered)) {
    return plannedIntent('autonomous');
  }
  if (phase && /\b(end[-\s]?to[-\s]?end|complete\s+workflow|full\s+phase|execute\s+phase\s+complete|phase\s+complete\s+workflow)\b/.test(lowered)) {
    return plannedIntent('phase_complete_workflow', { phase_id: phase.id });
  }
  if (/\b(next|what next|continue)\b/.test(lowered)) {
    return plannedIntent('next');
  }
  if (/\bresume\b/.test(lowered)) {
    return plannedIntent('resume');
  }
  if (/\bhistory\b/.test(lowered)) {
    return plannedIntent('history');
  }
  if (phase && /\b(plan|planning|\/gsd:plan-phase)\b/.test(lowered)) {
    return plannedIntent('phase_plan', { phase_id: phase.id });
  }
  if (phase && /\b(execute|executing|\/gsd:execute-phase)\b/.test(lowered)) {
    return plannedIntent('phase_execute', { phase_id: phase.id });
  }
  if (phase && /\b(validate|validation|\/gsd:validate-phase)\b/.test(lowered)) {
    return plannedIntent('phase_validate', { phase_id: phase.id });
  }
  if (phase && /\b(review|\/gsd:review)\b/.test(lowered)) {
    return plannedIntent('phase_review', { phase_id: phase.id });
  }
  if (phase && /\b(complete|finish|done)\b/.test(lowered)) {
    return plannedIntent('phase_complete', { phase_id: phase.id });
  }
  if (/\bquick\b/.test(lowered) && /\b(list|show)\b/.test(lowered)) {
    return plannedIntent('quick_list');
  }
  if (/\bquick\b/.test(lowered)) {
    const title = input
      .replace(/^.*?\bquick(?:\s+task)?\b\s*/i, '')
      .replace(/^(plan|create|add|execute|run|fix)\s+/i, '')
      .trim();
    if (title) {
      return plannedIntent('quick_plan', { title });
    }
  }
  if (/\bship\b/.test(lowered) && /\b(prepare|pr|release)\b/.test(lowered)) {
    return plannedIntent('ship_prepare');
  }
  if (/\bship\b/.test(lowered)) {
    return plannedIntent('ship_check');
  }
  throw new Error('Unsupported plain-text Terrace command: ' + input);
}

function executePlainTextIntent(cwd, plan) {
  const parameters = plan.parameters || {};
  switch (plan.intent_id) {
    case 'adoption_status': {
      const { adoptionStatus } = require('./adoption.cjs');
      return adoptionStatus(cwd);
    }
    case 'workbench_status': {
      const { workbenchStatus } = require('./workbench.cjs');
      return workbenchStatus(cwd, { feature: parameters.feature_id });
    }
    case 'workbench_prepare': {
      const { workbenchPrepare } = require('./workbench.cjs');
      return workbenchPrepare(cwd, { feature: parameters.feature_id, for: parameters.target });
    }
    case 'phase_complete_workflow':
      return phaseCompleteWorkflow(cwd, parameters.phase_id);
    case 'phase_plan':
      return phasePlan(cwd, parameters.phase_id);
    case 'phase_execute':
      return phaseExecute(cwd, parameters.phase_id);
    case 'phase_validate':
      return phaseValidate(cwd, parameters.phase_id);
    case 'phase_review':
      return phaseReview(cwd, parameters.phase_id);
    case 'phase_complete':
      return phaseComplete(cwd, parameters.phase_id);
    case 'quick_plan':
      return quickPlan(cwd, parameters.title);
    case 'quick_list':
      return quickList(cwd);
    case 'ship_prepare':
      return shipPrepare(cwd);
    case 'ship_check':
      return shipCheck(cwd);
    case 'autonomous':
      return autonomousWorkflow(cwd);
    case 'next':
      return nextWorkflow(cwd);
    case 'resume':
      return resumeWorkflow(cwd);
    case 'history':
      return historySummary(cwd);
    default:
      throw new Error('Unsupported plain-text Terrace intent: ' + plan.intent_id);
  }
}

function applyPlainTextIntentPlan(cwd, token) {
  const payload = decodePlainTextIntentPlan(token);
  const intent = resolveIntentCommand(payload.intent_id, payload.parameters);
  const apply = () => {
    const state = loadState(cwd);
    if (state.state_revision !== payload.state_revision) {
      throw guidanceError('The natural-language plan is stale because Terrace state changed after it was previewed.', {
        code: 'INTENT_PLAN_STALE',
        next_command: 'terrace do <intent>',
        remediation: 'Preview the route again, review its updated write scope, and apply the new plan token.'
      });
    }
    const plan = buildPlainTextIntentPlan(payload.input, payload.intent_id, payload.parameters, state.state_revision);
    const result = executePlainTextIntent(cwd, plan);
    const { apply, ...appliedPlan } = plan;
    return {
      ...appliedPlan,
      mode: 'applied',
      requires_apply: false,
      applied: true,
      result
    };
  };
  return intent.lock === 'managed' ? withManagedArtifactLock(cwd, apply) : apply();
}

function routePlainText(cwd, text) {
  const plan = planPlainTextIntent(cwd, text);
  if (plan.effect === 'write') {
    return plan;
  }
  const result = executePlainTextIntent(cwd, plan);
  return { ...plan, result };
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
  planPlainTextIntent,
  applyPlainTextIntentPlan,
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
  shipCheck,
  releasePreflight
};
