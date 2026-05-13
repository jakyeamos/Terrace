'use strict';

const fs = require('fs');
const os = require('os');
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

function skillContent(name, description, bodyLines, metadata) {
  const meta = metadata || {};
  return lines([
    '---',
    'name: ' + name,
    'description: ' + description,
    ...(meta.argumentHint ? ['argument-hint: ' + meta.argumentHint] : []),
    ...(Array.isArray(meta.allowedTools) && meta.allowedTools.length > 0
      ? ['allowed-tools:', ...meta.allowedTools.map((tool) => '  - ' + tool)]
      : []),
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
  ['terrace-interrogate', 'terrace interrogate $ARGUMENTS', '<feature>', 'Gather user input for edge-case, assumption-challenge, and failure-mode interrogation.'],
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
  ['terrace-corpus-run', 'terrace corpus run $ARGUMENTS', '[--sample|--all-shadow] [--track <track>] [--dry-run-plan]', 'Run the local Terrace corpus evaluator.'],
  ['terrace-corpus-report', 'terrace corpus report', '', 'Show the latest Terrace corpus report summary.'],
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
  if (name === 'terrace-autonomous') {
    return {
      name,
      description: 'Run autonomous Terrace phase advancement until blockers, gates, or agent handoff require stopping.',
      argumentHint,
      allowedTools: ['Read', 'Write', 'Bash', 'Glob', 'Grep', 'Task'],
      body: [
        '<objective>',
        'Advance Terrace roadmap work autonomously using Terrace as the workflow authority. Run the next Terrace action, inspect the JSON result, execute the requested implementation work when gates allow it, verify the result, and continue until Terrace reports a blocker, a handoff, or release-readiness work.',
        '',
        'Creates or updates Terrace-owned artifacts such as `docs/terrace/phases/<id>/PLAN.md`, validation/review/summary files, `.terrace/state.json`, and the report card when invoked by Terrace commands.',
        '</objective>',
        '',
        '<context>',
        'Start with `terrace autonomous --json`. That command performs the durable Terrace planning/readiness pass for the next phase and returns a structured `status`, `planned`, `execution`, blockers, and `next_command`.',
        '',
        'Terrace does not bypass human decisions, RED gates, missing verification evidence, blocked migrated actions, or release gates. Treat any `blocked`, `blockers`, `required_action`, or non-null handoff action as authoritative.',
        '</context>',
        '',
        '<process>',
        '1. Run `terrace autonomous --json`.',
        '2. Inspect `status`, `next_command`, `planned`, `execution`, `blockers`, and generated artifact paths before editing code.',
        '3. If Terrace reports blockers or required user input, stop and report the concrete blocker and next command.',
        '4. If execution is allowed, read the generated phase plan and implement only that phase scope.',
        '5. Run the smallest relevant verification from discovered project commands or the phase plan.',
        '6. Add validation evidence, then run the Terrace next command such as `terrace phase validate <id>`, `terrace phase review <id>`, or `terrace phase complete <id>` when its gate is satisfied.',
        '7. Repeat from `terrace next --json` or `terrace autonomous --json` only while Terrace continues to point at phase work and no blocker is present.',
        '</process>',
        '',
        '<stop_conditions>',
        '- Terrace returns blockers, `allowed: false`, or a `required_action`.',
        '- The next command requires user judgment, waiver approval, external credentials, or production access.',
        '- The next command is release readiness (`terrace ship check` or `terrace ship prepare`). Run checks only when the user asked to ship; otherwise report the handoff.',
        '- Verification cannot be run or fails.',
        '</stop_conditions>',
        '',
        'Do not claim the autonomous run completed unless Terrace gates and verification agree. Do not rewrite unrelated files or clear blockers manually.'
      ]
    };
  }
  if (name === 'terrace-interrogate') {
    return {
      name,
      description,
      argumentHint,
      body: [
        '# Terrace Interrogate',
        '',
        'Run `terrace interrogate $ARGUMENTS --json` first to get repo-informed interrogation questions.',
        '',
        'If Terrace reports `INTERROGATION_REQUIRES_USER_INPUT`, do not tell the user to rerun a command. Ask the returned questions in this chat, wait for the user answers, then run `terrace interrogate $ARGUMENTS --answers-file <captured-answer-file> --json` yourself.',
        '',
        'Use the answers as the authority. Repository analysis may suggest risks and prompts, but it must never replace user input for interrogation.',
        '',
        'Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.'
      ]
    };
  }
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

const TERRACE_GLOBAL_ENTRYPOINT = {
  name: 'terrace',
  description: 'Route Terrace workflow intent through the local Terrace CLI.',
  body: [
    '# Terrace',
    '',
    'Run `terrace do "$ARGUMENTS"` when arguments are provided.',
    '',
    'If no arguments are provided, run `terrace next` to identify the next workflow action.',
    '',
    'Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.'
  ]
};

function templateAssets() {
  return [
    { path: 'AGENTS.md', type: 'codex-instructions', content: AGENTS_MD },
    { path: 'CLAUDE.md', type: 'claude-instructions', content: CLAUDE_MD },
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.agents/skills/' + workflow.name + '/SKILL.md',
      type: 'codex-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/skills/' + workflow.name + '/SKILL.md',
      type: 'claude-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/commands/' + workflow.name + '.md',
      type: 'claude-command',
      content: commandContent(workflow.description, workflow.argumentHint, workflow.body)
    }))
  ];
}

function globalTemplateAssets() {
  return [
    {
      path: 'skills/terrace/SKILL.md',
      type: 'codex-global-skill',
      content: skillContent(TERRACE_GLOBAL_ENTRYPOINT.name, TERRACE_GLOBAL_ENTRYPOINT.description, TERRACE_GLOBAL_ENTRYPOINT.body)
    },
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: 'skills/' + workflow.name + '/SKILL.md',
      type: 'codex-global-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    }))
  ];
}

function globalClaudeTemplateAssets() {
  return [
    {
      path: 'skills/terrace/SKILL.md',
      type: 'claude-global-skill',
      content: skillContent(TERRACE_GLOBAL_ENTRYPOINT.name, TERRACE_GLOBAL_ENTRYPOINT.description, TERRACE_GLOBAL_ENTRYPOINT.body)
    },
    {
      path: 'commands/terrace.md',
      type: 'claude-global-command',
      content: commandContent(TERRACE_GLOBAL_ENTRYPOINT.description, '<intent>', TERRACE_GLOBAL_ENTRYPOINT.body)
    },
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: 'skills/' + workflow.name + '/SKILL.md',
      type: 'claude-global-skill',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: 'commands/' + workflow.name + '.md',
      type: 'claude-global-command',
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

function defaultGlobalAgentsDir() {
  return process.env.TERRACE_GLOBAL_AGENTS_DIR || path.join(os.homedir(), '.agents');
}

function defaultGlobalClaudeDir() {
  return process.env.TERRACE_GLOBAL_CLAUDE_DIR || path.join(os.homedir(), '.claude');
}

function writeGlobalAsset(rootDir, asset) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, asset.path);
  if (!target.startsWith(root + path.sep)) {
    throw new Error('Global agent asset path escapes target directory: ' + asset.path);
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

function writeGlobalManifest(rootDir, relPath, generatedBy, assetResults) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relPath);
  if (!target.startsWith(root + path.sep)) {
    throw new Error('Global agent manifest path escapes target directory.');
  }
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: generatedBy,
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const status = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content ? 'unchanged' : 'written';
  fs.writeFileSync(target, content, 'utf8');
  return { path: relPath, type: 'global-manifest', status };
}

function installGlobalAgentBootstrap(options) {
  const opts = options || {};
  const globalAgentsDir = path.resolve(opts.globalAgentsDir || defaultGlobalAgentsDir());
  const globalClaudeDir = path.resolve(opts.globalClaudeDir || defaultGlobalClaudeDir());
  const codexAssetResults = globalTemplateAssets().map((asset) => writeGlobalAsset(globalAgentsDir, asset));
  const codexManifestResult = writeGlobalManifest(globalAgentsDir, 'terrace/manifest.json', 'terrace agents install-global', codexAssetResults);
  const claudeAssetResults = globalClaudeTemplateAssets().map((asset) => writeGlobalAsset(globalClaudeDir, asset));
  const claudeManifestResult = writeGlobalManifest(globalClaudeDir, 'terrace/manifest.json', 'terrace agents install-global', claudeAssetResults);
  return {
    enabled: true,
    global_agents_dir: globalAgentsDir,
    global_claude_dir: globalClaudeDir,
    manifest_path: codexManifestResult.path,
    claude_manifest_path: claudeManifestResult.path,
    assets: [...codexAssetResults, codexManifestResult],
    claude_assets: [...claudeAssetResults, claudeManifestResult],
    next_command: '/terrace'
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

function agentAssetStatus(cwd) {
  const assets = templateAssets();
  const expected = agentAssetExpectations();
  const counts = {
    codexSkills: 0,
    claudeSkills: 0,
    claudeCommands: 0
  };
  for (const asset of assets) {
    if (!fs.existsSync(path.resolve(cwd, asset.path))) {
      continue;
    }
    if (asset.type === 'codex-skill') counts.codexSkills += 1;
    if (asset.type === 'claude-skill') counts.claudeSkills += 1;
    if (asset.type === 'claude-command') counts.claudeCommands += 1;
  }
  const present = counts.codexSkills + counts.claudeSkills + counts.claudeCommands;
  const expectedTotal = expected.codexSkills + expected.claudeSkills + expected.claudeCommands;
  const complete = counts.codexSkills === expected.codexSkills
    && counts.claudeSkills === expected.claudeSkills
    && counts.claudeCommands === expected.claudeCommands;
  return {
    expected,
    counts,
    present,
    expected_total: expectedTotal,
    complete,
    partial: present > 0 && !complete,
    next_command: present > 0 && !complete ? 'terrace init' : null,
    remediation: present > 0 && !complete
      ? 'Run `terrace init`; Terrace writes missing generated agent assets and does not overwrite user-owned files.'
      : null
  };
}

module.exports = {
  agentAssetStatus,
  agentAssetExpectations,
  installGlobalAgentBootstrap,
  installAgentBootstrap,
  globalClaudeTemplateAssets,
  globalTemplateAssets,
  templateAssets
};
