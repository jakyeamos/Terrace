'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { agentAssetExpectations } = require('../packages/terrace-core/src/agents.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'docs', 'terrace', 'corpus', 'config.json');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'terrace', 'corpus');
const DEFAULT_TIMEOUT_MS = 90_000;
const OUTPUT_CAPTURE_LIMIT = 20_000;
const PROJECT_PRD = [
  '# Terrace Corpus Project PRD',
  '',
  '## Users',
  '- Developers use this repository to ship changes with AI assistance.',
  '',
  '## Desired Outcomes',
  '- Terrace can infer useful next steps from the repository shape.',
  '- The workflow preserves ambiguity instead of inventing certainty.',
  '',
  '## Constraints',
  '- Existing source behavior must remain unchanged.',
  '- Generated artifacts must be specific enough for a human review.',
  '',
  '## Open Questions',
  '- Which release path has the highest operational risk?',
  '- Which test layer should own the first regression?',
  '',
  '## Risks',
  '- Existing planning artifacts may be incomplete or stale.',
  '- Some repositories may not have executable project scripts.'
].join('\n');

const FEATURE_PRD = [
  '# Terrace Corpus Smoke Feature',
  '',
  '## Users',
  '- Maintainers need a safe smoke workflow for evaluating Terrace.',
  '',
  '## Success Metrics',
  '- The command output names concrete next actions and blockers.',
  '- Generated artifacts reference available project files or scripts when possible.',
  '',
  '## Risks',
  '- The feature intent is intentionally underspecified to test interrogation.',
  '- Some repositories may be docs-only or lack package metadata.',
  '',
  '## Open Questions',
  '- What is the smallest valuable implementation slice?',
  '- What production signal would prove the feature worked?'
].join('\n');

function usage() {
  return [
    'Usage: npm run corpus:evaluate -- [--sample|--all-shadow] [--track migrated-gsd|scratch-real|scratch-synthetic|all] [--dry-run-plan] [--keep-worktrees]',
    '',
    'Options:',
    '  --sample              Run configured sample repositories and synthetic fixtures.',
    '  --all-shadow          Run all repositories listed in the shadow branch corpus.',
    '  --track <track>       Limit to one track. Defaults to all.',
    '  --dry-run-plan        Print planned worktrees and commands without creating them.',
    '  --keep-worktrees      Leave disposable worktrees in place after the run.',
    '  --timeout-ms <n>      Per-command timeout. Defaults to ' + DEFAULT_TIMEOUT_MS + '.'
  ].join('\n');
}

function parseArgs(argv) {
  const opts = {
    sample: argv.includes('--sample') || !argv.includes('--all-shadow'),
    allShadow: argv.includes('--all-shadow'),
    track: valueAfter(argv, '--track') || 'all',
    dryRunPlan: argv.includes('--dry-run-plan'),
    keepWorktrees: argv.includes('--keep-worktrees'),
    timeoutMs: Number(valueAfter(argv, '--timeout-ms') || DEFAULT_TIMEOUT_MS)
  };
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(usage() + '\n');
    process.exit(0);
  }
  const allowedTracks = new Set(['migrated-gsd', 'scratch-real', 'scratch-synthetic', 'all']);
  if (!allowedTracks.has(opts.track)) {
    throw new Error('Unknown track: ' + opts.track);
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 1000) {
    throw new Error('Invalid --timeout-ms value.');
  }
  return opts;
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] || null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'repo';
}

function runProcess(command, args, options) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    maxBuffer: 50 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_cache: options.npmCache || path.join(os.tmpdir(), 'terrace-corpus-npm-cache')
    },
    shell: process.platform === 'win32'
  });
  return {
    command: [command, ...args].join(' '),
    cwd: options.cwd,
    exitCode: typeof result.status === 'number' ? result.status : 1,
    signal: result.signal || null,
    stdout: result.stdout || '',
    stderr: result.stderr || (result.error ? String(result.error.message || result.error) : ''),
    durationMs: Date.now() - started,
    timedOut: result.error && result.error.code === 'ETIMEDOUT'
  };
}

function safeExec(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
}

function packageTerrace(runRoot) {
  const packageDir = path.join(runRoot, 'package');
  const cacheDir = path.join(runRoot, 'npm-cache');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const before = new Set(fs.readdirSync(packageDir));
  const packed = runProcess('npm', ['pack', '--pack-destination', packageDir, '--cache', cacheDir], {
    cwd: REPO_ROOT,
    timeoutMs: 120_000,
    npmCache: cacheDir
  });
  if (packed.exitCode !== 0) {
    throw new Error('npm pack failed:\n' + packed.stderr + '\n' + packed.stdout);
  }
  const tgz = fs.readdirSync(packageDir).find((name) => name.endsWith('.tgz') && !before.has(name)) ||
    fs.readdirSync(packageDir).find((name) => name.endsWith('.tgz'));
  if (!tgz) {
    throw new Error('npm pack did not produce a tarball.');
  }
  return path.join(packageDir, tgz);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('Missing corpus config: ' + CONFIG_PATH);
  }
  return readJson(CONFIG_PATH);
}

function selectedRealRepos(config, opts) {
  const repos = opts.allShadow ? config.realRepos : config.realRepos.filter((repo) => repo.sample);
  return repos.filter((repo) => fs.existsSync(repo.path));
}

function selectedSyntheticRepos(config) {
  return config.syntheticRepos;
}

function tracksForRepo(opts) {
  if (opts.track !== 'all') {
    return [opts.track];
  }
  return ['migrated-gsd', 'scratch-real'];
}

function commandPlanForTrack(track, repo) {
  const feature = 'terrace-corpus-smoke';
  const project = 'terrace-corpus-' + slugify(repo.name || repo.id);
  const commands = [
    { key: 'help', category: 'baseline', args: ['--help'], json: false },
    { key: 'version', category: 'baseline', args: ['--version'], json: false }
  ];
  if (track === 'migrated-gsd') {
    commands.push(
      { key: 'doctor-before-port', category: 'baseline', args: ['doctor', '--json'] },
      { key: 'port-gsd-dry-run', category: 'migration', args: ['port', 'gsd', '--dry-run', '--json'] },
      { key: 'port-gsd-compare', category: 'migration', args: ['port', 'gsd', '--compare', '--json'] },
      { key: 'port-gsd-verify-parity', category: 'migration', args: ['port', 'gsd', '--verify-parity', '--json'] },
      { key: 'port-gsd', category: 'migration', args: ['port', 'gsd', '--json'] }
    );
  } else {
    commands.push(
      { key: 'init', category: 'baseline', args: ['init', '--json'] },
      { key: 'new-project', category: 'scratch-intake', args: ['new-project', project, '--prd', 'docs/input/CORPUS-PRD.md', '--json'] },
      { key: 'interrogate-project', category: 'interrogation', args: ['interrogate', project, '--tier', 'large', '--answers', 'Corpus user answer: preserve the imported PRD outcome, challenge rollout risk, and require rollback ownership.', '--json'] },
      { key: 'prd-import', category: 'scratch-intake', args: ['prd', 'import', feature, '--file', 'docs/input/CORPUS-FEATURE-PRD.md', '--json'] },
      { key: 'prd-import-overwrite-refusal', category: 'scratch-intake', args: ['prd', 'import', feature, '--file', 'docs/input/CORPUS-FEATURE-PRD.md', '--json'], expectedFailure: true }
    );
  }
  commands.push(
    { key: 'doctor', category: 'baseline', args: ['doctor', '--json'] },
    { key: 'audit', category: 'baseline', args: ['audit', '--json'] },
    { key: 'spec-validate', category: 'baseline', args: ['spec', 'validate', '--json'], expectedFailure: true },
    { key: 'commands-discover', category: 'baseline', args: ['commands', 'discover', '--json'] },
    { key: 'next', category: 'workflow', args: ['next', '--json'] },
    { key: 'resume', category: 'workflow', args: ['resume', '--json'], expectedFailure: true },
    { key: 'history', category: 'workflow', args: ['history', '--json'] },
    { key: 'settings-effort', category: 'workflow', args: ['settings', 'effort', 'standard', '--json'] },
    { key: 'settings-show', category: 'workflow', args: ['settings', 'show', '--json'] },
    { key: 'phase-list', category: 'roadmap', args: ['phase', 'list', '--json'] },
    { key: 'backlog-list', category: 'backlog', args: ['backlog', 'list', '--json'] },
    { key: 'backlog-add', category: 'backlog', args: ['backlog', 'add', 'Terrace corpus follow-up', '--json'] },
    { key: 'quick-list', category: 'quick-task', args: ['quick', 'list', '--json'] },
    { key: 'quick-plan', category: 'quick-task', args: ['quick', 'plan', 'Terrace corpus smoke task', '--json'] },
    { key: 'align', category: 'senior-cycle', args: ['align', feature, '--tier', 'large', '--json'] },
    { key: 'interrogate', category: 'interrogation', args: ['interrogate', feature, '--tier', 'large', '--answers', 'Corpus user answer: protect the feature workflow, test malformed input and permission failures, and roll back on data loss or auth regression.', '--json'] },
    { key: 'interrogate-risk', category: 'interrogation', args: ['interrogate', 'risk', feature, '--tier', 'large', '--answers', 'Corpus user answer: risk owner must approve auth, billing, migration, and server changes before release.', '--json'] },
    { key: 'map-codebase', category: 'senior-cycle', args: ['map-codebase', '--json'] },
    { key: 'design', category: 'senior-cycle', args: ['design', feature, '--tier', 'large', '--json'] },
    { key: 'test-plan', category: 'senior-cycle', args: ['test-plan', feature, '--tier', 'large', '--json'] },
    { key: 'observe', category: 'senior-cycle', args: ['observe', feature, '--tier', 'large', '--json'] },
    { key: 'validate-prod', category: 'senior-cycle', args: ['validate-prod', feature, '--tier', 'large', '--json'] },
    { key: 'cleanup', category: 'senior-cycle', args: ['cleanup', feature, '--tier', 'large', '--json'] },
    { key: 'ui-import-stitch', category: 'ui', args: ['ui', 'import-stitch', feature, '--json'], uiOnly: true },
    { key: 'ui-plan-refresh', category: 'ui', args: ['ui', 'plan-refresh', feature, '--json'], uiOnly: true },
    { key: 'ui-diff', category: 'ui', args: ['ui', 'diff', feature, '--json'], uiOnly: true },
    { key: 'do-plan-next', category: 'workflow', args: ['do', 'plan the next phase', '--json'] },
    { key: 'do-quick', category: 'workflow', args: ['do', 'create quick task fix smoke issue', '--json'] },
    { key: 'do-ship-check', category: 'workflow', args: ['do', 'ship check', '--json'], expectedFailure: true },
    { key: 'security-check', category: 'shipping-security', args: ['security', 'check', '--json'], expectedFailure: true },
    { key: 'report-ceremony', category: 'shipping-security', args: ['report', 'ceremony', '--json'], expectedFailure: true },
    { key: 'ship-check-fast', category: 'shipping-security', args: ['ship', 'check', '--fast', '--json'], expectedFailure: true },
    { key: 'ship-check', category: 'shipping-security', args: ['ship', 'check', '--json'], expectedFailure: true },
    { key: 'ship-prepare', category: 'shipping-security', args: ['ship', 'prepare', '--json'], expectedFailure: true }
  );
  if (track === 'migrated-gsd') {
    commands.push(
      { key: 'phase-show-dynamic', category: 'roadmap', args: ['phase', 'show', '<phase-id>', '--json'], needsPhase: true },
      { key: 'phase-plan-dynamic', category: 'roadmap', args: ['phase', 'plan', '<phase-id>', '--json'], needsPhase: true },
      { key: 'phase-execute-dynamic', category: 'roadmap', args: ['phase', 'execute', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'phase-validate-dynamic', category: 'roadmap', args: ['phase', 'validate', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'phase-review-dynamic', category: 'roadmap', args: ['phase', 'review', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'phase-complete-dynamic', category: 'roadmap', args: ['phase', 'complete', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'alias-plan-phase-dynamic', category: 'roadmap', args: ['plan-phase', '<phase-id>', '--json'], needsPhase: true },
      { key: 'alias-execute-phase-dynamic', category: 'roadmap', args: ['execute-phase', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'execute-phase-complete-dynamic', category: 'roadmap', args: ['execute-phase-complete', '<phase-id>', '--json'], needsPhase: true, expectedFailure: true },
      { key: 'do-phase-complete-dynamic', category: 'workflow', args: ['do', 'run phase <phase-id> end to end', '--json'], needsPhase: true, expectedFailure: true }
    );
  }
  return commands.filter((command) => !command.uiOnly || repo.ui);
}

function dryRunPlan(config, opts) {
  const rows = [];
  for (const repo of selectedRealRepos(config, opts)) {
    for (const track of tracksForRepo(opts)) {
      rows.push({
        repo: repo.name,
        type: repo.type,
        track,
        source: repo.path,
        worktree: '<temp>/real/' + slugify(repo.name) + '-' + track,
        commands: commandPlanForTrack(track, repo).map((item) => item.args.join(' '))
      });
    }
  }
  if (opts.track === 'all' || opts.track === 'scratch-synthetic') {
    for (const repo of selectedSyntheticRepos(config)) {
      rows.push({
        repo: repo.name,
        type: repo.type,
        track: 'scratch-synthetic',
        source: 'synthetic',
        worktree: '<temp>/synthetic/' + slugify(repo.name),
        commands: commandPlanForTrack('scratch-synthetic', repo).map((item) => item.args.join(' '))
      });
    }
  }
  return rows;
}

function prepareRealWorktree(repo, track, runRoot) {
  const worktree = path.join(runRoot, 'worktrees', 'real', slugify(repo.name) + '-' + track);
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  const branch = repo.branch || 'codex/terrace-shadow-test';
  const branchExists = runProcess('git', ['-C', repo.path, 'rev-parse', '--verify', branch], {
    cwd: REPO_ROOT,
    timeoutMs: 30_000
  }).exitCode === 0;
  const sourceRef = branchExists ? branch : 'HEAD';
  const result = runProcess('git', ['-C', repo.path, 'worktree', 'add', '--detach', worktree, sourceRef], {
    cwd: REPO_ROOT,
    timeoutMs: 120_000
  });
  if (result.exitCode !== 0) {
    throw new Error('Failed to create worktree for ' + repo.name + ': ' + result.stderr);
  }
  if (track === 'scratch-real') {
    fs.rmSync(path.join(worktree, '.planning'), { recursive: true, force: true });
  }
  writeCorpusInputs(worktree);
  return worktree;
}

function prepareSyntheticWorktree(repo, runRoot) {
  const worktree = path.join(runRoot, 'worktrees', 'synthetic', slugify(repo.name));
  fs.mkdirSync(worktree, { recursive: true });
  if (repo.template === 'node-package') {
    writeFile(worktree, 'package.json', JSON.stringify({
      name: 'terrace-corpus-node-package',
      version: '0.0.0',
      type: 'commonjs',
      scripts: {
        lint: 'node -c index.cjs',
        typecheck: 'node -e "process.exit(0)"',
        test: 'node test.cjs'
      }
    }, null, 2) + '\n');
    writeFile(worktree, 'index.cjs', "module.exports = function hello() { return 'hello'; };\n");
    writeFile(worktree, 'test.cjs', "const hello = require('./index.cjs'); if (hello() !== 'hello') process.exit(1);\n");
  } else if (repo.template === 'node-app-no-scripts') {
    writeFile(worktree, 'package.json', JSON.stringify({
      name: 'terrace-corpus-node-app',
      version: '0.0.0',
      private: true
    }, null, 2) + '\n');
    writeFile(worktree, 'src/app.js', "console.log('terrace corpus app');\n");
  } else if (repo.template === 'python') {
    writeFile(worktree, 'pyproject.toml', '[project]\nname = "terrace-corpus-python"\nversion = "0.0.0"\n');
    writeFile(worktree, 'src/terrace_corpus/__init__.py', '__version__ = "0.0.0"\n');
  } else if (repo.template === 'docs') {
    writeFile(worktree, 'README.md', '# Terrace Corpus Docs\n\nThis repository contains documentation only.\n');
    writeFile(worktree, 'docs/guide.md', '# Guide\n\nA docs-only fixture.\n');
  } else if (repo.template === 'empty') {
    writeFile(worktree, 'README.md', '# Empty Terrace Corpus Repo\n');
  } else {
    throw new Error('Unknown synthetic template: ' + repo.template);
  }
  runProcess('git', ['init'], { cwd: worktree, timeoutMs: 30_000 });
  runProcess('git', ['add', '.'], { cwd: worktree, timeoutMs: 30_000 });
  runProcess('git', ['commit', '-m', 'Initial synthetic fixture'], { cwd: worktree, timeoutMs: 30_000 });
  writeCorpusInputs(worktree);
  return worktree;
}

function writeFile(root, relPath, content) {
  const target = path.join(root, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function writeCorpusInputs(worktree) {
  writeFile(worktree, 'docs/input/CORPUS-PRD.md', PROJECT_PRD + '\n');
  writeFile(worktree, 'docs/input/CORPUS-FEATURE-PRD.md', FEATURE_PRD + '\n');
}

function installTerrace(worktree, tarball, runRoot, timeoutMs) {
  const prefix = path.join(worktree, '.terrace-corpus', 'tools');
  fs.mkdirSync(prefix, { recursive: true });
  const cache = path.join(runRoot, 'npm-cache');
  const result = runProcess('npm', ['install', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: worktree,
    timeoutMs: Math.max(timeoutMs, 120_000),
    npmCache: cache
  });
  if (result.exitCode !== 0) {
    throw new Error('Failed to install Terrace package in ' + worktree + ':\n' + result.stderr + '\n' + result.stdout);
  }
  const bin = process.platform === 'win32'
    ? path.join(prefix, 'node_modules', '.bin', 'terrace.cmd')
    : path.join(prefix, 'node_modules', '.bin', 'terrace');
  if (!fs.existsSync(bin)) {
    throw new Error('Terrace binary not found after install: ' + bin);
  }
  return bin;
}

function gitStatus(worktree) {
  const result = runProcess('git', ['status', '--short'], { cwd: worktree, timeoutMs: 30_000 });
  if (result.exitCode !== 0) {
    return [];
  }
  return result.stdout.split('\n').filter(Boolean);
}

function changedFilesSince(before, after) {
  const beforeSet = new Set(before);
  return after.filter((line) => !beforeSet.has(line));
}

function runTerraceCommand(context, commandSpec) {
  if (commandSpec.key === 'port-gsd' && context.track === 'migrated-gsd' && context.hadTerraceAtStart) {
    return {
      repo: context.repo.name,
      repoType: context.repo.type,
      track: context.track,
      key: commandSpec.key,
      category: commandSpec.category,
      args: commandSpec.args,
      skipped: true,
      skipReason: 'Existing .terrace/state.json makes full migration overwrite testing not applicable for this worktree.',
      score: scoreSkipped()
    };
  }
  const before = gitStatus(context.worktree);
  const args = commandSpec.args.map((arg) => arg === '<phase-id>' ? context.phaseId : arg)
    .map((arg) => context.phaseId && typeof arg === 'string' ? arg.replace('<phase-id>', context.phaseId) : arg);
  if (commandSpec.needsPhase && !context.phaseId) {
    return {
      repo: context.repo.name,
      repoType: context.repo.type,
      track: context.track,
      key: commandSpec.key,
      category: commandSpec.category,
      args,
      skipped: true,
      skipReason: 'No phase id available after migration.',
      score: scoreSkipped()
    };
  }
  const raw = runProcess(context.terraceBin, args, {
    cwd: context.worktree,
    timeoutMs: context.timeoutMs,
    npmCache: context.npmCache
  });
  const after = gitStatus(context.worktree);
  const parsed = parseJson(raw.stdout);
  const stdout = captureOutput(raw.stdout);
  const stderr = captureOutput(raw.stderr);
  const changed = changedFilesSince(before, after);
  const classification = classifyResult(raw, parsed, commandSpec);
  const score = scoreResult(raw, parsed, commandSpec, changed, classification, context);
  const record = {
    repo: context.repo.name,
    repoType: context.repo.type,
    track: context.track,
    key: commandSpec.key,
    category: commandSpec.category,
    args,
    exitCode: raw.exitCode,
    signal: raw.signal,
    timedOut: raw.timedOut,
    durationMs: raw.durationMs,
    classification,
    jsonValid: parsed.valid,
    parsed: summarizeParsed(parsed.value),
    stdout: stdout.text,
    stderr: stderr.text,
    stdoutBytes: stdout.bytes,
    stderrBytes: stderr.bytes,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    changedFiles: changed,
    score
  };
  if (commandSpec.key === 'phase-list' && parsed.valid) {
    context.phaseId = firstPhaseId(parsed.value);
  }
  if (commandSpec.key === 'quick-plan' && parsed.valid && parsed.value && parsed.value.item && parsed.value.item.id) {
    context.quickId = parsed.value.item.id;
    writeQuickVerification(context.worktree, context.quickId);
    record.followUps = runQuickFollowUps(context);
  }
  return record;
}

function runQuickFollowUps(context) {
  if (!context.quickId) {
    return [];
  }
  return [
    runTerraceCommand(context, { key: 'quick-execute', category: 'quick-task', args: ['quick', 'execute', context.quickId, '--json'] }),
    runTerraceCommand(context, { key: 'quick-complete', category: 'quick-task', args: ['quick', 'complete', context.quickId, '--json'], expectedFailure: true })
  ];
}

function writeQuickVerification(worktree, quickId) {
  writeFile(worktree, path.join('docs', 'terrace', 'quick', quickId, 'VERIFICATION.md'), [
    '# Verification',
    '',
    '- Terrace corpus harness created verification evidence for quick-task completion.'
  ].join('\n') + '\n');
}

function parseJson(stdout) {
  try {
    return { valid: true, value: JSON.parse(stdout) };
  } catch (_) {
    return { valid: false, value: null };
  }
}

function captureOutput(text) {
  const value = text || '';
  if (value.length <= OUTPUT_CAPTURE_LIMIT) {
    return { text: value, bytes: Buffer.byteLength(value), truncated: false };
  }
  const head = value.slice(0, Math.floor(OUTPUT_CAPTURE_LIMIT * 0.7));
  const tail = value.slice(value.length - Math.floor(OUTPUT_CAPTURE_LIMIT * 0.3));
  return {
    text: head + '\n\n[... truncated by Terrace corpus harness ...]\n\n' + tail,
    bytes: Buffer.byteLength(value),
    truncated: true
  };
}

function summarizeParsed(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      sample: value.slice(0, 5).map((item) => summarizeParsed(item))
    };
  }
  if (typeof value !== 'object') {
    return value;
  }
  const summary = { type: 'object', keys: Object.keys(value).slice(0, 40) };
  for (const key of [
    'passed',
    'healthy',
    'mode',
    'command',
    'command_alias',
    'next_command',
    'recheck_command',
    'remediation',
    'why_blocked',
    'file',
    'project_id',
    'feature_id',
    'artifact',
    'manifest_path',
    'schema_version',
    'readiness',
    'error'
  ]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      summary[key] = value[key];
    }
  }
  for (const key of ['blocking', 'blockers', 'top_blockers', 'warnings', 'created', 'artifacts', 'validation_commands', 'review_checklist']) {
    if (Array.isArray(value[key])) {
      summary[key] = { length: value[key].length, sample: value[key].slice(0, 5).map((item) => summarizeParsed(item)) };
    }
  }
  for (const key of ['converted', 'skipped', 'writes', 'assets']) {
    if (Array.isArray(value[key])) {
      summary[key] = { length: value[key].length };
    }
  }
  if (value.item && typeof value.item === 'object') {
    summary.item = summarizeParsed(value.item);
  }
  if (value.phase && typeof value.phase === 'object') {
    summary.phase = summarizeParsed(value.phase);
  }
  if (Array.isArray(value.phases)) {
    summary.phases = { length: value.phases.length, sample: value.phases.slice(0, 5).map((item) => summarizeParsed(item)) };
  }
  if (value.agents && typeof value.agents === 'object') {
    summary.agents = {
      enabled: value.agents.enabled,
      manifest_path: value.agents.manifest_path,
      assets: Array.isArray(value.agents.assets) ? { length: value.agents.assets.length } : undefined
    };
  }
  if (value.result && typeof value.result === 'object') {
    summary.result = summarizeParsed(value.result);
  }
  return summary;
}

function firstPhaseId(value) {
  if (Array.isArray(value) && value[0] && value[0].id) {
    return value[0].id;
  }
  if (value && Array.isArray(value.phases) && value.phases[0] && value.phases[0].id) {
    return value.phases[0].id;
  }
  return null;
}

function classifyResult(raw, parsed, commandSpec) {
  if (raw.timedOut) {
    return 'harness-timeout';
  }
  if (raw.exitCode === 0) {
    return 'pass';
  }
  if (commandSpec.expectedFailure) {
    return 'expected-blocker';
  }
  if (parsed.valid && parsed.value && (parsed.value.blocking || parsed.value.error || parsed.value.passed === false)) {
    return 'product-weakness';
  }
  return 'harness-or-environment';
}

function scoreSkipped() {
  return {
    total: 0,
    reliability: 0,
    usefulness: 0,
    artifactQuality: 0,
    interrogationQuality: 0,
    repoFit: 0,
    safety: 25,
    ergonomics: 0
  };
}

function scoreResult(raw, parsed, commandSpec, changed, classification, context) {
  const text = (raw.stdout + '\n' + raw.stderr).toLowerCase();
  const jsonExpected = commandSpec.args.includes('--json');
  const reliability = classification === 'pass' ? 25 : classification === 'expected-blocker' ? 18 : 5;
  const usefulness = /next_command|blockers|warnings|artifact|created|remediation|passed/.test(text) ? 15 : 6;
  const artifactQuality = artifactScore(commandSpec, changed, text);
  const interrogationQuality = commandSpec.category === 'interrogation'
    ? (/risk|assumption|edge|failure|open question|ambiguity/.test(text) ? 15 : 5)
    : 10;
  const repoFit = classification === 'harness-or-environment' ? 4 : repoFitScore(text, context);
  const safety = changed.some((line) => line.includes('..')) ? 5 : 15;
  const ergonomics = (!jsonExpected || parsed.valid) && /usage|next_command|remediation|command|artifact|passed/.test(text) ? 15 : 6;
  const rawTotal = reliability + usefulness + artifactQuality + interrogationQuality + repoFit + safety + ergonomics;
  return {
    total: Math.round((rawTotal / 115) * 100),
    reliability,
    usefulness,
    artifactQuality,
    interrogationQuality,
    repoFit,
    safety,
    ergonomics
  };
}

function artifactScore(commandSpec, changed, text) {
  if (['senior-cycle', 'interrogation', 'ui', 'scratch-intake', 'quick-task', 'roadmap', 'shipping-security'].includes(commandSpec.category)) {
    if (changed.some((line) => /docs\/|\.terrace\//.test(line)) || /artifact|created|summary_ref|plan_ref/.test(text)) {
      return 15;
    }
    return 5;
  }
  return 10;
}

function repoFitScore(text, context) {
  if (/quality_script_missing|no executable project quality scripts|missing optional scripts/.test(text)) {
    return context.repo.type === 'sparse' || context.repo.type === 'docs' ? 15 : 10;
  }
  if (context.repo.type === 'python' && /pyproject|python/.test(text)) {
    return 15;
  }
  return 12;
}

function verifyAgentAssets(worktree) {
  const counts = {
    codexSkills: countFiles(path.join(worktree, '.agents', 'skills'), 'SKILL.md'),
    claudeSkills: countFiles(path.join(worktree, '.claude', 'skills'), 'SKILL.md'),
    claudeCommands: countMatching(path.join(worktree, '.claude', 'commands'), /^terrace-.*\.md$/),
    terraceNextCommand: fs.existsSync(path.join(worktree, '.claude', 'commands', 'terrace-next.md')),
    terraceShipCheckCommand: fs.existsSync(path.join(worktree, '.claude', 'commands', 'terrace-ship-check.md'))
  };
  const expected = agentAssetExpectations();
  return {
    ...counts,
    expected,
    complete: counts.codexSkills >= expected.codexSkills
      && counts.claudeSkills >= expected.claudeSkills
      && counts.claudeCommands >= expected.claudeCommands,
    present: counts.codexSkills > 0 || counts.claudeSkills > 0 || counts.claudeCommands > 0
  };
}

function classifyAgentAssetVerification(track, agentAssets) {
  if (track === 'migrated-gsd' && !agentAssets.present) {
    return {
      classification: 'not-applicable',
      skipped: true,
      skipReason: 'Agent asset verification requires an init/new-project track; migrated-GSD migration does not install slash assets.',
      remediation: null
    };
  }
  if (agentAssets.complete) {
    return {
      classification: 'pass',
      skipped: false,
      skipReason: undefined,
      remediation: null
    };
  }
  if (track === 'migrated-gsd') {
    return {
      classification: 'expected-blocker',
      skipped: false,
      skipReason: undefined,
      remediation: 'Run terrace init in the migrated worktree to install missing non-overwriting agent assets.'
    };
  }
  return {
    classification: 'product-weakness',
    skipped: false,
    skipReason: undefined,
    remediation: 'Expected Terrace init/new-project to install complete non-overwriting agent assets.'
  };
}

function scoreAgentAssetVerification(classification, skipped) {
  if (skipped) {
    return scoreSkipped();
  }
  if (classification === 'pass') {
    return {
      total: 100,
      reliability: 20,
      usefulness: 15,
      artifactQuality: 15,
      interrogationQuality: 10,
      repoFit: 15,
      safety: 15,
      ergonomics: 10
    };
  }
  return {
    total: classification === 'expected-blocker' ? 72 : 40,
    reliability: classification === 'expected-blocker' ? 18 : 8,
    usefulness: 15,
    artifactQuality: 10,
    interrogationQuality: 10,
    repoFit: 12,
    safety: 15,
    ergonomics: 10
  };
}

function countFiles(root, fileName) {
  if (!fs.existsSync(root)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(full, fileName);
    } else if (entry.name === fileName) {
      count += 1;
    }
  }
  return count;
}

function countMatching(root, regex) {
  if (!fs.existsSync(root)) {
    return 0;
  }
  return fs.readdirSync(root).filter((name) => regex.test(name)).length;
}

function runEvaluation(config, opts) {
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runRoot = path.join(os.tmpdir(), 'terrace-corpus-eval-' + runId);
  const evidenceDir = path.join(REPORT_DIR, 'runs', runId);
  fs.mkdirSync(runRoot, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  const tarball = packageTerrace(runRoot);
  const records = [];
  const worktrees = [];
  const npmCache = path.join(runRoot, 'npm-cache');

  try {
    for (const repo of selectedRealRepos(config, opts)) {
      for (const track of tracksForRepo(opts)) {
        const worktree = prepareRealWorktree(repo, track, runRoot);
        worktrees.push({ source: repo.path, worktree });
        runTrack({ repo, track, worktree, tarball, npmCache, timeoutMs: opts.timeoutMs, evidenceDir, records });
      }
    }
    if (opts.track === 'all' || opts.track === 'scratch-synthetic') {
      for (const repo of selectedSyntheticRepos(config)) {
        const worktree = prepareSyntheticWorktree(repo, runRoot);
        worktrees.push({ source: null, worktree });
        runTrack({ repo, track: 'scratch-synthetic', worktree, tarball, npmCache, timeoutMs: opts.timeoutMs, evidenceDir, records });
      }
    }
  } finally {
    if (!opts.keepWorktrees) {
      cleanupWorktrees(worktrees);
      fs.rmSync(runRoot, { recursive: true, force: true });
    }
  }

  const summary = summarize(records, { runId, evidenceDir });
  const recordsIndex = compactRecordsIndex(records);
  writeJson(path.join(evidenceDir, 'results.json'), { runId, summary, recordsIndex });
  writeJson(path.join(REPORT_DIR, 'latest-results.json'), { runId, summary, recordsIndex });
  fs.writeFileSync(path.join(REPORT_DIR, 'REPORT.md'), renderReport(summary, records, runId), 'utf8');
  return { runId, records, summary, evidenceDir };
}

function compactRecordsIndex(records) {
  return records.map((record) => ({
    repo: record.repo,
    repoType: record.repoType,
    track: record.track,
    key: record.key,
    category: record.category,
    classification: record.classification,
    exitCode: record.exitCode,
    durationMs: record.durationMs,
    skipped: Boolean(record.skipped),
    skipReason: record.skipReason,
    score: record.score ? record.score.total : null
  }));
}

function runTrack(params) {
  const terraceBin = installTerrace(params.worktree, params.tarball, path.dirname(params.npmCache), params.timeoutMs);
  const context = {
    repo: params.repo,
    track: params.track,
    worktree: params.worktree,
    terraceBin,
    timeoutMs: params.timeoutMs,
    npmCache: params.npmCache,
    phaseId: null,
    quickId: null,
    hadTerraceAtStart: fs.existsSync(path.join(params.worktree, '.terrace', 'state.json'))
  };
  const commands = commandPlanForTrack(params.track, params.repo);
  for (const command of commands) {
    const record = runTerraceCommand(context, command);
    params.records.push(record);
    if (record.followUps) {
      params.records.push(...record.followUps);
    }
    writeJson(path.join(params.evidenceDir, slugify(params.repo.name), params.track, command.key + '.json'), record);
  }
  const agentAssets = verifyAgentAssets(params.worktree);
  const agentClassification = classifyAgentAssetVerification(params.track, agentAssets);
  const agentRecord = {
    repo: params.repo.name,
    repoType: params.repo.type,
    track: params.track,
    key: 'agent-asset-verification',
    category: 'agent-integration',
    classification: agentClassification.classification,
    skipped: agentClassification.skipped,
    skipReason: agentClassification.skipReason,
    remediation: agentClassification.remediation,
    agentAssets,
    score: scoreAgentAssetVerification(agentClassification.classification, agentClassification.skipped)
  };
  params.records.push(agentRecord);
  writeJson(path.join(params.evidenceDir, slugify(params.repo.name), params.track, 'agent-asset-verification.json'), agentRecord);
}

function cleanupWorktrees(worktrees) {
  for (const item of worktrees) {
    if (item.source) {
      runProcess('git', ['-C', item.source, 'worktree', 'remove', '--force', item.worktree], {
        cwd: REPO_ROOT,
        timeoutMs: 60_000
      });
    }
    fs.rmSync(item.worktree, { recursive: true, force: true });
  }
}

function summarize(records, meta) {
  const commandStats = groupStats(records, (record) => record.key);
  const repoTypeStats = groupStats(records, (record) => record.repoType + ' / ' + record.track);
  const categoryStats = groupStats(records, (record) => record.category);
  const strongest = Object.values(commandStats)
    .filter((item) => item.scoredCount >= 2)
    .sort((a, b) => b.avgScore - a.avgScore || b.passRate - a.passRate)
    .slice(0, 12);
  const weakest = Object.values(commandStats)
    .filter((item) => item.scoredCount >= 2)
    .sort((a, b) => a.avgScore - b.avgScore || b.failureRate - a.failureRate)
    .slice(0, 12);
  const productWeaknesses = Object.values(groupStats(
    records.filter((record) => !record.skipped && (record.classification === 'product-weakness' || record.classification === 'harness-or-environment' || record.classification === 'harness-timeout')),
    (record) => record.key
  ))
    .sort((a, b) => b.count - a.count || a.avgScore - b.avgScore)
    .slice(0, 12);
  const expectedBlockerWatchlist = Object.values(groupStats(
    records.filter((record) => !record.skipped && record.classification === 'expected-blocker'),
    (record) => record.key
  ))
    .filter((item) => item.scoredCount >= 2)
    .sort((a, b) => a.avgScore - b.avgScore || b.count - a.count)
    .slice(0, 12);
  return {
    runId: meta.runId,
    evidenceDir: path.relative(REPO_ROOT, meta.evidenceDir),
    totals: {
      commands: records.length,
      pass: records.filter((record) => record.classification === 'pass').length,
      expectedBlockers: records.filter((record) => record.classification === 'expected-blocker').length,
      productWeaknesses: records.filter((record) => record.classification === 'product-weakness').length,
      harnessIssues: records.filter((record) => record.classification === 'harness-or-environment' || record.classification === 'harness-timeout').length,
      skipped: records.filter((record) => record.skipped).length
    },
    strongest,
    weakest,
    productWeaknesses,
    expectedBlockerWatchlist,
    topSelfServeFixes: topSelfServeFixes(records),
    categoryStats: Object.values(categoryStats).sort((a, b) => b.avgScore - a.avgScore),
    repoTypeStats: Object.values(repoTypeStats).sort((a, b) => b.avgScore - a.avgScore),
    improvementBacklog: improvementBacklog(records)
  };
}

function groupStats(records, keyFn) {
  const groups = {};
  for (const record of records) {
    const key = keyFn(record) || 'unknown';
    groups[key] = groups[key] || { key, count: 0, scoredCount: 0, pass: 0, expectedBlockers: 0, productWeaknesses: 0, harnessIssues: 0, skipped: 0, totalScore: 0, examples: [] };
    const group = groups[key];
    group.count += 1;
    if (!record.skipped) {
      group.scoredCount += 1;
      group.totalScore += record.score ? record.score.total : 0;
    }
    if (record.classification === 'pass') group.pass += 1;
    if (record.classification === 'expected-blocker') group.expectedBlockers += 1;
    if (record.classification === 'product-weakness') group.productWeaknesses += 1;
    if (record.classification === 'harness-or-environment' || record.classification === 'harness-timeout') group.harnessIssues += 1;
    if (record.skipped) group.skipped += 1;
    if (group.examples.length < 3 && record.classification !== 'pass' && !record.skipped) {
      group.examples.push({
        repo: record.repo,
        track: record.track,
        classification: record.classification,
        excerpt: excerpt(record)
      });
    }
  }
  for (const group of Object.values(groups)) {
    group.avgScore = Math.round(group.totalScore / Math.max(group.scoredCount, 1));
    group.passRate = Number((group.pass / Math.max(group.count, 1)).toFixed(2));
    group.failureRate = Number(((group.productWeaknesses + group.harnessIssues) / Math.max(group.count, 1)).toFixed(2));
    delete group.totalScore;
  }
  return groups;
}

function excerpt(record) {
  if (record.skipReason) {
    return record.skipReason;
  }
  if (record.remediation) {
    return record.remediation;
  }
  const text = [record.stderr, record.stdout].filter(Boolean).join('\n').trim();
  return text.replace(/\s+/g, ' ').slice(0, 240);
}

function improvementBacklog(records) {
  const weaknesses = records.filter((record) => !record.skipped && (
    record.classification === 'product-weakness'
    || record.classification === 'harness-or-environment'
    || record.classification === 'harness-timeout'
  ));
  const byKey = groupStats(weaknesses, (record) => record.key);
  return Object.values(byKey)
    .sort((a, b) => b.count - a.count || a.avgScore - b.avgScore)
    .slice(0, 10)
    .map((item) => ({
      command: item.key,
      affectedRuns: item.count,
      averageScore: item.avgScore,
      examples: item.examples,
      recommendation: recommendationFor(item.key)
    }));
}

function recommendationFor(key) {
  if (/interrogate/.test(key)) {
    return 'Improve interrogation specificity, risk prompts, and repo-derived assumptions.';
  }
  if (/ship|security|report/.test(key)) {
    return 'Clarify blocker severity and distinguish missing optional evidence from release-blocking failures.';
  }
  if (/phase|port-gsd/.test(key)) {
    return 'Improve migrated artifact mapping, phase id selection, and next-command guidance.';
  }
  if (/commands-discover/.test(key)) {
    return 'Improve package-manager detection and non-JS repository script guidance.';
  }
  return 'Review raw output and add more actionable remediation or safer fallback behavior.';
}

function topSelfServeFixes(records) {
  const groups = groupStats(records.filter((record) => !record.skipped && record.classification === 'expected-blocker'), (record) => record.key);
  return Object.values(groups)
    .sort((a, b) => b.count - a.count || a.avgScore - b.avgScore)
    .slice(0, 10)
    .map((group) => {
      const record = records.find((item) => item.key === group.key && item.classification === 'expected-blocker' && !item.skipped);
      return {
        command: group.key,
        affectedRuns: group.count,
        blockerType: blockerTypeFor(group.key),
        repo: record ? record.repo : null,
        track: record ? record.track : null,
        nextCommand: nextCommandFromRecord(record) || 'Review the command output and rerun after remediation.',
        remediation: record ? excerpt(record) : 'Review raw evidence.'
      };
    });
}

function selfServeFixesFromWatchlist(watchlist) {
  return watchlist.slice(0, 10).map((group) => {
    const example = group.examples && group.examples[0] ? group.examples[0] : {};
    return {
      command: group.key,
      affectedRuns: group.count,
      blockerType: blockerTypeFor(group.key),
      repo: example.repo || null,
      track: example.track || null,
      nextCommand: nextCommandForKey(group.key),
      remediation: example.excerpt || 'Review raw evidence and rerun after remediation.'
    };
  });
}

function blockerTypeFor(key) {
  if (/overwrite/.test(key)) return 'overwrite protection';
  if (/security/.test(key)) return 'strict safety';
  if (/ship|report|spec|agent-asset/.test(key)) return 'missing evidence';
  return 'workflow gate';
}

function nextCommandForKey(key) {
  if (key === 'prd-import-overwrite-refusal') return 'terrace prd import <feature> --file <file> --force';
  if (/ship/.test(key)) return 'terrace ship check --fast';
  if (key === 'report-ceremony') return 'terrace cleanup <feature>';
  if (key === 'spec-validate') return 'terrace spec validate';
  if (key === 'security-check') return 'terrace security check';
  if (key === 'agent-asset-verification' || key === 'doctor' || key === 'commands-discover') return 'terrace init';
  return 'Review the command output and rerun after remediation.';
}

function nextCommandFromRecord(record) {
  if (!record) return null;
  if (record.remediation && /terrace init/.test(record.remediation)) return 'terrace init';
  const parsed = record.parsed || {};
  if (parsed.next_command) return parsed.next_command;
  if (parsed.result && parsed.result.next_command) return parsed.result.next_command;
  if (parsed.blocking && parsed.blocking.sample && parsed.blocking.sample[0] && parsed.blocking.sample[0].next_command) {
    return parsed.blocking.sample[0].next_command;
  }
  if (parsed.blockers && parsed.blockers.sample && parsed.blockers.sample[0] && parsed.blockers.sample[0].next_command) {
    return parsed.blockers.sample[0].next_command;
  }
  if (parsed.warnings && parsed.warnings.sample && parsed.warnings.sample[0] && parsed.warnings.sample[0].next_command) {
    return parsed.warnings.sample[0].next_command;
  }
  if (record.key === 'prd-import-overwrite-refusal') return 'terrace prd import <feature> --file <file> --force';
  if (/ship/.test(record.key)) return 'terrace ship check --fast';
  if (record.key === 'report-ceremony') return 'terrace cleanup <feature>';
  if (record.key === 'spec-validate') return 'terrace spec validate';
  return nextCommandForKey(record.key);
}

function renderReport(summary, records, runId) {
  const selfServeFixes = summary.topSelfServeFixes && summary.topSelfServeFixes.length
    ? summary.topSelfServeFixes
    : selfServeFixesFromWatchlist(summary.expectedBlockerWatchlist || []);
  return [
    '# Terrace Corpus Evaluation Report',
    '',
    '- Run: `' + runId + '`',
    '- Evidence: `' + summary.evidenceDir + '`',
    '- Commands evaluated: ' + summary.totals.commands,
    '- Passed: ' + summary.totals.pass,
    '- Expected blockers: ' + summary.totals.expectedBlockers,
    '- Product weaknesses: ' + summary.totals.productWeaknesses,
    '- Harness/environment issues: ' + summary.totals.harnessIssues,
    '',
    '## Strongest Commands',
    '',
    table(summary.strongest, ['key', 'count', 'avgScore', 'passRate', 'productWeaknesses']),
    '',
    '## Product Weaknesses',
    '',
    table(summary.productWeaknesses, ['key', 'count', 'avgScore', 'failureRate', 'productWeaknesses', 'harnessIssues']),
    '',
    ...exampleLines(summary.productWeaknesses),
    '',
    '## Expected Blockers / Ergonomics Watchlist',
    '',
    table(summary.expectedBlockerWatchlist, ['key', 'count', 'avgScore', 'expectedBlockers']),
    '',
    ...exampleLines(summary.expectedBlockerWatchlist),
    '',
    '## Top Self-Serve Fixes',
    '',
    table(selfServeFixes, ['command', 'affectedRuns', 'blockerType', 'repo', 'track', 'nextCommand']),
    '',
    '## Lowest Scoring Commands',
    '',
    table(summary.weakest, ['key', 'count', 'avgScore', 'failureRate', 'productWeaknesses', 'harnessIssues']),
    '',
    '## Category Performance',
    '',
    table(summary.categoryStats, ['key', 'count', 'avgScore', 'passRate', 'productWeaknesses']),
    '',
    '## Repo-Type Performance',
    '',
    table(summary.repoTypeStats, ['key', 'count', 'avgScore', 'passRate', 'productWeaknesses']),
    '',
    '## Improvement Backlog',
    '',
    ...improvementBacklogLines(summary.improvementBacklog),
    '',
    '## Raw Evidence Index',
    '',
    '- Full JSON summary: `latest-results.json`',
    '- Per-command evidence: `' + summary.evidenceDir + '`',
    '',
    '## Manual Spot-Check Targets',
    '',
    ...spotCheckTargets(records).map((record) => '- `' + record.repo + '` / `' + record.track + '` / `' + record.key + '` - ' + record.classification)
  ].join('\n') + '\n';
}

function improvementBacklogLines(items) {
  if (!items.length) {
    return ['_No product weaknesses or harness issues in this run._'];
  }
  return items.map((item, index) => [
      String(index + 1) + '. `' + item.command + '` - ' + item.recommendation,
      '   Affected runs: ' + item.affectedRuns + ', average score: ' + item.averageScore + '.'
    ].join('\n'));
}

function exampleLines(groups) {
  if (!groups.length) {
    return ['_No representative examples._'];
  }
  return groups.flatMap((group) => {
    if (!group.examples || !group.examples.length) {
      return ['- `' + group.key + '`: no representative failing example captured.'];
    }
    return group.examples.slice(0, 1).map((example) => '- `' + group.key + '`: `' + example.repo + '` / `' + example.track + '` / `' + example.classification + '` - ' + example.excerpt);
  });
}

function table(rows, columns) {
  if (!rows.length) {
    return '_No rows._';
  }
  return [
    '| ' + columns.join(' | ') + ' |',
    '| ' + columns.map(() => '---').join(' | ') + ' |',
    ...rows.map((row) => '| ' + columns.map((column) => String(row[column] ?? '')).join(' | ') + ' |')
  ].join('\n');
}

function spotCheckTargets(records) {
  const targets = [];
  const selectors = [
    (record) => record.track === 'migrated-gsd' && record.classification === 'pass',
    (record) => record.track !== 'migrated-gsd' && record.key === 'interrogate',
    (record) => record.category === 'senior-cycle' && record.classification === 'pass',
    (record) => record.classification === 'product-weakness',
    (record) => record.repoType === 'python' || record.repoType === 'docs' || record.repoType === 'sparse'
  ];
  for (const selector of selectors) {
    const found = records.find((record) => selector(record));
    if (found && !targets.includes(found)) {
      targets.push(found);
    }
  }
  return targets;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  if (opts.dryRunPlan) {
    process.stdout.write(JSON.stringify({ plan: dryRunPlan(config, opts) }, null, 2) + '\n');
    return;
  }
  const result = runEvaluation(config, opts);
  process.stdout.write(JSON.stringify({
    runId: result.runId,
    evidenceDir: path.relative(REPO_ROOT, result.evidenceDir),
    totals: result.summary.totals,
    report: path.relative(REPO_ROOT, path.join(REPORT_DIR, 'REPORT.md'))
  }, null, 2) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyAgentAssetVerification,
  renderReport,
  summarize,
  topSelfServeFixes,
  verifyAgentAssets
};
