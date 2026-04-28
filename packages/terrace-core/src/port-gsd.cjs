'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultState, saveState } = require('./state.cjs');

const COMMAND_STRATEGIES = {
  improved: ['gsd-new-project', 'gsd-discuss-phase', 'gsd-plan-phase', 'gsd-execute-phase', 'gsd-quick'],
  replaced: ['gsd-validate-phase', 'gsd-verify-work', 'gsd-ship'],
  'as-is': ['gsd-note', 'gsd-add-todo', 'gsd-check-todos', 'gsd-health', 'gsd-stats', 'gsd-forensics', 'gsd-map-codebase']
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

  if (fs.existsSync(statePath) && !opts.force) {
    throw new Error('.terrace/state.json already exists. Re-run with --force to overwrite migration state.');
  }

  const state = createDefaultState({ projectName: path.basename(cwd) });
  state.workflow.status = 'intake_recorded';
  state.migration = {
    source: 'gsd',
    migrated_at: new Date().toISOString(),
    artifacts
  };
  saveState(cwd, state);

  const report = {
    mode: 'migration',
    artifacts,
    skipped: [],
    writes: ['.terrace/state.json', '.terrace/migration/gsd-port-report.json']
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
