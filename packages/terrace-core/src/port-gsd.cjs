'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultState, loadState, replaceState, saveState } = require('./state.cjs');
const { installAgentBootstrap } = require('./agents.cjs');

const COMMAND_STRATEGIES = {
  improved: ['gsd-new-project', 'gsd-discuss-phase', 'gsd-plan-phase', 'gsd-execute-phase', 'gsd-quick'],
  replaced: ['gsd-validate-phase', 'gsd-verify-work', 'gsd-ship'],
  'as-is': ['gsd-note', 'gsd-add-todo', 'gsd-check-todos', 'gsd-health', 'gsd-stats', 'gsd-forensics', 'gsd-map-codebase']
};

const SUPPORTED_ARTIFACTS = {
  '.planning/PROJECT.md': 'docs/prd/PRD.md',
  '.planning/REQUIREMENTS.md': 'docs/spec/COMPILED-SPEC.md',
  '.planning/STATE.md': 'docs/terrace-migration/GSD-STATE.md',
  '.planning/ROADMAP.md': 'docs/terrace-migration/GSD-ROADMAP.md',
  '.planning/HANDOFF.json': 'docs/terrace-migration/GSD-HANDOFF.json',
  '.planning/config.json': 'docs/terrace-migration/GSD-config.json',
  '.planning/MILESTONES.md': 'docs/terrace-migration/GSD-MILESTONES.md',
  '.planning/RETROSPECTIVE.md': 'docs/terrace-migration/GSD-RETROSPECTIVE.md'
};

function classifyGsdCommand(command) {
  for (const [strategy, commands] of Object.entries(COMMAND_STRATEGIES)) {
    if (commands.includes(command)) {
      return { command, strategy };
    }
  }

  return { command, strategy: 'unknown' };
}

function collectArtifact(cwd, artifact, artifacts) {
  if (fs.existsSync(path.resolve(cwd, artifact))) {
    artifacts.push(artifact);
  }
}

function listPlanningFiles(cwd) {
  const planningDir = path.resolve(cwd, '.planning');
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath.split(path.sep).join('/'));
      }
    }
  }

  if (fs.existsSync(planningDir)) {
    walk(planningDir);
  }

  return files
    .map((filePath) => path.relative(cwd, filePath).split(path.sep).join('/'))
    .sort();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'phase';
}

function isRoadmapPhaseTitle(value) {
  return /^Phase\s+\d+(?:\.\d+)?(?:\b|[\s:.-])/i.test(String(value).trim());
}

function extractRoadmapPhases(cwd) {
  const phases = [];
  const seen = new Set();

  function addPhase(phase) {
    const id = slugify(phase.id || phase.title);
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    phases.push({
      id,
      title: phase.title || id,
      status: phase.status || 'migrated',
      source_ref: phase.source_ref,
      plans: []
    });
  }

  const roadmapPath = path.resolve(cwd, '.planning', 'ROADMAP.md');
  if (fs.existsSync(roadmapPath)) {
    const content = fs.readFileSync(roadmapPath, 'utf8');
    const lines = content.split(/\r?\n/);
    let current = null;

    for (const line of lines) {
      const heading = line.match(/^#{2,}\s+(.+?)\s*$/);
      if (heading) {
        current = {
          title: heading[1],
          id: null,
          source_ref: '.planning/ROADMAP.md',
          added: false
        };
        if (isRoadmapPhaseTitle(current.title)) {
          addPhase(current);
          current.added = true;
        }
        continue;
      }

      const id = line.match(/^\s*-\s*ID:\s*(.+?)\s*$/i);
      if (id && current) {
        if (!current.added) {
          addPhase({
            id: id[1],
            title: current.title,
            source_ref: current.source_ref
          });
          current.added = true;
        } else {
          const previousId = slugify(current.id || current.title);
          const phase = phases.find((candidate) => candidate.id === previousId);
          if (phase) {
            seen.delete(phase.id);
            phase.id = slugify(id[1]);
            seen.add(phase.id);
          }
        }
        current.id = id[1];
        continue;
      }

      const inlinePhase = line.match(/^\s*[-*]\s+(Phase\s+\d+(?:\.\d+)?(?::\s*.+?)?)\s*$/i);
      if (inlinePhase) {
        addPhase({
          title: inlinePhase[1],
          source_ref: '.planning/ROADMAP.md'
        });
      }
    }
  }

  if (phases.length > 0) {
    return phases;
  }

  const handoff = readJsonIfExists(path.resolve(cwd, '.planning', 'HANDOFF.json'));
  if (handoff && !handoff.parse_error) {
    const handoffPhase = handoff.phase || handoff.phase_name || handoff.current_phase || handoff.active_phase || handoff.next_phase;
    if (handoffPhase) {
      addPhase({
        title: String(handoffPhase),
        source_ref: '.planning/HANDOFF.json'
      });
    }
    if (Array.isArray(handoff.phases)) {
      for (const phase of handoff.phases) {
        if (phase && typeof phase === 'object') {
          addPhase({
            id: phase.id,
            title: phase.title || phase.name || phase.id,
            status: phase.status || 'migrated',
            source_ref: '.planning/HANDOFF.json'
          });
        }
      }
    }
  }

  if (phases.length > 0) {
    return phases;
  }

  const phaseDirs = [...new Set(listPlanningFiles(cwd)
    .map((artifact) => artifact.match(/^\.planning\/phases\/([^/]+)\//))
    .filter(Boolean)
    .map((match) => match[1]))];
  for (const phaseDir of phaseDirs) {
    addPhase({
      id: phaseDir,
      title: phaseDir,
      source_ref: '.planning/phases/' + phaseDir
    });
  }

  if (phases.length > 0) {
    return phases;
  }

  const legacyPlanFiles = listPlanningFiles(cwd).filter((artifact) => /(?:^|\/)(?:PLAN|.*-PLAN)\.md$/i.test(artifact));
  if (legacyPlanFiles.length > 0) {
    addPhase({
      id: 'migrated-gsd-legacy-plan',
      title: 'Migrated GSD Legacy Plan',
      source_ref: legacyPlanFiles[0]
    });
  }

  return phases;
}

function firstHeading(content, fallback) {
  const heading = content.split(/\r?\n/).map((line) => line.match(/^#\s+(.+?)\s*$/)).find(Boolean);
  return heading ? heading[1] : fallback;
}

function phaseNumberFromTitle(title) {
  const match = String(title).match(/phase\s+(\d+(?:\.\d+)?)/i);
  return match ? match[1] : null;
}

function phaseNumberFromDir(dirName) {
  const match = String(dirName).match(/^(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  return String(Number(match[1])) === 'NaN' ? match[1] : String(Number(match[1]));
}

function ensurePhaseForDir(state, phaseDir) {
  const dirNumber = phaseNumberFromDir(phaseDir);
  let phase = state.roadmap.phases.find((candidate) => {
    const titleNumber = phaseNumberFromTitle(candidate.title);
    return titleNumber && dirNumber && Number(titleNumber) === Number(dirNumber);
  });
  if (!phase) {
    phase = {
      id: slugify(phaseDir),
      title: phaseDir,
      status: 'migrated',
      source_ref: '.planning/phases/' + phaseDir,
      plans: []
    };
    state.roadmap.phases.push(phase);
  }
  if (!Array.isArray(phase.plans)) {
    phase.plans = [];
  }
  return phase;
}

function planIdFromFile(fileName) {
  const match = fileName.match(/^(\d+(?:\.\d+)?-\d+)-PLAN\.md$/);
  return match ? match[1] : null;
}

function quickTaskIdFromFile(fileName) {
  const match = fileName.match(/^(\d{6}-[a-z0-9]+)-(?:PLAN|SUMMARY)\.md$/i);
  return match ? match[1] : null;
}

function quickTaskIdFromDir(dirName) {
  const match = dirName.match(/^(\d{6}-[a-z0-9]+)/i);
  return match ? match[1] : slugify(dirName);
}

function extractFrontmatterValue(content, key) {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      return null;
    }
    const match = lines[i].match(new RegExp('^' + key + ':\\s*(.+?)\\s*$'));
    if (match) {
      return match[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function extractIndentedListUnderKey(content, key) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let active = false;
  for (const line of lines) {
    if (line.match(new RegExp('^' + key + ':\\s*$'))) {
      active = true;
      continue;
    }
    if (!active) {
      continue;
    }
    if (/^[a-zA-Z0-9_-]+:/.test(line)) {
      break;
    }
    const item = line.match(/^\s+-\s+(.+?)\s*$/);
    if (item) {
      items.push(item[1]);
    }
  }
  return items;
}

function extractCommits(content) {
  return [...new Set((content.match(/\b[0-9a-f]{7,12}\b/gi) || []).map((commit) => commit.toLowerCase()))];
}

function extractBulletsUnderHeading(content, headingPattern) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let active = false;

  for (const line of lines) {
    if (/^#{2,}\s+/.test(line)) {
      active = headingPattern.test(line);
      continue;
    }
    if (!active) {
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (bullet) {
      items.push(bullet[1]);
    }
  }

  return items;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      parse_error: error && error.message ? error.message : String(error)
    };
  }
}

function extractDecisionsFromState(cwd) {
  const statePath = path.resolve(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    return [];
  }
  return extractBulletsUnderHeading(fs.readFileSync(statePath, 'utf8'), /decisions/i);
}

function extractBacklogFromState(cwd) {
  const statePath = path.resolve(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    return [];
  }
  return extractBulletsUnderHeading(fs.readFileSync(statePath, 'utf8'), /parking lot|backlog|todos/i);
}

function extractHandoff(cwd) {
  const handoff = readJsonIfExists(path.resolve(cwd, '.planning', 'HANDOFF.json'));
  if (!handoff || handoff.parse_error) {
    return { blocked_actions: [] };
  }
  const pendingActions = [];
  if (handoff.human_action_pending) {
    pendingActions.push(handoff.human_action_pending);
  }
  if (Array.isArray(handoff.human_actions_pending)) {
    pendingActions.push(...handoff.human_actions_pending);
  }
  return {
    blocked_actions: pendingActions.map((pending) => ({
      description: pending.description || pending.action || String(pending),
      blocking: Boolean(pending.blocking)
    }))
  };
}

function skippedArtifact(artifact, reason, target) {
  const item = {
    artifact,
    reason,
    suggested_action: 'Review manually and move any still-relevant content into Terrace state or docs.'
  };
  if (target) {
    item.target = target;
  }
  return item;
}

function buildPrd(projectContent) {
  return [
    '---',
    'source: .planning/PROJECT.md',
    'migration: gsd',
    '---',
    '',
    '# PRD',
    '',
    'problem: Migrated from legacy GSD project context.',
    'actors: Original project maintainers and AI agents.',
    'desired_outcomes: Preserve project intent while moving workflow state to Terrace.',
    'non_goals: This generated PRD does not replace human review.',
    'constraints: Source `.planning/PROJECT.md` remains the migration authority until reviewed.',
    'success_criteria: Terrace doctor and audit pass after migration.',
    'open_questions: Review all migrated assumptions before implementation work continues.',
    '',
    '## Migrated GSD Project',
    '',
    projectContent.trim(),
    ''
  ].join('\n');
}

function buildCompiledSpec(requirementsContent) {
  return [
    '---',
    'spec_version: "1.0"',
    'project: "Migrated GSD Project"',
    'phase: "migration-review"',
    'requirements: []',
    'protected: []',
    'last_updated: "' + new Date().toISOString() + '"',
    'source_refs:',
    '  - .planning/REQUIREMENTS.md',
    '---',
    '',
    '# Compiled Spec',
    '',
    '## Migrated Requirements',
    '',
    requirementsContent.trim(),
    ''
  ].join('\n');
}

function buildStateArchive(stateContent) {
  return [
    '# Migrated GSD State',
    '',
    'Source: `.planning/STATE.md`',
    '',
    'This file preserves legacy GSD state for manual review after `terrace port gsd`.',
    '',
    '```md',
    stateContent.trim(),
    '```',
    ''
  ].join('\n');
}

function buildMarkdownArchive(source, content) {
  return [
    '# Migrated GSD Artifact',
    '',
    'Source: `' + source + '`',
    '',
    content.trim(),
    ''
  ].join('\n');
}

function writeIfAllowed(cwd, relTarget, content, force, writes, skipped, artifact) {
  const targetPath = path.resolve(cwd, relTarget);
  if (fs.existsSync(targetPath) && !force) {
    skipped.push(skippedArtifact(artifact, 'target_exists', relTarget));
    return false;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  writes.push(relTarget);
  return true;
}

function portGsdDryRun(cwd) {
  const artifacts = listPlanningFiles(cwd);
  for (const artifact of Object.keys(SUPPORTED_ARTIFACTS)) {
    collectArtifact(cwd, artifact, artifacts);
  }

  return {
    mode: 'dry-run',
    artifacts: [...new Set(artifacts)].sort(),
    command_strategies: COMMAND_STRATEGIES,
    converted: [],
    skipped: [],
    writes: [],
    blockers: [],
    warnings: [],
    readiness: { status: 'review_required', score: 0 },
    next_command: null,
    review_checklist: [],
    validation_commands: ['terrace doctor', 'terrace audit']
  };
}

function planningConcepts(cwd) {
  const files = listPlanningFiles(cwd);
  return {
    files,
    phases: extractRoadmapPhases(cwd),
    phase_artifacts: files.filter((file) => /^\.planning\/phases\//.test(file)),
    quick_tasks: files.filter((file) => /^\.planning\/quick\/[^/]+\/.+(?:PLAN|SUMMARY)\.md$/.test(file)),
    decisions: extractDecisionsFromState(cwd),
    backlog: extractBacklogFromState(cwd),
    sessions: fs.existsSync(path.resolve(cwd, '.planning', 'HANDOFF.json')) ? ['.planning/HANDOFF.json'] : [],
    blockers: extractHandoff(cwd).blocked_actions || []
  };
}

function isConvertiblePlanningArtifact(artifact) {
  if (Object.prototype.hasOwnProperty.call(SUPPORTED_ARTIFACTS, artifact)) {
    return true;
  }
  if (/^\.planning\/phases\/[^/]+\/[^/]+$/.test(artifact)) {
    const fileName = artifact.split('/').pop();
    return /(?:^|-)UAT\.md$|(?:^|-)HUMAN-UAT\.md$|(?:^|-)VALIDATION\.md$|(?:^|-)VERIFICATION\.md$|(?:^|-)REVIEWS\.md$|(?:^|-)UI-REVIEW\.md$|-PLAN\.md$|-SUMMARY\.md$|(?:^|-)CONTEXT\.md$|(?:^|-)DISCUSSION-LOG\.md$|(?:^|-)RESEARCH\.md$|(?:^|-)UI-SPEC\.md$/i.test(fileName);
  }
  if (artifact === '.planning/quick/.continue-here.md') {
    return true;
  }
  if (/^\.planning\/quick\/[^/]+\/[^/]+-(?:PLAN|SUMMARY)\.md$/i.test(artifact)) {
    return true;
  }
  return artifact.startsWith('.planning/debug/') || artifact.startsWith('.planning/milestones/');
}

function portGsdCompare(cwd) {
  const dryRun = portGsdDryRun(cwd);
  const concepts = planningConcepts(cwd);
  const convertibleCandidates = dryRun.artifacts.filter((artifact) => isConvertiblePlanningArtifact(artifact));
  const skippedCandidates = dryRun.artifacts.filter((artifact) => !isConvertiblePlanningArtifact(artifact));
  const hasMappedStateDetails = concepts.files.includes('.planning/STATE.md')
    && Object.prototype.hasOwnProperty.call(SUPPORTED_ARTIFACTS, '.planning/STATE.md')
    && fs.readFileSync(path.resolve(cwd, '.planning', 'STATE.md'), 'utf8').trim().length > 0;
  const mapped = {
    state_details: hasMappedStateDetails ? 1 : 0,
    phases: concepts.phases.length,
    phase_artifacts: concepts.phase_artifacts.length,
    quick_tasks: concepts.quick_tasks.length,
    decisions: concepts.decisions.length,
    backlog: concepts.backlog.length,
    sessions: concepts.sessions.length,
    blockers: concepts.blockers.length
  };
  const missing = [];
  if (concepts.files.includes('.planning/ROADMAP.md') && mapped.phases === 0) {
    missing.push({ concept: 'phases', source: '.planning/ROADMAP.md' });
  }
  if (concepts.files.includes('.planning/STATE.md') && mapped.state_details === 0) {
    missing.push({ concept: 'state_details', source: '.planning/STATE.md' });
  }
  const missingSummary = missing.map((item) => item.concept + ' from ' + item.source).join(', ');
  return {
    mode: 'compare',
    source_files: concepts.files.length,
    converted_candidates: convertibleCandidates.length,
    skipped_candidates: skippedCandidates.length,
    concepts: mapped,
    converted: convertibleCandidates,
    skipped: skippedCandidates,
    missing,
    passed: missing.length === 0,
    next_command: missing.length === 0 ? 'terrace port gsd --dry-run' : 'Review missing migration concepts before porting: ' + missingSummary + '.'
  };
}

function portGsdVerifyParity(cwd) {
  const comparison = portGsdCompare(cwd);
  return {
    mode: 'verify-parity',
    passed: comparison.passed,
    blocking: comparison.missing.map((item) => ({
      code: 'GSD_CONCEPT_UNMAPPED',
      message: item.concept + ' from ' + item.source + ' was not mapped.'
    })),
    comparison
  };
}

function migrateSimpleArtifact(cwd, artifact, target, force, writes, skipped, converted, type) {
  const sourcePath = path.resolve(cwd, artifact);
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  const content = fs.readFileSync(sourcePath, 'utf8');
  if (writeIfAllowed(cwd, target, buildMarkdownArchive(artifact, content), force, writes, skipped, artifact)) {
    converted.push({ artifact, target, type });
  }
}

function migrateRawArtifact(cwd, artifact, target, force, writes, skipped, converted, type) {
  const sourcePath = path.resolve(cwd, artifact);
  if (!fs.existsSync(sourcePath)) {
    return;
  }
  if (writeIfAllowed(cwd, target, fs.readFileSync(sourcePath, 'utf8'), force, writes, skipped, artifact)) {
    converted.push({ artifact, target, type });
  }
}

function migratePhaseArtifact(cwd, artifact, force, writes, skipped, converted, state) {
  const match = artifact.match(/^\.planning\/phases\/([^/]+)\/([^/]+)$/);
  if (!match) {
    return false;
  }
  const phaseDir = match[1];
  const fileName = match[2];
  if (fileName === '.gitkeep') {
    skipped.push(skippedArtifact(artifact, 'unsupported_artifact'));
    return true;
  }
  const sourcePath = path.resolve(cwd, artifact);
  const content = fs.readFileSync(sourcePath, 'utf8');
  const isTestingArtifact = /(?:^|-)UAT\.md$|(?:^|-)HUMAN-UAT\.md$|(?:^|-)VALIDATION\.md$|(?:^|-)VERIFICATION\.md$|(?:^|-)REVIEWS\.md$|(?:^|-)UI-REVIEW\.md$/i.test(fileName);
  const isArchiveArtifact = /-PLAN\.md$|-SUMMARY\.md$|(?:^|-)CONTEXT\.md$|(?:^|-)DISCUSSION-LOG\.md$|(?:^|-)RESEARCH\.md$|(?:^|-)UI-SPEC\.md$/i.test(fileName);
  const target = isTestingArtifact
    ? 'docs/testing/gsd/' + phaseDir + '/' + fileName
    : 'docs/terrace-migration/phases/' + phaseDir + '/' + fileName;

  if (!isTestingArtifact && !isArchiveArtifact) {
    skipped.push(skippedArtifact(artifact, 'unsupported_artifact'));
    return true;
  }

  if (writeIfAllowed(cwd, target, content, force, writes, skipped, artifact)) {
    converted.push({
      artifact,
      target,
      type: isTestingArtifact ? 'testing_artifact' : 'phase_artifact'
    });
  }

  const planId = planIdFromFile(fileName);
  if (planId) {
    const phase = ensurePhaseForDir(state, phaseDir);
    if (!phase.plans.some((plan) => plan.source_ref === artifact)) {
      phase.plans.push({
        id: planId,
        title: firstHeading(content, planId),
        status: 'migrated',
        source_ref: artifact
      });
    }
  }
  return true;
}

function ensureQuickTask(state, task) {
  if (!Array.isArray(state.quick_tasks)) {
    state.quick_tasks = [];
  }
  const existing = state.quick_tasks.find((item) => item.id === task.id);
  if (!existing) {
    state.quick_tasks.push(task);
    return task;
  }
  Object.assign(existing, {
    ...task,
    title: task.title || existing.title,
    status: task.status || existing.status,
    plan_ref: task.plan_ref || existing.plan_ref,
    summary_ref: task.summary_ref || existing.summary_ref,
    subsystem: task.subsystem || existing.subsystem,
    files_modified: [...new Set([...(existing.files_modified || []), ...(task.files_modified || [])])],
    commits: [...new Set([...(existing.commits || []), ...(task.commits || [])])]
  });
  return existing;
}

function migrateQuickArtifact(cwd, artifact, force, writes, skipped, converted, state) {
  const match = artifact.match(/^\.planning\/quick\/([^/]+)\/([^/]+)$/);
  if (!match) {
    if (artifact === '.planning/quick/.continue-here.md') {
      migrateRawArtifact(cwd, artifact, 'docs/terrace-migration/quick/.continue-here.md', force, writes, skipped, converted, 'quick_handoff');
      return true;
    }
    return false;
  }
  const quickDir = match[1];
  const fileName = match[2];
  const sourcePath = path.resolve(cwd, artifact);
  const content = fs.readFileSync(sourcePath, 'utf8');
  const isQuickArtifact = /-(?:PLAN|SUMMARY)\.md$/i.test(fileName);
  if (!isQuickArtifact) {
    skipped.push(skippedArtifact(artifact, 'unsupported_artifact'));
    return true;
  }

  const target = 'docs/terrace-migration/quick/' + quickDir + '/' + fileName;
  if (writeIfAllowed(cwd, target, content, force, writes, skipped, artifact)) {
    converted.push({ artifact, target, type: 'quick_task_artifact' });
  }

  const id = quickTaskIdFromFile(fileName) || quickTaskIdFromDir(quickDir);
  const isPlan = /-PLAN\.md$/i.test(fileName);
  const isSummary = /-SUMMARY\.md$/i.test(fileName);
  const task = ensureQuickTask(state, {
    id,
    title: firstHeading(content, quickDir),
    status: isSummary ? 'completed' : 'planned',
    source_dir: '.planning/quick/' + quickDir,
    plan_ref: isPlan ? artifact : null,
    summary_ref: isSummary ? artifact : null,
    subsystem: extractFrontmatterValue(content, 'subsystem'),
    files_modified: extractIndentedListUnderKey(content, 'files_modified').concat(extractIndentedListUnderKey(content, 'modified')),
    commits: extractCommits(content)
  });
  state.sessions.push({
    source: 'gsd_quick',
    task_id: task.id,
    status: task.status,
    source_ref: artifact
  });
  return true;
}

function applyStateContent(state, cwd) {
  const legacyStatePath = path.resolve(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(legacyStatePath)) {
    return;
  }
  const content = fs.readFileSync(legacyStatePath, 'utf8');
  for (const decision of extractBulletsUnderHeading(content, /decisions/i)) {
    state.decisions.push({
      text: decision,
      source_ref: '.planning/STATE.md'
    });
  }
  for (const item of extractBulletsUnderHeading(content, /parking lot|backlog|todos/i)) {
    state.backlog.items.push({
      id: slugify(item),
      title: item,
      status: 'open',
      source_ref: '.planning/STATE.md'
    });
  }
  state.migration.quick_tasks = extractBulletsUnderHeading(content, /quick tasks/i).map((task) => ({
    title: task,
    source_ref: '.planning/STATE.md'
  }));
}

function addBacklogItem(state, item) {
  if (!state.backlog || !Array.isArray(state.backlog.items)) {
    state.backlog = { items: [] };
  }
  if (!state.backlog.items.some((existing) => existing.id === item.id && existing.source_ref === item.source_ref)) {
    state.backlog.items.push(item);
  }
}

function applyHandoff(state, cwd) {
  const handoff = readJsonIfExists(path.resolve(cwd, '.planning', 'HANDOFF.json'));
  if (!handoff) {
    return [];
  }
  state.handoff = {
    status: handoff.status || null,
    phase: handoff.phase || handoff.phase_name || null,
    next_action: handoff.next_action || null,
    source_ref: '.planning/HANDOFF.json'
  };
  const handoffPhase = handoff.phase || handoff.phase_name;
  if (handoffPhase && !state.roadmap.phases.some((phase) => phase.id === slugify(handoffPhase))) {
    state.roadmap.phases.push({
      id: slugify(handoffPhase),
      title: handoffPhase,
      status: 'migrated',
      source_ref: '.planning/HANDOFF.json',
      plans: []
    });
  }
  state.sessions.push({
    source: 'gsd_handoff',
    status: handoff.status || 'unknown',
    phase: handoffPhase || null,
    next_action: handoff.next_action || null,
    source_ref: '.planning/HANDOFF.json'
  });
  if (Array.isArray(handoff.decisions)) {
    for (const decision of handoff.decisions) {
      state.decisions.push({
        text: typeof decision === 'string' ? decision : String(decision.decision || JSON.stringify(decision)),
        source_ref: '.planning/HANDOFF.json'
      });
    }
  }
  if (Array.isArray(handoff.remaining_tasks)) {
    for (const remaining of handoff.remaining_tasks) {
      const title = typeof remaining === 'string' ? remaining : String(remaining.name || remaining.title || remaining.id || 'Remaining GSD task');
      addBacklogItem(state, {
        id: typeof remaining === 'object' && remaining.id ? String(remaining.id) : slugify(title),
        title,
        status: typeof remaining === 'object' && remaining.status ? String(remaining.status) : 'open',
        source_ref: '.planning/HANDOFF.json'
      });
    }
  }
  const blockers = [];
  const pendingActions = [];
  if (handoff.human_action_pending) {
    pendingActions.push(handoff.human_action_pending);
  }
  if (Array.isArray(handoff.human_actions_pending)) {
    pendingActions.push(...handoff.human_actions_pending);
  }
  for (const pending of pendingActions) {
    const blockedAction = {
      description: pending.description || pending.action || String(pending),
      context: pending.context || null,
      blocking: Boolean(pending.blocking),
      source_ref: '.planning/HANDOFF.json'
    };
    state.blocked_actions.push(blockedAction);
    addBacklogItem(state, {
      id: slugify(blockedAction.description),
      title: blockedAction.description,
      status: blockedAction.blocking ? 'blocked' : 'open',
      source_ref: '.planning/HANDOFF.json'
    });
    if (blockedAction.blocking) {
      blockers.push({
        code: 'GSD_HANDOFF_BLOCKED_ACTION',
        message: blockedAction.description,
        remediation: 'Complete or clear the migrated human action before treating the project as ready.'
      });
    }
  }
  return blockers;
}

function nextCommandForState(state) {
  const action = state.handoff && state.handoff.next_action ? state.handoff.next_action : '';
  const phaseMatch = action.match(/phase\s+(\d+(?:\.\d+)?)/i);
  if (phaseMatch) {
    const phase = state.roadmap.phases.find((candidate) => {
      const titleNumber = phaseNumberFromTitle(candidate.title);
      return titleNumber && Number(titleNumber) === Number(phaseMatch[1]);
    });
    if (phase) {
      return 'terrace phase show ' + phase.id;
    }
  }
  const nextPhase = state.roadmap.phases.find((phase) => phase.status !== 'complete' && phase.status !== 'completed') || state.roadmap.phases[0];
  return nextPhase ? 'terrace phase show ' + nextPhase.id : 'terrace doctor';
}

function portGsdImportRoadmap(cwd) {
  const state = loadState(cwd);
  const existingPhases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const existingIds = new Set(existingPhases.map((phase) => phase.id));
  const candidates = extractRoadmapPhases(cwd);
  const imported = [];
  const unchanged = [];

  for (const phase of candidates) {
    if (existingIds.has(phase.id)) {
      unchanged.push({
        id: phase.id,
        title: phase.title,
        reason: 'already_exists'
      });
      continue;
    }
    existingIds.add(phase.id);
    existingPhases.push(phase);
    imported.push(phase);
  }

  state.roadmap = {
    ...(state.roadmap || {}),
    phases: existingPhases
  };

  if (imported.length > 0) {
    saveState(cwd, state);
  }

  const nextPhase = imported[0] || existingPhases.find((phase) => phase && phase.id);
  return {
    mode: 'roadmap-import',
    source: '.planning',
    candidates: candidates.length,
    imported,
    unchanged,
    writes: imported.length > 0 ? ['.terrace/state.json'] : [],
    next_command: nextPhase ? 'terrace phase show ' + nextPhase.id : 'terrace port gsd --dry-run',
    validation_commands: ['terrace phase list', 'terrace adoption status']
  };
}

function portGsd(cwd, options) {
  const opts = options || {};
  const artifacts = portGsdDryRun(cwd).artifacts;
  const statePath = path.resolve(cwd, '.terrace', 'state.json');
  const writes = [];
  const converted = [];
  const skipped = [];

  if (fs.existsSync(statePath) && !opts.force) {
    throw new Error('.terrace/state.json already exists. Re-run with --force to overwrite migration state.');
  }

  let state = createDefaultState({ projectName: path.basename(cwd) });
  state.workflow.status = 'intake_recorded';
  state.roadmap.phases = extractRoadmapPhases(cwd);
  state.migration = {
    source: 'gsd',
    migrated_at: new Date().toISOString(),
    artifacts,
    converted: [],
    quick_tasks: []
  };

  const projectPath = path.resolve(cwd, '.planning', 'PROJECT.md');
  if (fs.existsSync(projectPath) && writeIfAllowed(cwd, SUPPORTED_ARTIFACTS['.planning/PROJECT.md'], buildPrd(fs.readFileSync(projectPath, 'utf8')), opts.force, writes, skipped, '.planning/PROJECT.md')) {
    converted.push({ artifact: '.planning/PROJECT.md', target: SUPPORTED_ARTIFACTS['.planning/PROJECT.md'], type: 'prd' });
  }

  const requirementsPath = path.resolve(cwd, '.planning', 'REQUIREMENTS.md');
  if (fs.existsSync(requirementsPath) && writeIfAllowed(cwd, SUPPORTED_ARTIFACTS['.planning/REQUIREMENTS.md'], buildCompiledSpec(fs.readFileSync(requirementsPath, 'utf8')), opts.force, writes, skipped, '.planning/REQUIREMENTS.md')) {
    converted.push({ artifact: '.planning/REQUIREMENTS.md', target: SUPPORTED_ARTIFACTS['.planning/REQUIREMENTS.md'], type: 'compiled_spec' });
  }

  const legacyStatePath = path.resolve(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(legacyStatePath) && writeIfAllowed(cwd, SUPPORTED_ARTIFACTS['.planning/STATE.md'], buildStateArchive(fs.readFileSync(legacyStatePath, 'utf8')), opts.force, writes, skipped, '.planning/STATE.md')) {
    converted.push({ artifact: '.planning/STATE.md', target: SUPPORTED_ARTIFACTS['.planning/STATE.md'], type: 'state_archive' });
  }
  applyStateContent(state, cwd);

  migrateSimpleArtifact(cwd, '.planning/ROADMAP.md', SUPPORTED_ARTIFACTS['.planning/ROADMAP.md'], opts.force, writes, skipped, converted, 'roadmap_archive');
  migrateRawArtifact(cwd, '.planning/HANDOFF.json', SUPPORTED_ARTIFACTS['.planning/HANDOFF.json'], opts.force, writes, skipped, converted, 'handoff');
  migrateRawArtifact(cwd, '.planning/config.json', SUPPORTED_ARTIFACTS['.planning/config.json'], opts.force, writes, skipped, converted, 'config');
  migrateSimpleArtifact(cwd, '.planning/MILESTONES.md', SUPPORTED_ARTIFACTS['.planning/MILESTONES.md'], opts.force, writes, skipped, converted, 'milestones');
  migrateSimpleArtifact(cwd, '.planning/RETROSPECTIVE.md', SUPPORTED_ARTIFACTS['.planning/RETROSPECTIVE.md'], opts.force, writes, skipped, converted, 'retrospective');

  const blockers = applyHandoff(state, cwd);

  for (const artifact of listPlanningFiles(cwd)) {
    const isKnown = Object.prototype.hasOwnProperty.call(SUPPORTED_ARTIFACTS, artifact);
    if (!isKnown && migratePhaseArtifact(cwd, artifact, opts.force, writes, skipped, converted, state)) {
      continue;
    }
    if (!isKnown && artifact.startsWith('.planning/quick/')) {
      if (migrateQuickArtifact(cwd, artifact, opts.force, writes, skipped, converted, state)) {
        continue;
      }
    }
    if (!isKnown && artifact.startsWith('.planning/debug/')) {
      const target = 'docs/terrace-migration/' + artifact.replace(/^\.planning\//, '');
      migrateRawArtifact(cwd, artifact, target, opts.force, writes, skipped, converted, 'debug_artifact');
      continue;
    }
    if (!isKnown && artifact.startsWith('.planning/milestones/')) {
      const target = 'docs/terrace-migration/' + artifact.replace(/^\.planning\//, '');
      migrateRawArtifact(cwd, artifact, target, opts.force, writes, skipped, converted, 'milestone_archive');
      continue;
    }
    if (!isKnown) {
      skipped.push(skippedArtifact(artifact, 'unsupported_artifact'));
    }
  }

  state.migration.converted = converted;
  if (opts.force) {
    replaceState(cwd, state);
  } else {
    saveState(cwd, state);
  }
  state = loadState(cwd);
  writes.unshift('.terrace/state.json');
  const nextCommand = nextCommandForState(state);
  state.migration.next_command = nextCommand;
  const agents = installAgentBootstrap(cwd);
  state.migration.agents = {
    manifest_path: agents.manifest_path,
    written: agents.assets.filter((asset) => asset.status === 'written').length,
    unchanged: agents.assets.filter((asset) => asset.status === 'unchanged').length,
    skipped: agents.assets.filter((asset) => asset.status === 'skipped').length
  };
  for (const asset of agents.assets) {
    if (asset.status === 'written') {
      writes.push(asset.path);
    }
  }
  saveState(cwd, state);
  const warnings = skipped.map((item) => ({
    code: item.reason === 'target_exists' ? 'GSD_TARGET_EXISTS' : 'GSD_UNSUPPORTED_ARTIFACT',
    message: item.artifact + ' was not converted automatically.',
    artifact: item.artifact,
    remediation: item.suggested_action
  }));
  const readinessStatus = blockers.length > 0 ? 'blocked' : (warnings.length > 0 ? 'review_required' : 'ready');

  const report = {
    mode: 'migration',
    artifacts,
    converted,
    skipped,
    writes: [...writes, '.terrace/migration/gsd-port-report.json'],
    agents,
    blockers,
    warnings,
    readiness: {
      status: readinessStatus,
      score: readinessStatus === 'ready' ? 100 : readinessStatus === 'review_required' ? 75 : 50
    },
    next_command: nextCommand,
    review_checklist: [
      'Review docs/prd/PRD.md against the original .planning/PROJECT.md.',
      'Review docs/spec/COMPILED-SPEC.md against the original .planning/REQUIREMENTS.md.',
      'Review docs/terrace-migration/GSD-STATE.md for legacy state that should become Terrace decisions or sessions.',
      'Run terrace doctor and terrace audit after reviewing migrated artifacts.',
      'Run ' + nextCommand + ' to resume the migrated workflow.'
    ],
    validation_commands: ['terrace doctor', 'terrace audit']
  };
  const reportPath = path.resolve(cwd, '.terrace', 'migration', 'gsd-port-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  return report;
}

module.exports = {
  COMMAND_STRATEGIES,
  classifyGsdCommand,
  portGsdDryRun,
  portGsd,
  portGsdCompare,
  portGsdVerifyParity,
  portGsdImportRoadmap
};
