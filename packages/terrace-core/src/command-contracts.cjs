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
    command: 'terrace blocker list',
    category: 'workflow',
    json: true,
    purpose: 'List migrated blocking actions with stable IDs and resolution state.'
  },
  {
    command: 'terrace blocker resolve <id> --owner <owner> --evidence <ref>',
    category: 'workflow',
    json: true,
    purpose: 'Record an evidence-bearing correction for one blocking action before retrying its stage.'
  },
  {
    command: 'terrace history',
    category: 'workflow',
    json: true,
    purpose: 'Summarize migrated operational history across phases, sessions, decisions, and quick tasks.'
  },
  {
    command: 'terrace do <intent>',
    category: 'workflow',
    json: true,
    purpose: 'Route natural-language agent intent to stable Terrace commands.'
  },
  {
    command: 'terrace autonomous',
    category: 'workflow',
    json: true,
    purpose: 'Run next phase planning and execution readiness until Terrace reaches a blocker or agent handoff.'
  },
  {
    command: 'terrace execute-phase-complete <id>',
    category: 'workflow',
    json: true,
    purpose: 'Run the Terrace phase lifecycle end to end, stopping at blockers instead of bypassing gates.'
  },
  {
    command: 'terrace settings effort <fast|standard|thorough>',
    category: 'workflow',
    json: true,
    purpose: 'Persist the default phase effort used by Terrace planning and execution artifacts.'
  },
  {
    command: 'terrace commands discover',
    category: 'workflow',
    json: true,
    purpose: 'Discover project package scripts and Terrace quality-gate command mapping.'
  },
  {
    command: 'terrace align <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create the senior-cycle alignment artifact with customer, problem, metrics, risks, rollout, validation, and cleanup intent.'
  },
  {
    command: 'terrace interrogate <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Capture user-driven edge-case, assumption-challenge, and failure-mode interrogation before writing artifacts.'
  },
  {
    command: 'terrace map-codebase',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create codebase map, architecture, risk, testing, and observability context artifacts.'
  },
  {
    command: 'terrace design <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create architecture and maintainability decision artifacts with the no band-aid rule.'
  },
  {
    command: 'terrace test-plan <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create the behavior-first test strategy required before implementation.'
  },
  {
    command: 'terrace observe <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create the feature observability and post-launch debugging plan.'
  },
  {
    command: 'terrace validate-prod <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create production validation signals, monitoring plan, and rollback conditions.'
  },
  {
    command: 'terrace cleanup <feature>',
    category: 'senior-cycle',
    json: true,
    purpose: 'Create the cleanup contract for flags, temporary code, and documentation.'
  },
  {
    command: 'terrace ui import-stitch <feature>',
    category: 'ui',
    json: true,
    purpose: 'Capture imported Stitch design intent for greenfield or brownfield UI work.'
  },
  {
    command: 'terrace ui plan-refresh <feature>',
    category: 'ui',
    json: true,
    purpose: 'Create a UI refresh plan from imported design context.'
  },
  {
    command: 'terrace ui diff <feature>',
    category: 'ui',
    json: true,
    purpose: 'Create a source-to-target UI diff for implementation and verification.'
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
    purpose: 'Generate a phase plan artifact and prepare one roadmap phase as the active slice.'
  },
  {
    command: 'terrace phase execute <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Enter RED-gate execution for one phase after blockers are clear.'
  },
  {
    command: 'terrace phase validate <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Generate validation instructions and move a phase to review readiness.'
  },
  {
    command: 'terrace phase review <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Generate review checklist output for a phase.'
  },
  {
    command: 'terrace phase complete <id>',
    category: 'roadmap',
    json: true,
    purpose: 'Complete a phase and write a summary artifact.'
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
    command: 'terrace quick plan <title>',
    category: 'quick-task',
    json: true,
    purpose: 'Create a stateful Terrace quick-task plan.'
  },
  {
    command: 'terrace quick execute <id>',
    category: 'quick-task',
    json: true,
    purpose: 'Enter RED-gate execution for a quick task.'
  },
  {
    command: 'terrace quick complete <id>',
    category: 'quick-task',
    json: true,
    purpose: 'Complete a quick task and write a summary artifact.'
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
    command: 'terrace corpus run',
    category: 'corpus',
    json: true,
    purpose: 'Run the local Terrace corpus evaluator.'
  },
  {
    command: 'terrace corpus report',
    category: 'corpus',
    json: true,
    purpose: 'Show the latest Terrace corpus report summary.'
  },
  {
    command: 'terrace ship check',
    category: 'shipping',
    json: true,
    purpose: 'Run release-readiness checks and report failed quality gates.'
  },
  {
    command: 'terrace ship check --fast',
    category: 'shipping',
    json: true,
    purpose: 'Run deterministic Terrace gates without executing project package scripts.'
  },
  {
    command: 'terrace ship prepare',
    category: 'shipping',
    json: true,
    purpose: 'Write a PR-ready release summary from ship check results.'
  },
  {
    command: 'terrace release-preflight',
    category: 'shipping',
    json: true,
    purpose: 'Run the Terrace 0.2.0 release preflight flow and summarize trusted publishing, version tags, and stale release instructions.'
  },
  {
    command: 'terrace workbench status [--feature <id>]',
    category: 'shipping',
    json: true,
    purpose: 'Read release evidence, senior-cycle gaps, workstreams, debt, security, test eval, and report-card claim scope for one feature.'
  },
  {
    command: 'terrace workbench prepare <feature>',
    category: 'shipping',
    json: true,
    purpose: 'Write production workbench artifacts from existing Terrace primitives: preflight, runbook, release AI review, workstreams, and optional handoff.'
  },
  {
    command: 'terrace report ceremony',
    category: 'shipping',
    json: true,
    purpose: 'Check artifact count, generated word volume, and low-density documentation signals.'
  },
  {
    command: 'terrace waive <gate>',
    category: 'shipping',
    json: true,
    purpose: 'Record a reviewed temporary gate waiver with owner, reason, and expiry.'
  },
  {
    command: 'terrace port gsd --compare',
    category: 'migration',
    json: true,
    purpose: 'Compare legacy GSD concepts against Terrace migration coverage before porting.'
  },
  {
    command: 'terrace port gsd --verify-parity',
    category: 'migration',
    json: true,
    purpose: 'Fail when legacy GSD concepts are present but unmapped by Terrace migration.'
  },
  {
    command: 'terrace port gsd --import-roadmap',
    category: 'migration',
    json: true,
    purpose: 'Merge missing legacy roadmap phases into existing Terrace state without overwriting existing phase objects.'
  },
  {
    command: 'terrace planning refresh',
    category: 'planning',
    json: true,
    purpose: 'Initialize or refresh the repo .planning package from Terrace state and repository analysis.'
  },
  {
    command: 'terrace security check',
    category: 'security',
    json: true,
    purpose: 'Run deterministic local security checks and write Terrace security evidence.'
  }
];

function listCommandContracts() {
  return WORKFLOW_COMMAND_CONTRACTS.map((contract) => ({ ...contract }));
}

module.exports = {
  WORKFLOW_COMMAND_CONTRACTS,
  listCommandContracts
};
