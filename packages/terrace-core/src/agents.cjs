'use strict';

const fs = require('fs');
const path = require('path');

const AGENT_SCHEMA_VERSION = '1.0';

function lines(items) {
  return items.join('\n') + '\n';
}

const AGENTS_MD = lines([
  '# Terrace Agent Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Start by running `terrace next` when the next workflow step is unclear.',
  '- Route natural-language workflow requests through `terrace do "<intent>"`.',
  '- Use `terrace quick plan`, `terrace quick execute`, and `terrace quick complete` for small scoped work.',
  '- Use `terrace phase plan`, `terrace phase execute`, `terrace phase validate`, `terrace phase review`, and `terrace phase complete` for roadmap phase work.',
  '- Use `terrace execute-phase-complete <id>` only when the user wants a full phase lifecycle and Terrace gates allow it.',
  '- Set phase depth with `terrace settings effort <fast|standard|thorough>`.',
  '- Run `terrace ship check` before treating protected work as ready to ship.',
  '- Preserve spec and test evidence before changing protected implementation behavior.',
  '- Do not bypass repository quality gates or Terrace governance state.',
  '- Keep changes scoped, recoverable, and tied to the command output Terrace reports.'
]);

const CLAUDE_MD = lines([
  '# Terrace Claude Code Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Run `terrace next` to identify the next workflow action.',
  '- Route natural-language requests through `terrace do "<intent>"` when a stable Terrace command is not obvious.',
  '- Use the repo-local `/terrace-*` project commands when available; they mirror the README command reference.',
  '- Preserve spec intent, behavior-first tests, validation evidence, and release gates.',
  '- Do not overwrite Terrace state or bypass `terrace ship check` for protected work.',
  '- Keep edits scoped to the active Terrace task and stop at blockers reported by Terrace.'
]);

function skillContent(name, description, bodyLines) {
  return lines([
    '---',
    'name: ' + name,
    'description: ' + description,
    '---',
    '',
    ...bodyLines
  ]);
}

function commandContent(description, argumentHint, bodyLines) {
  return lines([
    '---',
    'description: ' + description,
    ...(argumentHint ? ['argument-hint: ' + argumentHint] : []),
    '---',
    '',
    ...bodyLines
  ]);
}

const TERRACE_COMMANDS = [
  ['terrace-help', 'terrace --help', '', 'Show the top-level Terrace command list.'],
  ['terrace-version', 'terrace --version', '', 'Print the installed Terrace package version.'],
  ['terrace-init', 'terrace init', '', 'Initialize Terrace state and non-overwriting agent bootstrap assets.'],
  ['terrace-new-project', 'terrace new-project $ARGUMENTS', '<name> --prd <file>|--paste-prd', 'Initialize Terrace from a source PRD and write project artifacts.'],
  ['terrace-prd-import', 'terrace prd import $ARGUMENTS', '<feature> --file <file>|--paste', 'Import a feature PRD into an existing Terrace project.'],
  ['terrace-doctor', 'terrace doctor', '', 'Check Terrace installation health.'],
  ['terrace-spec-validate', 'terrace spec validate', '', 'Validate Terrace governance artifacts.'],
  ['terrace-spec-hash', 'terrace spec hash --file $ARGUMENTS', '<path>', 'Compute a stable spec hash for a file.'],
  ['terrace-audit', 'terrace audit', '', 'Check artifacts and protected baselines.'],
  ['terrace-ci-check', 'terrace ci check $ARGUMENTS', '[files...]', 'Run audit plus protected-change enforcement.'],
  ['terrace-port-gsd-dry-run', 'terrace port gsd --dry-run', '', 'Inventory legacy GSD artifacts without writing Terrace state.'],
  ['terrace-port-gsd', 'terrace port gsd', '', 'Migrate supported legacy GSD artifacts into Terrace state.'],
  ['terrace-next', 'terrace next', '', 'Find and follow the next Terrace workflow action.'],
  ['terrace-resume', 'terrace resume', '', 'Reconstruct paused Terrace workflow context.'],
  ['terrace-history', 'terrace history', '', 'Summarize migrated phases, sessions, decisions, and quick tasks.'],
  ['terrace-do', 'terrace do "$ARGUMENTS"', '<intent>', 'Route natural-language agent intent to stable Terrace commands.'],
  ['terrace-autonomous', 'terrace autonomous', '', 'Plan the next phase and stop at blockers or agent handoff.'],
  ['terrace-execute-phase-complete', 'terrace execute-phase-complete $ARGUMENTS', '<phase-id>', 'Run a complete Terrace phase lifecycle from planning through completion.'],
  ['terrace-settings-effort', 'terrace settings effort $ARGUMENTS', '<fast|standard|thorough>', 'Set the default phase effort used in planning and execution artifacts.'],
  ['terrace-settings-show', 'terrace settings show', '', 'Show current Terrace settings.'],
  ['terrace-commands-discover', 'terrace commands discover', '', 'Discover project quality scripts and command mappings.'],
  ['terrace-align', 'terrace align $ARGUMENTS', '<feature>', 'Write senior-cycle alignment intent for a feature.'],
  ['terrace-interrogate', 'terrace interrogate $ARGUMENTS', '<feature>', 'Write edge-case, assumption-challenge, and failure-mode interrogation.'],
  ['terrace-map-codebase', 'terrace map-codebase', '', 'Write repo-derived codebase map, architecture, risks, testing, and observability context.'],
  ['terrace-design', 'terrace design $ARGUMENTS', '<feature>', 'Record architecture decisions, tradeoffs, maintainability, and no-band-aid intent.'],
  ['terrace-test-plan', 'terrace test-plan $ARGUMENTS', '<feature>', 'Write the behavior-first test plan required before implementation.'],
  ['terrace-observe', 'terrace observe $ARGUMENTS', '<feature>', 'Write feature observability and post-launch debugging intent.'],
  ['terrace-validate-prod', 'terrace validate-prod $ARGUMENTS', '<feature>', 'Write production success signals, monitoring, and rollback conditions.'],
  ['terrace-cleanup', 'terrace cleanup $ARGUMENTS', '<feature>', 'Write cleanup contract for flags, temporary code, and docs.'],
  ['terrace-ui-import-stitch', 'terrace ui import-stitch $ARGUMENTS', '<feature>', 'Capture a Stitch design import for UI work.'],
  ['terrace-ui-plan-refresh', 'terrace ui plan-refresh $ARGUMENTS', '<feature>', 'Plan a design-driven UI refresh.'],
  ['terrace-ui-diff', 'terrace ui diff $ARGUMENTS', '<feature>', 'Write UI source and target diff context.'],
  ['terrace-phase-list', 'terrace phase list', '', 'List canonical roadmap phases.'],
  ['terrace-phase-show', 'terrace phase show $ARGUMENTS', '<phase-id>', 'Show one roadmap phase and its migrated plans.'],
  ['terrace-phase-plan', 'terrace phase plan $ARGUMENTS', '<phase-id>', 'Write a migrated-context phase plan artifact.'],
  ['terrace-phase-execute', 'terrace phase execute $ARGUMENTS', '<phase-id>', 'Enter RED-gate execution for a phase after blockers are clear.'],
  ['terrace-phase-validate', 'terrace phase validate $ARGUMENTS', '<phase-id>', 'Write a phase validation artifact.'],
  ['terrace-phase-review', 'terrace phase review $ARGUMENTS', '<phase-id>', 'Write a phase review artifact.'],
  ['terrace-phase-complete', 'terrace phase complete $ARGUMENTS', '<phase-id>', 'Write a phase summary and mark the phase complete.'],
  ['terrace-quick-list', 'terrace quick list', '', 'List migrated GSD quick-task history.'],
  ['terrace-quick-show', 'terrace quick show $ARGUMENTS', '<quick-task-id>', 'Show one migrated quick task.'],
  ['terrace-quick-plan', 'terrace quick plan "$ARGUMENTS"', '<title>', 'Create a stateful quick-task plan.'],
  ['terrace-quick-execute', 'terrace quick execute $ARGUMENTS', '<quick-task-id>', 'Enter RED-gate execution for a quick task.'],
  ['terrace-quick-complete', 'terrace quick complete $ARGUMENTS', '<quick-task-id>', 'Complete a quick task after verification evidence exists.'],
  ['terrace-backlog-list', 'terrace backlog list', '', 'List backlog items.'],
  ['terrace-backlog-add', 'terrace backlog add "$ARGUMENTS"', '<title>', 'Append a backlog item.'],
  ['terrace-ship-check', 'terrace ship check', '', 'Run read-only release readiness checks.'],
  ['terrace-ship-prepare', 'terrace ship prepare', '', 'Write a release-readiness summary artifact.'],
  ['terrace-plan-phase', 'terrace plan-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase planning alias.'],
  ['terrace-execute-phase', 'terrace execute-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase execution alias.'],
  ['terrace-validate-phase', 'terrace validate-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase validation alias.'],
  ['terrace-review-phase', 'terrace review-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase review alias.'],
  ['terrace-complete-phase', 'terrace complete-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase completion alias.'],
  ['terrace-rule-list', 'terrace rule list', '', 'List installed rule packs.'],
  ['terrace-rule-explain', 'terrace rule explain $ARGUMENTS', '<rule-id>', 'Explain a Terrace rule.'],
  ['terrace-preset-list', 'terrace preset list', '', 'List installed presets.'],
  ['terrace-preset-install', 'terrace preset install $ARGUMENTS', '<preset-id>', 'Install a Terrace preset.']
];

function titleFromName(name) {
  return name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function workflowFromCommand(entry) {
  const [name, command, argumentHint, description] = entry;
  return {
    name,
    description,
    argumentHint,
    body: [
      '# ' + titleFromName(name),
      '',
      'Run `' + command + '`.',
      '',
      'Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.'
    ]
  };
}

const TERRACE_WORKFLOWS = TERRACE_COMMANDS.map(workflowFromCommand);

function templateAssets() {
  return [
    { path: 'AGENTS.md', type: 'codex-instructions', content: AGENTS_MD },
    { path: 'CLAUDE.md', type: 'claude-instructions', content: CLAUDE_MD },
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.agents/skills/' + workflow.name + '/SKILL.md',
      type: 'codex-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/skills/' + workflow.name + '/SKILL.md',
      type: 'claude-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/commands/' + workflow.name + '.md',
      type: 'claude-command',
      content: commandContent(workflow.description, workflow.argumentHint, workflow.body)
    }))
  ];
}

function writeAsset(cwd, asset) {
  const target = path.resolve(cwd, asset.path);
  if (!target.startsWith(path.resolve(cwd) + path.sep)) {
    throw new Error('Agent asset path escapes repository: ' + asset.path);
  }
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8');
    return {
      path: asset.path,
      type: asset.type,
      status: existing === asset.content ? 'unchanged' : 'skipped'
    };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, asset.content, 'utf8');
  return { path: asset.path, type: asset.type, status: 'written' };
}

function writeManifest(cwd, assetResults) {
  const relPath = '.terrace/agents/manifest.json';
  const target = path.resolve(cwd, relPath);
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: 'terrace init',
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const status = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content ? 'unchanged' : 'written';
  fs.writeFileSync(target, content, 'utf8');
  return { path: relPath, type: 'manifest', status };
}

function installAgentBootstrap(cwd) {
  const assetResults = templateAssets().map((asset) => writeAsset(cwd, asset));
  const manifestResult = writeManifest(cwd, assetResults);
  return {
    enabled: true,
    manifest_path: manifestResult.path,
    assets: [...assetResults, manifestResult]
  };
}

function agentAssetExpectations() {
  const assets = templateAssets();
  return {
    codexSkills: assets.filter((asset) => asset.type === 'codex-skill').length,
    claudeSkills: assets.filter((asset) => asset.type === 'claude-skill').length,
    claudeCommands: assets.filter((asset) => asset.type === 'claude-command').length
  };
}

module.exports = {
  agentAssetExpectations,
  installAgentBootstrap,
  templateAssets
};
