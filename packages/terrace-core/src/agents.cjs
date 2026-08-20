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
const { listAgentCommands } = require('./command-catalog.cjs');

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
  '- Route natural-language workflow requests through `terrace do "<intent>"`; inspect the returned plan, then run its returned `apply.argv` only to authorize a write-capable route.',
  '- Use `terrace quick plan`, `terrace quick execute`, and `terrace quick complete` for small scoped work.',
  '- Use `terrace phase plan`, `terrace phase execute`, `terrace phase validate`, `terrace phase review`, and `terrace phase complete` for roadmap phase work.',
  '- Use `terrace phase execute <id> --parallel` only when every plan has explicit owned files and dependencies; inspect, merge, and clean up through `terrace parallel`.',
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
  '- Route natural-language requests through `terrace do "<intent>"` when a stable Terrace command is not obvious; inspect its plan before running its returned `apply.argv` for a write-capable route.',
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

const TERRACE_COMMANDS = listAgentCommands();

function titleFromName(name) {
  return name.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function workflowFromCommand(entry) {
  const { name, command, argumentHint, description } = entry;
  if (name === 'terrace-do') {
    return {
      name,
      description,
      argumentHint,
      body: [
        '# Terrace Do',
        '',
        'Run `terrace do "$ARGUMENTS"` to resolve the intent. If it returns `requires_apply: true`, inspect the planned command, writes, and execution scope, then run the returned `apply.argv` exactly when that mutation is authorized.',
        '',
        'Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.'
      ]
    };
  }
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
  if (name === 'terrace-resume') {
    return {
      name,
      description,
      argumentHint,
      body: [
        '# Terrace Resume',
        '',
        'Run `terrace resume`.',
        '',
        'Inspect Terrace blockers, warnings, generated files, next-command output, the durable `stage_run` ledger, and its `stop_packet` before continuing. Terrace rebuilds that ledger and stop packet from `.terrace/events.jsonl` when the snapshot is stale. Follow the safe next step and never perform the packet\'s forbidden bypass or claim success when the command reports blocked, failed, or active stages.',
        '',
        'If status is `blocked`, stop at the exact reported blocker. An active workspace',
        'lock is not authority to delete the lock, retry, or invent a next command; only',
        'surface a next command when Terrace supplied one.'
      ]
    };
  }
  if (name === 'terrace-blocker-resolve') {
    return {
      name,
      description,
      argumentHint,
      body: [
        '# Terrace Blocker Resolve',
        '',
        'Run `terrace blocker list --json` and identify the exact blocker ID.',
        '',
        'Only after the named owner has completed the safe correction, run `terrace blocker resolve $ARGUMENTS --json` with both `--owner` and a durable `--evidence` reference. This command records the correction; it does not perform external work or waive the blocked gate.',
        '',
        'Then follow the returned `next_command`. Never resolve a blocker speculatively, edit Terrace state by hand, or use this command as a bypass.'
      ]
    };
  }
  if (name === 'terrace-execute-phase-complete') {
    return {
      name,
      description,
      argumentHint,
      body: [
        '# Terrace Execute Phase Complete',
        '',
        'Run `terrace execute-phase-complete $ARGUMENTS`.',
        '',
        'Inspect Terrace blockers, warnings, generated files, next-command output, the returned `stage_run` ledger, and any `stop_packet` before continuing. The plan, execute, validate, review, and complete stages are durably recorded as pending, active, passed, failed, or blocked and can resume after interruption. Follow the stop packet\'s owner and safe next step; never perform its forbidden bypass or claim success when the command reports blockers.'
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
    'Run `terrace do "$ARGUMENTS"` when arguments are provided. It returns a read-only result or a plan for a write-capable route.',
    '',
    'If the result has `requires_apply: true`, inspect the command, writes, and execution scope, then run the returned `apply.argv` exactly only when that write is authorized.',
    '',
    'If no arguments are provided, run `terrace next` to identify the next workflow action.',
    '',
    'Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.'
  ]
};

function templateAssets() {
  return [
    { path: 'AGENTS.md', type: 'codex-instructions', scope: 'consumer_bootstrap', content: AGENTS_MD },
    { path: 'CLAUDE.md', type: 'claude-instructions', scope: 'consumer_bootstrap', content: CLAUDE_MD },
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.agents/skills/' + workflow.name + '/SKILL.md',
      type: 'codex-skill',
      scope: 'repo_generated',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/skills/' + workflow.name + '/SKILL.md',
      type: 'claude-skill',
      scope: 'repo_generated',
      content: skillContent(workflow.name, workflow.description, workflow.body, workflow)
    })),
    ...TERRACE_WORKFLOWS.map((workflow) => ({
      path: '.claude/commands/' + workflow.name + '.md',
      type: 'claude-command',
      scope: 'repo_generated',
      content: commandContent(workflow.description, workflow.argumentHint, workflow.body)
    }))
  ];
}

function repoGeneratedTemplateAssets() {
  return templateAssets().filter((asset) => asset.scope === 'repo_generated');
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
      content: commandContent(TERRACE_GLOBAL_ENTRYPOINT.description, '<intent> | --apply <plan-token>', TERRACE_GLOBAL_ENTRYPOINT.body)
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
    codexInstructions: assets.filter((asset) => asset.type === 'codex-instructions').length,
    claudeInstructions: assets.filter((asset) => asset.type === 'claude-instructions').length,
    codexSkills: assets.filter((asset) => asset.type === 'codex-skill').length,
    claudeSkills: assets.filter((asset) => asset.type === 'claude-skill').length,
    claudeCommands: assets.filter((asset) => asset.type === 'claude-command').length
  };
}

function agentAssetStatus(cwd) {
  const assets = templateAssets();
  const expected = agentAssetExpectations();
  const counts = {
    codexInstructions: 0,
    claudeInstructions: 0,
    codexSkills: 0,
    claudeSkills: 0,
    claudeCommands: 0
  };
  const countKeyForType = {
    'codex-instructions': 'codexInstructions',
    'claude-instructions': 'claudeInstructions',
    'codex-skill': 'codexSkills',
    'claude-skill': 'claudeSkills',
    'claude-command': 'claudeCommands'
  };
  const outdated = [];
  for (const asset of assets) {
    const countKey = countKeyForType[asset.type];
    if (!countKey) {
      continue;
    }
    const existing = existingRepoAssetResult(cwd, asset);
    if (!existing) continue;
    counts[countKey] += 1;
    if (existing.status === 'skipped') {
      outdated.push(asset.path);
    }
  }
  const present = Object.values(counts).reduce((total, count) => total + count, 0);
  const expectedTotal = Object.values(expected).reduce((total, count) => total + count, 0);
  const missingCount = expectedTotal - present;
  const complete = counts.codexInstructions === expected.codexInstructions
    && counts.claudeInstructions === expected.claudeInstructions
    && counts.codexSkills === expected.codexSkills
    && counts.claudeSkills === expected.claudeSkills
    && counts.claudeCommands === expected.claudeCommands
    && outdated.length === 0;
  const hasMissing = missingCount > 0;
  return {
    expected,
    counts,
    present,
    expected_total: expectedTotal,
    missing_count: missingCount,
    outdated,
    outdated_count: outdated.length,
    complete,
    partial: present > 0 && !complete,
    next_command: hasMissing ? 'terrace agents repair' : null,
    remediation: outdated.length > 0
      ? 'Generated Terrace agent assets differ from the installed templates. Terrace will not overwrite user-owned files; compare each outdated path with the current template and merge the preview/apply guidance manually.'
      : hasMissing
        ? 'Run `terrace agents repair`; it writes missing generated agent assets without changing workflow state or overwriting user-owned files.'
        : null
  };
}

function repoGeneratedAssetStatus(cwd) {
  const assets = repoGeneratedTemplateAssets();
  const current = [];
  const missing = [];
  const stale = [];

  for (const asset of assets) {
    const existing = existingRepoAssetResult(cwd, asset);
    if (!existing) {
      missing.push(asset.path);
      continue;
    }
    if (existing.status === 'unchanged') {
      current.push(asset.path);
      continue;
    }
    stale.push(asset.path);
  }

  return {
    scope: 'repo_generated',
    expected_total: assets.length,
    current,
    missing,
    stale,
    current_count: current.length,
    missing_count: missing.length,
    stale_count: stale.length,
    complete: missing.length === 0 && stale.length === 0,
    remediation: missing.length === 0 && stale.length === 0
      ? null
      : 'Regenerate only the source-owned repo_generated assets through the source parity workflow; do not use consumer bootstrap repair to modify Terrace itself.'
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
  repoGeneratedAssetStatus,
  repoGeneratedTemplateAssets,
  templateAssets
};
