'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeRepository } = require('./repo-analysis.cjs');
const { packageManagerFor, scriptCommand } = require('./package-manager.cjs');
const { loadState } = require('./state.cjs');

function slugify(value, fallback) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback || 'item';
}

function phaseNumber(phase, index) {
  const titleMatch = String(phase.title || '').match(/phase\s+(\d+(?:\.\d+)?)/i);
  if (titleMatch) {
    return titleMatch[1];
  }
  const idMatch = String(phase.id || '').match(/(?:^|-)phase-(\d+(?:\.\d+)?)(?:-|$)/i);
  if (idMatch) {
    return idMatch[1];
  }
  return String(index + 1);
}

function paddedPhaseNumber(value) {
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isInteger(numeric) && numeric >= 0 && numeric < 100) {
    return String(numeric).padStart(2, '0');
  }
  return String(value).replace(/[^0-9.]/g, '') || '01';
}

function phaseDirectory(phase, index) {
  const number = paddedPhaseNumber(phaseNumber(phase, index));
  const title = String(phase.title || phase.id || 'phase').replace(/phase\s+\d+(?:\.\d+)?:?/i, '');
  return number + '-' + slugify(title || phase.id, 'phase');
}

function projectCommands(analysis, cwd) {
  const packageManager = packageManagerFor(cwd);
  const scripts = analysis.scripts || {};
  return Object.keys(scripts).sort().map((script) => ({
    script,
    command: scriptCommand(packageManager, script)
  }));
}

function bulletList(items, empty) {
  const unique = Array.from(new Set((items || []).filter(Boolean))).sort();
  return unique.length > 0 ? unique.map((item) => '- ' + item) : ['- ' + empty];
}

function phasesFromState(state) {
  return state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
}

function withoutPlanningFiles(files) {
  return (files || []).filter((file) => !String(file).startsWith('.planning/'));
}

function normalizeAnalysisForPlanning(analysis) {
  return {
    ...analysis,
    files: withoutPlanningFiles(analysis.files),
    changed_files: withoutPlanningFiles(analysis.changed_files),
    source_files: withoutPlanningFiles(analysis.source_files),
    test_files: withoutPlanningFiles(analysis.test_files),
    docs_files: withoutPlanningFiles(analysis.docs_files),
    config_files: withoutPlanningFiles(analysis.config_files),
    migrations: withoutPlanningFiles(analysis.migrations),
    route_hints: withoutPlanningFiles(analysis.route_hints),
    component_hints: withoutPlanningFiles(analysis.component_hints)
  };
}

function backlogItems(state) {
  return state.backlog && Array.isArray(state.backlog.items) ? state.backlog.items : [];
}

function writeFile(cwd, relativePath, content, writes) {
  const resolved = path.resolve(cwd, relativePath);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('UNSAFE_PATH: generated planning path is outside the project root');
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content.endsWith('\n') ? content : content + '\n', 'utf8');
  writes.push(relativePath);
}

function projectMarkdown(state, analysis, cwd) {
  const pkg = analysis.package_json || {};
  return [
    '# Project',
    '',
    '## Identity',
    '- Name: ' + (state.project && state.project.name ? state.project.name : path.basename(cwd)),
    '- Package: ' + (pkg.name || 'unpackaged'),
    '- Description: ' + (pkg.description || 'Not recorded.'),
    '',
    '## Repository Shape',
    '- Files: ' + String(analysis.files.length),
    '- Source files: ' + String(analysis.source_files.length),
    '- Test files: ' + String(analysis.test_files.length),
    '- Docs files: ' + String(analysis.docs_files.length),
    '- Config files: ' + String(analysis.config_files.length),
    '',
    '## Primary Dependencies',
    ...bulletList(Object.keys(analysis.dependencies || {}).slice(0, 25), 'No package dependencies detected.'),
    ''
  ].join('\n');
}

function requirementsMarkdown(state, analysis, cwd) {
  const commands = projectCommands(analysis, cwd).filter((item) => ['typecheck', 'lint', 'test', 'test:coverage', 'build'].includes(item.script));
  return [
    '# Requirements',
    '',
    '## Workflow',
    '- Keep Terrace state canonical in `.terrace/state.json`.',
    '- Keep this `.planning` package refreshable from Terrace state and repository analysis.',
    '- Preserve deterministic JSON output for CLI automation.',
    '',
    '## Quality Gates',
    ...(commands.length > 0 ? commands.map((item) => '- ' + item.command) : ['- No standard quality scripts detected.']),
    '',
    '## Protected Tests',
    ...bulletList((state.protected_tests || []).map((item) => typeof item === 'string' ? item : item.path || item.name), 'No protected tests recorded.'),
    ''
  ].join('\n');
}

function roadmapMarkdown(state) {
  const phases = phasesFromState(state);
  return [
    '# Roadmap',
    '',
    ...(phases.length > 0 ? phases.flatMap((phase) => [
      '## ' + (phase.title || phase.id),
      '',
      '- ID: ' + phase.id,
      '- Status: ' + (phase.status || 'planned'),
      '- Source: ' + (phase.source_ref || '.terrace/state.json'),
      ''
    ]) : ['## Phase 1: Repository Planning Parity', '', '- ID: phase-1-repository-planning-parity', '- Status: planned', '- Source: .terrace/state.json', ''])
  ].join('\n');
}

function stateMarkdown(state, analysis, cwd) {
  const changedFiles = analysis.changed_files || [];
  const activeSlice = state.active_slice && typeof state.active_slice === 'object' ? state.active_slice : null;
  return [
    '# State',
    '',
    '## Workflow',
    '- Status: ' + (state.workflow && state.workflow.status ? state.workflow.status : 'unknown'),
    '- Mode: ' + (state.workflow && state.workflow.mode ? state.workflow.mode : 'unknown'),
    '- Active feature: ' + (state.workflow && state.workflow.active_feature ? state.workflow.active_feature : 'none'),
    '- Active slice: ' + (activeSlice && activeSlice.id ? activeSlice.id : 'none'),
    '',
    '## Repository Analysis',
    '- Package manager: ' + packageManagerFor(cwd),
    '- Changed files: ' + String(changedFiles.length),
    '- Source files: ' + String(analysis.source_files.length),
    '- Test files: ' + String(analysis.test_files.length),
    '- Migrations: ' + String(analysis.migrations.length),
    '',
    '## Changed Files',
    ...bulletList(changedFiles, 'No changed files detected.'),
    '',
    '## Decisions',
    ...bulletList((state.decisions || []).map((item) => item.text || item.decision || String(item)), 'No decisions recorded.'),
    '',
    '## Parking Lot',
    ...bulletList(backlogItems(state).map((item) => item.title || item.id), 'No backlog items recorded.'),
    '',
    '## Blockers',
    ...bulletList((state.blocked_actions || []).filter((item) => item.blocking).map((item) => item.description), 'No blocking human actions recorded.'),
    ''
  ].join('\n');
}

function handoffJson(state) {
  return JSON.stringify({
    status: state.handoff && state.handoff.status ? state.handoff.status : (state.workflow && state.workflow.status ? state.workflow.status : 'initialized'),
    phase: state.handoff && state.handoff.phase ? state.handoff.phase : null,
    next_action: state.handoff && state.handoff.next_action ? state.handoff.next_action : 'terrace next',
    human_actions_pending: (state.blocked_actions || []).map((item) => ({
      description: item.description,
      blocking: Boolean(item.blocking)
    }))
  }, null, 2) + '\n';
}

function configJson(analysis, cwd) {
  return JSON.stringify({
    version: '1.0',
    generated_by: 'terrace planning refresh',
    package_manager: packageManagerFor(cwd),
    scripts: Object.keys(analysis.scripts || {}).sort()
  }, null, 2) + '\n';
}

function phasePlanMarkdown(phase, analysis, cwd, index) {
  const commands = projectCommands(analysis, cwd).filter((item) => ['typecheck', 'lint', 'test', 'build'].includes(item.script));
  return [
    '# ' + (phase.title || phase.id),
    '',
    '## Objective',
    'Refresh and execute `' + phase.id + '` from canonical Terrace state.',
    '',
    '## Source',
    '- Phase source: ' + (phase.source_ref || '.terrace/state.json'),
    '- Planning artifact: .planning/phases/' + phaseDirectory(phase, index),
    '',
    '## Repository Context',
    '- Source files: ' + String(analysis.source_files.length),
    '- Test files: ' + String(analysis.test_files.length),
    '- Route hints: ' + String((analysis.route_hints || []).length),
    '- Component hints: ' + String((analysis.component_hints || []).length),
    '',
    '## Likely Files',
    ...bulletList((analysis.changed_files.length > 0 ? analysis.changed_files : analysis.source_files).slice(0, 20), 'No likely files detected.'),
    '',
    '## Validation Commands',
    ...(commands.length > 0 ? commands.map((item) => '- ' + item.command) : ['- No standard validation scripts detected.']),
    ''
  ].join('\n');
}

function refreshPlanningPackage(cwd) {
  const state = loadState(cwd);
  const analysis = normalizeAnalysisForPlanning(analyzeRepository(cwd));
  const writes = [];
  const phases = phasesFromState(state);

  writeFile(cwd, '.planning/PROJECT.md', projectMarkdown(state, analysis, cwd), writes);
  writeFile(cwd, '.planning/REQUIREMENTS.md', requirementsMarkdown(state, analysis, cwd), writes);
  writeFile(cwd, '.planning/ROADMAP.md', roadmapMarkdown(state), writes);
  writeFile(cwd, '.planning/STATE.md', stateMarkdown(state, analysis, cwd), writes);
  writeFile(cwd, '.planning/HANDOFF.json', handoffJson(state), writes);
  writeFile(cwd, '.planning/config.json', configJson(analysis, cwd), writes);

  const phaseArtifacts = phases.map((phase, index) => {
    const dir = phaseDirectory(phase, index);
    const number = paddedPhaseNumber(phaseNumber(phase, index));
    const artifact = '.planning/phases/' + dir + '/' + number + '-01-PLAN.md';
    writeFile(cwd, artifact, phasePlanMarkdown(phase, analysis, cwd, index), writes);
    return {
      id: phase.id,
      title: phase.title || phase.id,
      artifact
    };
  });

  return {
    mode: 'refresh',
    planning_dir: '.planning',
    state_ref: '.terrace/state.json',
    analysis: {
      files: analysis.files.length,
      source_files: analysis.source_files.length,
      test_files: analysis.test_files.length,
      docs_files: analysis.docs_files.length,
      changed_files: analysis.changed_files.length,
      package_manager: packageManagerFor(cwd)
    },
    writes: writes.sort(),
    phases: phaseArtifacts,
    next_command: 'terrace port gsd --verify-parity'
  };
}

module.exports = {
  refreshPlanningPackage
};
