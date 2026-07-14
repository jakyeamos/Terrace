'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { guidanceError } = require('./guidance.cjs');
const {
  ensureProjectDirectory,
  readManagedText,
  readProjectText,
  resolveProjectArtifact,
  withManagedArtifactLock,
  withPinnedDirectory,
  writeManagedText,
  writeProjectText,
  writeProjectTextIfMissing
} = require('./managed-artifacts.cjs');

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
  ['terrace-init', 'terrace init', '', 'Initialize or safely repair Terrace state and non-overwriting agent bootstrap assets.'],
  ['terrace-agents-repair', 'terrace agents repair', '', 'Repair missing repo-local Terrace agent assets without changing workflow state.'],
  ['terrace-agents-install-global', 'terrace agents install-global', '', 'Install non-overwriting global Codex and Claude Code Terrace assets.'],
  ['terrace-new-project', 'terrace new-project $ARGUMENTS', '<name> --prd <file>|--paste-prd', 'Initialize Terrace from a source PRD and write project artifacts.'],
  ['terrace-prd-import', 'terrace prd import $ARGUMENTS', '<feature> --file <file>|--paste', 'Import a feature PRD into an existing Terrace project.'],
  ['terrace-doctor', 'terrace doctor', '', 'Check Terrace installation health.'],
  ['terrace-spec-validate', 'terrace spec validate', '', 'Validate Terrace governance artifacts.'],
  ['terrace-spec-hash', 'terrace spec hash --file $ARGUMENTS', '<path>', 'Compute a stable spec hash for a file.'],
  ['terrace-audit', 'terrace audit', '', 'Check artifacts and protected baselines.'],
  ['terrace-ci-check', 'terrace ci check $ARGUMENTS', '[files...]', 'Run audit plus protected-change enforcement.'],
  ['terrace-security-check', 'terrace security check', '', 'Run deterministic local security checks.'],
  ['terrace-port-gsd-dry-run', 'terrace port gsd --dry-run', '', 'Inventory legacy GSD artifacts without writing Terrace state.'],
  ['terrace-port-gsd-import-roadmap', 'terrace port gsd --import-roadmap', '', 'Merge missing legacy roadmap phases into existing Terrace state without overwriting phases.'],
  ['terrace-port-gsd', 'terrace port gsd', '', 'Migrate supported legacy GSD artifacts into Terrace state.'],
  ['terrace-planning-refresh', 'terrace planning refresh', '', 'Initialize or refresh the repo-local .planning package from Terrace state.'],
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
  ['terrace-adoption-status', 'terrace adoption status', '', 'Report GSD replacement readiness and remaining adoption gaps.'],
  ['terrace-ship-check', 'terrace ship check', '', 'Run read-only release readiness checks.'],
  ['terrace-ship-prepare', 'terrace ship prepare', '', 'Write a release-readiness summary artifact.'],
  ['terrace-release-preflight', 'terrace release-preflight $ARGUMENTS', '[--target-version <version>] [--static]', 'Run Terrace 0.2.0 release preflight and summarize trusted publishing, tag/version alignment, and stale release instructions.'],
  ['terrace-report', 'terrace report $ARGUMENTS', '[update|open|history|ceremony]', 'Read or update the Terrace report card and report history.'],
  ['terrace-handoff-create', 'terrace handoff create $ARGUMENTS', '[--feature <id>] [--for codex|claude|generic]', 'Create a Terrace handoff pack for another agent or session.'],
  ['terrace-debt', 'terrace debt $ARGUMENTS', 'add|list|audit|resolve', 'Manage production debt entries and release debt gates.'],
  ['terrace-preflight', 'terrace preflight $ARGUMENTS', '<feature>', 'Write production failure preflight evidence for a feature.'],
  ['terrace-docu', 'terrace docu $ARGUMENTS', '<feature>', 'Write production documentation and runbook draft evidence.'],
  ['terrace-test-eval', 'terrace test eval $ARGUMENTS', '[--feature <id>] [--changed]', 'Evaluate test-suite trust and record evidence.'],
  ['terrace-review-ai', 'terrace review ai $ARGUMENTS', '--mode <mode>', 'Run an AI release review evidence pass.'],
  ['terrace-rule-add', 'terrace rule add $ARGUMENTS', '<domain> <rule-id>', 'Add a Terrace rule to the project rule pack.'],
  ['terrace-rule-audit', 'terrace rule audit $ARGUMENTS', '[--effectiveness]', 'Audit installed Terrace rules and rule evidence.'],
  ['terrace-waive', 'terrace waive $ARGUMENTS', '<gate> [--reason <text>] [--owner <name>] [--expires <date>]', 'Record a reviewed temporary gate waiver.'],
  ['terrace-backfill', 'terrace backfill $ARGUMENTS', '[--rule <id>] [--since <ref>] [--feature <id>]', 'Write standards backfill evidence.'],
  ['terrace-workstreams-plan', 'terrace workstreams plan $ARGUMENTS', '<feature>', 'Plan feature workstreams for production delivery.'],
  ['terrace-workbench-status', 'terrace workbench status $ARGUMENTS', '[--feature <id>]', 'Read production workbench readiness for a feature.'],
  ['terrace-workbench-prepare', 'terrace workbench prepare $ARGUMENTS', '<feature> [--tier small|medium|large] [--for codex|claude|generic]', 'Prepare production workbench evidence and optional handoff artifacts.'],
  ['terrace-design-source-import', 'terrace design-source import $ARGUMENTS', '<source> <feature> <ref>', 'Import design-source context for a feature.'],
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
  if (name === 'terrace-adoption-status') {
    return {
      name,
      description: 'Answer whether Terrace can replace GSD yet, with readiness evidence and next commands.',
      argumentHint,
      body: [
        '# Terrace Adoption Status',
        '',
        'Run `terrace adoption status`.',
        '',
        'Use the answer to the `Can Terrace replace GSD for me yet?` question as the adoption verdict. Inspect `recommended_mode`, `readiness_summary`, `evidence`, `blockers`, `next_steps`, and `next_commands` before recommending GSD retirement.',
        '',
        'If `recommended_mode` is `replace_gsd`, Terrace can be treated as the default workflow entrypoint. If it is `pilot_with_gsd_fallback`, use Terrace for active work but keep GSD fallback paths until the listed blockers are resolved. If it is `keep_gsd`, do not claim Terrace is ready to replace GSD.',
        '',
        'Run or report the concrete commands from `next_commands` rather than giving generic adoption advice. Do not bypass Terrace gates or claim success when the command reports blockers.'
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

function agentAssetPathError(relativePath, reason) {
  throw guidanceError('Refusing to use unsafe Terrace agent asset ' + relativePath + '.', {
    code: 'AGENT_ASSET_PATH_UNSAFE',
    file: relativePath,
    why_blocked: reason,
    next_command: 'Replace the symlink or unexpected filesystem object, then rerun the Terrace agent command.',
    remediation: 'Terrace agent assets must stay inside the target repository and use ordinary files and directories.'
  });
}

function mapProjectArtifactError(relativePath, error) {
  if (error && error.details && error.details.code === 'MANAGED_ARTIFACT_PATH_UNSAFE') {
    agentAssetPathError(relativePath, error.details.why_blocked || 'The generated agent asset path is unsafe.');
  }
  throw error;
}

function resolveRepoAsset(cwd, relativePath, options) {
  try {
    return resolveProjectArtifact(cwd, relativePath, options);
  } catch (error) {
    return mapProjectArtifactError(relativePath, error);
  }
}

function readRepoAssetText(cwd, relativePath) {
  try {
    return readProjectText(cwd, relativePath);
  } catch (error) {
    return mapProjectArtifactError(relativePath, error);
  }
}

function existingRepoAssetResult(cwd, asset) {
  const resolved = resolveRepoAsset(cwd, asset.path, { allowExistingLeafSymlink: true });
  if (!resolved.fileStat) {
    return null;
  }
  if (resolved.fileStat.isSymbolicLink()) {
    return { path: asset.path, type: asset.type, status: 'skipped' };
  }
  const existing = readRepoAssetText(cwd, asset.path);
  return {
    path: asset.path,
    type: asset.type,
    status: existing === asset.content ? 'unchanged' : 'skipped'
  };
}

function writeMissingRepoAsset(cwd, asset) {
  try {
    const existing = existingRepoAssetResult(cwd, asset);
    if (existing) {
      return existing;
    }
    const written = writeProjectTextIfMissing(cwd, asset.path, asset.content, { allowExistingLeafSymlink: true });
    if (written) {
      return { path: asset.path, type: asset.type, status: 'written' };
    }
    return existingRepoAssetResult(cwd, asset) || { path: asset.path, type: asset.type, status: 'skipped' };
  } catch (error) {
    return mapProjectArtifactError(asset.path, error);
  }
}

function preflightAgentBootstrap(cwd) {
  for (const asset of templateAssets()) {
    resolveRepoAsset(cwd, asset.path, { allowExistingLeafSymlink: true });
  }
  readManagedText(cwd, 'agents/manifest.json');
}

function writeAsset(cwd, asset) {
  return writeMissingRepoAsset(cwd, asset);
}

function writeManifest(cwd, assetResults) {
  const relPath = '.terrace/agents/manifest.json';
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: 'terrace init',
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  const existing = readManagedText(cwd, 'agents/manifest.json');
  const shouldRefresh = existing === null || assetResults.some((asset) => asset.status === 'written');
  if (!shouldRefresh) {
    return { path: relPath, type: 'manifest', status: 'unchanged' };
  }
  const status = existing === content ? 'unchanged' : 'written';
  if (status === 'unchanged') {
    return { path: relPath, type: 'manifest', status };
  }
  writeManagedText(cwd, 'agents/manifest.json', content);
  return { path: relPath, type: 'manifest', status };
}

function installAgentBootstrap(cwd) {
  preflightAgentBootstrap(cwd);
  return withManagedArtifactLock(cwd, () => {
    const assetResults = templateAssets().map((asset) => writeAsset(cwd, asset));
    const manifestResult = writeManifest(cwd, assetResults);
    return {
      enabled: true,
      manifest_path: manifestResult.path,
      assets: [...assetResults, manifestResult]
    };
  });
}

function defaultGlobalAgentsDir() {
  return process.env.TERRACE_GLOBAL_AGENTS_DIR || path.join(os.homedir(), '.agents');
}

function defaultGlobalClaudeDir() {
  return process.env.TERRACE_GLOBAL_CLAUDE_DIR || path.join(os.homedir(), '.claude');
}

function lstatIfExists(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isSystemDirectoryAlias(directory) {
  if (!['/tmp', '/var'].includes(directory)) {
    return false;
  }
  try {
    return fs.realpathSync(directory) === path.join('/private', directory);
  } catch {
    return false;
  }
}

function assertGlobalRootAncestors(rootDir) {
  const requestedRoot = path.resolve(rootDir);
  const parsed = path.parse(requestedRoot);
  let current = parsed.root;
  const parts = requestedRoot.slice(parsed.root.length).split(path.sep).filter(Boolean);

  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatIfExists(current);
    } catch (error) {
      globalAssetPathError(requestedRoot, '.', 'Terrace could not inspect a parent of the configured global asset root.');
    }
    if (!stat) {
      return;
    }
    if (stat.isSymbolicLink() && !isSystemDirectoryAlias(current)) {
      globalAssetPathError(requestedRoot, '.', 'The configured global asset root and its parents must be real directories, never symlinks.');
    }
    if (!stat.isSymbolicLink() && !stat.isDirectory()) {
      globalAssetPathError(requestedRoot, '.', 'Every existing parent of the configured global asset root must be a directory.');
    }
  }
}

function sameGlobalDirectory(stat, identity) {
  return Boolean(stat && identity && !stat.isSymbolicLink() && stat.isDirectory() && stat.dev === identity.dev && stat.ino === identity.ino);
}

function globalAssetPathError(rootDir, relativePath, reason) {
  throw guidanceError('Refusing to use unsafe Terrace global agent asset ' + relativePath + '.', {
    code: 'GLOBAL_AGENT_ASSET_PATH_UNSAFE',
    file: path.join(rootDir, relativePath),
    why_blocked: reason,
    next_command: 'Replace the symlink or unexpected filesystem object, then rerun terrace agents install-global.',
    remediation: 'Global Terrace agent assets must stay inside their configured root and use ordinary files and directories.'
  });
}

function mapGlobalAssetError(rootDir, relativePath, error) {
  if (error && error.details && error.details.code === 'MANAGED_ARTIFACT_PATH_UNSAFE') {
    globalAssetPathError(rootDir, relativePath, error.details.why_blocked || 'The global asset path is unsafe.');
  }
  throw error;
}

function ensureGlobalRoot(rootDir) {
  const requestedRoot = path.resolve(rootDir);
  assertGlobalRootAncestors(requestedRoot);
  let current = requestedRoot;
  const missing = [];
  let stat = lstatIfExists(current);
  while (!stat) {
    const parent = path.dirname(current);
    if (parent === current) {
      globalAssetPathError(requestedRoot, '.', 'Terrace could not find a real parent directory for the configured global asset root.');
    }
    missing.unshift(path.basename(current));
    current = parent;
    stat = lstatIfExists(current);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    globalAssetPathError(requestedRoot, '.', 'The configured global asset root and its created parents must be real directories, never links or special filesystem objects.');
  }

  let root = current;
  if (missing.length > 0) {
    try {
      root = ensureProjectDirectory(current, missing.join(path.sep)).directory;
    } catch (error) {
      return mapGlobalAssetError(requestedRoot, '.', error);
    }
  }
  const rootStat = lstatIfExists(root);
  if (!rootStat || rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    globalAssetPathError(requestedRoot, '.', 'The configured global asset root must be a real directory.');
  }
  assertGlobalRootAncestors(requestedRoot);
  return root;
}

function assertGlobalRootStable(rootDir, identity) {
  assertGlobalRootAncestors(rootDir);
  if (!sameGlobalDirectory(lstatIfExists(rootDir), identity)) {
    globalAssetPathError(rootDir, '.', 'The configured global asset root changed while Terrace was installing generated assets.');
  }
}

function resolveGlobalAsset(rootDir, relativePath, options) {
  try {
    return resolveProjectArtifact(rootDir, relativePath, options);
  } catch (error) {
    return mapGlobalAssetError(rootDir, relativePath, error);
  }
}

function readGlobalAssetText(rootDir, relativePath) {
  try {
    return readProjectText(rootDir, relativePath);
  } catch (error) {
    return mapGlobalAssetError(rootDir, relativePath, error);
  }
}

function existingGlobalAssetResult(rootDir, asset) {
  const resolved = resolveGlobalAsset(rootDir, asset.path, { allowExistingLeafSymlink: true });
  if (!resolved.fileStat) {
    return null;
  }
  if (resolved.fileStat.isSymbolicLink()) {
    return { path: asset.path, type: asset.type, status: 'skipped' };
  }
  const existing = readGlobalAssetText(rootDir, asset.path);
  return {
    path: asset.path,
    type: asset.type,
    status: existing === asset.content ? 'unchanged' : 'skipped'
  };
}

function writeGlobalAsset(rootDir, asset) {
  const root = ensureGlobalRoot(rootDir);
  const operationRoot = rootDir === '.' ? '.' : root;
  try {
    const existing = existingGlobalAssetResult(operationRoot, asset);
    if (existing) {
      return existing;
    }
    const written = writeProjectTextIfMissing(operationRoot, asset.path, asset.content, { allowExistingLeafSymlink: true, lock: false });
    if (written) {
      return { path: asset.path, type: asset.type, status: 'written' };
    }
    return existingGlobalAssetResult(operationRoot, asset) || { path: asset.path, type: asset.type, status: 'skipped' };
  } catch (error) {
    return mapGlobalAssetError(root, asset.path, error);
  }
}

function writeGlobalManifest(rootDir, relPath, generatedBy, assetResults) {
  const root = ensureGlobalRoot(rootDir);
  const operationRoot = rootDir === '.' ? '.' : root;
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: generatedBy,
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  const resolved = resolveGlobalAsset(operationRoot, relPath, { allowExistingLeafSymlink: true });
  if (resolved.fileStat && resolved.fileStat.isSymbolicLink()) {
    return { path: relPath, type: 'global-manifest', status: 'skipped' };
  }
  const existing = resolved.fileStat ? readGlobalAssetText(operationRoot, relPath) : null;
  const status = existing === content ? 'unchanged' : 'written';
  if (status === 'written') {
    try {
      writeProjectText(operationRoot, relPath, content, { lock: false });
    } catch (error) {
      return mapGlobalAssetError(root, relPath, error);
    }
  }
  return { path: relPath, type: 'global-manifest', status };
}

function withGlobalRoot(rootDir, action) {
  const configuredRoot = path.resolve(rootDir);
  const root = ensureGlobalRoot(configuredRoot);
  const stat = lstatIfExists(root);
  const identity = { dev: stat.dev, ino: stat.ino };
  assertGlobalRootStable(configuredRoot, identity);
  const value = withPinnedDirectory(root, identity, (reason) => {
    globalAssetPathError(root, '.', reason);
  }, () => {
    assertGlobalRootStable(configuredRoot, identity);
    const result = action('.');
    assertGlobalRootStable(configuredRoot, identity);
    return result;
  });
  assertGlobalRootStable(configuredRoot, identity);
  return { root: configuredRoot, value };
}

function installGlobalAgentBootstrap(options) {
  const opts = options || {};
  const codex = withGlobalRoot(opts.globalAgentsDir || defaultGlobalAgentsDir(), (root) => {
    const assets = globalTemplateAssets().map((asset) => writeGlobalAsset(root, asset));
    const manifest = writeGlobalManifest(root, 'terrace/manifest.json', 'terrace agents install-global', assets);
    return { assets, manifest };
  });
  const claude = withGlobalRoot(opts.globalClaudeDir || defaultGlobalClaudeDir(), (root) => {
    const assets = globalClaudeTemplateAssets().map((asset) => writeGlobalAsset(root, asset));
    const manifest = writeGlobalManifest(root, 'terrace/manifest.json', 'terrace agents install-global', assets);
    return { assets, manifest };
  });
  return {
    enabled: true,
    global_agents_dir: codex.root,
    global_claude_dir: claude.root,
    manifest_path: codex.value.manifest.path,
    claude_manifest_path: claude.value.manifest.path,
    assets: [...codex.value.assets, codex.value.manifest],
    claude_assets: [...claude.value.assets, claude.value.manifest],
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
    next_command: present > 0 && !complete ? 'terrace agents repair' : null,
    remediation: present > 0 && !complete
      ? 'Run `terrace agents repair`; it writes missing generated agent assets without changing workflow state or overwriting user-owned files.'
      : null
  };
}

module.exports = {
  agentAssetStatus,
  agentAssetExpectations,
  installGlobalAgentBootstrap,
  installAgentBootstrap,
  preflightAgentBootstrap,
  globalClaudeTemplateAssets,
  globalTemplateAssets,
  templateAssets
};
