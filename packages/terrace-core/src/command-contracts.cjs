'use strict';

const WORKFLOW_COMMAND_CONTRACTS = [
  {
    command: 'terrace next',
    category: 'workflow',
    json: true,
    purpose: 'Report the next Terrace action from state, handoff, and blockers.'
  },
  {
    command: 'terrace resume',
    category: 'workflow',
    json: true,
    purpose: 'Reconstruct paused workflow context from Terrace sessions and migrated handoff data.'
  },
  {
    command: 'terrace history',
    category: 'workflow',
    json: true,
    purpose: 'Summarize migrated operational history across phases, sessions, decisions, and quick tasks.'
  },
  {
    command: 'terrace phase list',
    category: 'roadmap',
    json: true,
    purpose: 'List canonical Terrace roadmap phases.'
  },
  {
    command: 'terrace phase show <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Show one canonical Terrace roadmap phase and its migrated plans.'
  },
  {
    command: 'terrace phase plan <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Prepare one roadmap phase as the active slice.'
  },
  {
    command: 'terrace phase execute <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Enter RED-gate execution for one phase after blockers are clear.'
  },
  {
    command: 'terrace quick list',
    category: 'quick-history',
    json: true,
    purpose: 'List migrated GSD quick-task history.'
  },
  {
    command: 'terrace quick show <id>',
    category: 'quick-history',
    json: true,
    purpose: 'Show one migrated GSD quick task.'
  },
  {
    command: 'terrace backlog list',
    category: 'backlog',
    json: true,
    purpose: 'List canonical Terrace backlog items.'
  },
  {
    command: 'terrace backlog add <title>',
    category: 'backlog',
    json: true,
    purpose: 'Append a Terrace backlog item.'
  },
  {
    command: 'terrace ship check',
    category: 'shipping',
    json: true,
    purpose: 'Run release-readiness checks and report failed quality gates.'
  }
];

function listCommandContracts() {
  return WORKFLOW_COMMAND_CONTRACTS.map((contract) => ({ ...contract }));
}

module.exports = {
  WORKFLOW_COMMAND_CONTRACTS,
  listCommandContracts
};
