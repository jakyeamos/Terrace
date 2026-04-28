'use strict';

const fs = require('fs');
const path = require('path');

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

module.exports = {
  COMMAND_STRATEGIES,
  classifyGsdCommand,
  portGsdDryRun
};
