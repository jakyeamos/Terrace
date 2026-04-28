'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultState, saveState } = require('./state.cjs');

const COMMAND_STRATEGIES = {
  improved: ['gsd-new-project', 'gsd-discuss-phase', 'gsd-plan-phase', 'gsd-execute-phase', 'gsd-quick'],
  replaced: ['gsd-validate-phase', 'gsd-verify-work', 'gsd-ship'],
  'as-is': ['gsd-note', 'gsd-add-todo', 'gsd-check-todos', 'gsd-health', 'gsd-stats', 'gsd-forensics', 'gsd-map-codebase']
};

const SUPPORTED_ARTIFACTS = {
  '.planning/PROJECT.md': 'docs/prd/PRD.md',
  '.planning/REQUIREMENTS.md': 'docs/spec/COMPILED-SPEC.md',
  '.planning/STATE.md': 'docs/terrace-migration/GSD-STATE.md'
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

function extractRoadmapPhases(cwd) {
  const roadmapPath = path.resolve(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    return [];
  }

  const content = fs.readFileSync(roadmapPath, 'utf8');
  const headings = content
    .split(/\r?\n/)
    .map((line) => line.match(/^#{2,}\s+(.+?)\s*$/))
    .filter(Boolean)
    .map((match) => match[1]);

  return headings.map((title) => ({
    id: slugify(title),
    title,
    status: 'migrated',
    source_ref: '.planning/ROADMAP.md'
  }));
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

function writeIfAllowed(cwd, relTarget, content, force, writes, skipped, artifact) {
  const targetPath = path.resolve(cwd, relTarget);
  if (fs.existsSync(targetPath) && !force) {
    skipped.push({ artifact, target: relTarget, reason: 'target_exists' });
    return false;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  writes.push(relTarget);
  return true;
}

function portGsdDryRun(cwd) {
  const artifacts = [];

  collectArtifact(cwd, '.planning/ROADMAP.md', artifacts);
  collectArtifact(cwd, '.planning/STATE.md', artifacts);
  collectArtifact(cwd, '.planning/PROJECT.md', artifacts);
  collectArtifact(cwd, '.planning/REQUIREMENTS.md', artifacts);

  return {
    mode: 'dry-run',
    artifacts,
    command_strategies: COMMAND_STRATEGIES,
    writes: []
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

  const state = createDefaultState({ projectName: path.basename(cwd) });
  state.workflow.status = 'intake_recorded';
  state.roadmap.phases = extractRoadmapPhases(cwd);
  state.migration = {
    source: 'gsd',
    migrated_at: new Date().toISOString(),
    artifacts,
    converted: []
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

  for (const artifact of listPlanningFiles(cwd)) {
    const isKnown = Object.prototype.hasOwnProperty.call(SUPPORTED_ARTIFACTS, artifact) || artifact === '.planning/ROADMAP.md';
    if (!isKnown) {
      skipped.push({ artifact, reason: 'unsupported_artifact' });
    }
  }

  state.migration.converted = converted;
  saveState(cwd, state);
  writes.unshift('.terrace/state.json');

  const report = {
    mode: 'migration',
    artifacts,
    converted,
    skipped,
    writes: [...writes, '.terrace/migration/gsd-port-report.json'],
    review_checklist: [
      'Review docs/prd/PRD.md against the original .planning/PROJECT.md.',
      'Review docs/spec/COMPILED-SPEC.md against the original .planning/REQUIREMENTS.md.',
      'Review docs/terrace-migration/GSD-STATE.md for legacy state that should become Terrace decisions or sessions.',
      'Run terrace doctor and terrace audit after reviewing migrated artifacts.'
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
  portGsd
};
