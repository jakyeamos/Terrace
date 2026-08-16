'use strict';

const path = require('path');
const { randomUUID } = require('crypto');
const { createDefaultState, replaceState, saveState } = require('./state.cjs');
const { detectCommands, writeConfig } = require('./config.cjs');
const { appendEvent } = require('./events.cjs');
const { defaultRuleFiles, ensureDefaultRules, writeDefaultRules } = require('./rules.cjs');
const { installAgentBootstrap, preflightAgentBootstrap, templateAssets } = require('./agents.cjs');
const { guidanceError } = require('./guidance.cjs');
const {
  ensureProjectDirectory,
  managedArtifactExists,
  preflightManagedArtifacts,
  readManagedText,
  readProjectText,
  removeManagedArtifact,
  removeProjectArtifact,
  resolveProjectArtifact,
  withManagedArtifactLock,
  writeManagedJson,
  writeManagedText,
  writeProjectText
} = require('./managed-artifacts.cjs');

function ensureDir(cwd, relPath, created) {
  try {
    const result = ensureProjectDirectory(cwd, relPath);
    if (result.created) {
      created.push(relPath);
    }
    return result.created;
  } catch (error) {
    return mapInitProjectArtifactError(relPath, error);
  }
}

function defaultConfig(cwd) {
  return {
    schema_version: '1.0',
    commands: detectCommands(cwd),
    pentest_authorized: false,
    execution_policy: {
      default_mode: 'strict',
      allow_low_effort: true,
      phase_effort_default: 'standard'
    },
    quality_runner: {
      enabled: false,
      analysis_mode: 'balanced',
      cache_mode: 'external',
      command: 'quality-runner',
      block_on: ['hard', 'stale', 'missing_evidence', 'plan_coverage']
    },
    ship_gates: {
      dead_code: {
        enabled: true
      }
    }
  };
}

function defaultPresetRegistry() {
  return { version: '1.0', presets: [] };
}

function resetPathError(relPath, reason) {
  throw guidanceError('Refusing to reset Terrace through unsafe managed path ' + relPath + '.', {
    code: 'INIT_RESET_PATH_UNSAFE',
    file: relPath,
    why_blocked: reason,
    next_command: 'Replace the symlink or unexpected filesystem object, then rerun terrace init --force --yes.',
    remediation: 'Terrace reset only operates on ordinary files and directories inside the target repository.'
  });
}

function initProjectPathError(relPath, reason) {
  throw guidanceError('Refusing to initialize Terrace through unsafe project path ' + relPath + '.', {
    code: 'INIT_PATH_UNSAFE',
    file: relPath,
    why_blocked: reason,
    next_command: 'Replace the symlink or unexpected filesystem object, then rerun terrace init.',
    remediation: 'Terrace initialization only creates ordinary directories inside the target repository.'
  });
}

function mapInitProjectArtifactError(relPath, error) {
  if (error && error.details && error.details.code === 'MANAGED_ARTIFACT_PATH_UNSAFE') {
    initProjectPathError(relPath, error.details.why_blocked || 'The project path is unsafe.');
  }
  throw error;
}

function mapResetProjectArtifactError(relPath, error) {
  if (error && error.details && error.details.code === 'MANAGED_ARTIFACT_PATH_UNSAFE') {
    resetPathError(relPath, error.details.why_blocked || 'The reset path is unsafe.');
  }
  throw error;
}

function resolveInitProjectArtifact(cwd, relPath, options) {
  try {
    return resolveProjectArtifact(cwd, relPath, options);
  } catch (error) {
    return mapInitProjectArtifactError(relPath, error);
  }
}

function resolveResetProjectArtifact(cwd, relPath, options) {
  try {
    return resolveProjectArtifact(cwd, relPath, options);
  } catch (error) {
    return mapResetProjectArtifactError(relPath, error);
  }
}

function readResetProjectText(cwd, relPath) {
  try {
    return readProjectText(cwd, relPath);
  } catch (error) {
    return mapResetProjectArtifactError(relPath, error);
  }
}

function writeResetProjectText(cwd, relPath, text) {
  try {
    return writeProjectText(cwd, relPath, text);
  } catch (error) {
    return mapResetProjectArtifactError(relPath, error);
  }
}

function removeResetProjectArtifact(cwd, relPath) {
  try {
    return removeProjectArtifact(cwd, relPath);
  } catch (error) {
    return mapResetProjectArtifactError(relPath, error);
  }
}

function assertResetPathSafe(cwd, relPath) {
  resolveResetProjectArtifact(cwd, relPath, { allowExistingLeafSymlink: true });
}

function assertResetPathsSafe(cwd, relPaths) {
  const managedPaths = ['backups/.reset-preflight', ...relPaths
    .filter((relPath) => relPath.startsWith('.terrace/'))
    .map((relPath) => relPath.slice('.terrace/'.length))];
  try {
    preflightManagedArtifacts(cwd, managedPaths);
  } catch (error) {
    if (error && error.details && error.details.code === 'MANAGED_ARTIFACT_PATH_UNSAFE') {
      resetPathError(error.details.file || '.terrace', error.details.why_blocked || 'A managed reset path is unsafe.');
    }
    throw error;
  }
  for (const relPath of relPaths.filter((candidate) => !candidate.startsWith('.terrace/'))) {
    assertResetPathSafe(cwd, relPath);
  }
}

function relativePathExists(cwd, relPath) {
  if (relPath.startsWith('.terrace/')) {
    return managedArtifactExists(cwd, relPath.slice('.terrace/'.length));
  }
  return Boolean(resolveInitProjectArtifact(cwd, relPath, { allowExistingLeafSymlink: true }).fileStat);
}

function coreArtifactPaths() {
  return [
    '.terrace/state.json',
    '.terrace/config.json',
    '.terrace/presets/registry.json',
    '.terrace/events.jsonl',
    ...defaultRuleFiles()
  ];
}

function backupPaths() {
  return [...coreArtifactPaths(), '.terrace/agents/manifest.json'];
}

function resetArtifactPaths() {
  return [...new Set([
    ...backupPaths(),
    ...templateAssets().map((asset) => asset.path)
  ])];
}

function backupArtifactPath(backupPath, relPath) {
  return backupPath.slice('.terrace/'.length) + '/' + (relPath.startsWith('.terrace/') ? relPath.slice('.terrace/'.length) : relPath);
}

function writePresetRegistry(cwd) {
  writeManagedJson(cwd, 'presets/registry.json', defaultPresetRegistry());
}

function createBackup(cwd, relPaths) {
  assertResetPathsSafe(cwd, relPaths);
  const backupPath = '.terrace/backups/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
  const backedUp = [];
  const preserved = [];
  for (const relPath of relPaths) {
    if (relPath.startsWith('.terrace/')) {
      const source = readManagedText(cwd, relPath.slice('.terrace/'.length));
      if (source === null) {
        continue;
      }
      writeManagedText(cwd, backupArtifactPath(backupPath, relPath), source);
      backedUp.push(relPath);
      continue;
    }
    const sourceArtifact = resolveResetProjectArtifact(cwd, relPath, { allowExistingLeafSymlink: true });
    if (!sourceArtifact.fileStat) {
      continue;
    }
    if (sourceArtifact.fileStat.isSymbolicLink()) {
      preserved.push(relPath);
      continue;
    }
    const source = readResetProjectText(cwd, relPath);
    if (source === null) {
      resetPathError(relPath, 'A reset artifact disappeared while Terrace was preparing its backup.');
    }
    writeManagedText(cwd, backupArtifactPath(backupPath, relPath), source);
    backedUp.push(relPath);
  }
  return { backup_path: backupPath, backed_up: backedUp, preserved };
}

function restoreBackup(cwd, backup, relPaths) {
  assertResetPathsSafe(cwd, relPaths);
  const backedUp = new Set(backup.backed_up);
  const preserved = new Set(backup.preserved || []);
  const restored = [];
  const removed = [];
  for (const relPath of relPaths) {
    if (relPath.startsWith('.terrace/')) {
      const artifactPath = relPath.slice('.terrace/'.length);
      if (backedUp.has(relPath)) {
        const source = readManagedText(cwd, backupArtifactPath(backup.backup_path, relPath));
        if (source === null) {
          resetPathError(relPath, 'The retained reset backup is missing a managed artifact that must be restored.');
        }
        writeManagedText(cwd, artifactPath, source);
        restored.push(relPath);
      } else if (managedArtifactExists(cwd, artifactPath)) {
        removeManagedArtifact(cwd, artifactPath);
        removed.push(relPath);
      }
      continue;
    }
    if (preserved.has(relPath)) {
      continue;
    }
    if (backedUp.has(relPath)) {
      const source = readManagedText(cwd, backupArtifactPath(backup.backup_path, relPath));
      if (source === null) {
        resetPathError(relPath, 'The retained reset backup is missing an artifact that must be restored.');
      }
      writeResetProjectText(cwd, relPath, source);
      restored.push(relPath);
    } else if (resolveResetProjectArtifact(cwd, relPath).fileStat) {
      removeResetProjectArtifact(cwd, relPath);
      removed.push(relPath);
    }
  }
  return { restored, removed };
}

function resetRecoveryError(cwd, backup, relPaths, cause) {
  const causeMessage = cause && cause.message ? cause.message : String(cause);
  try {
    const recovery = restoreBackup(cwd, backup, relPaths);
    return guidanceError('Terrace reset failed; managed artifacts were restored from ' + backup.backup_path + '. ' + causeMessage, {
      code: 'INIT_RESET_ROLLED_BACK',
      backup_path: backup.backup_path,
      recovery,
      next_command: 'Review the filesystem error, then rerun terrace init --force --yes if the reset is still intended.',
      remediation: 'Terrace restored the prior managed artifacts from the retained backup at ' + backup.backup_path + '.'
    });
  } catch (recoveryError) {
    const recoveryMessage = recoveryError && recoveryError.message ? recoveryError.message : String(recoveryError);
    return guidanceError('Terrace reset failed after creating backup ' + backup.backup_path + ', and automatic recovery also failed. ' + causeMessage + ' Recovery error: ' + recoveryMessage, {
      code: 'INIT_RESET_RECOVERY_REQUIRED',
      backup_path: backup.backup_path,
      reset_error: causeMessage,
      recovery_error: recoveryMessage,
      next_command: 'Restore the managed files from ' + backup.backup_path + ' before retrying terrace init.',
      remediation: 'The pre-reset backup remains at ' + backup.backup_path + '; restore it manually after resolving the filesystem error.'
    });
  }
}

function existingWorkflowStatus(cwd) {
  try {
    const text = readManagedText(cwd, 'state.json');
    if (text === null) {
      return 'uninitialized';
    }
    const state = JSON.parse(text);
    return state.workflow && typeof state.workflow.status === 'string' ? state.workflow.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

function writeInitEvent(cwd, command, fromState) {
  appendEvent(cwd, {
    command,
    from_state: fromState,
    to_state: 'initialized',
    evidence_refs: ['.terrace/state.json', '.terrace/config.json', '.terrace/agents/manifest.json']
  });
}

function appendWrittenAgentAssets(created, agents, overwritten, existingPaths) {
  for (const asset of agents.assets) {
    if (asset.status === 'written') {
      recordWrite(created, overwritten || [], asset.path, Boolean(existingPaths && existingPaths.has(asset.path)));
    }
  }
}

function recordWrite(created, overwritten, relPath, existed) {
  if (existed) {
    overwritten.push(relPath);
  } else {
    created.push(relPath);
  }
}

function resetCore(cwd, opts, created, resetConfig) {
  const resetPaths = coreArtifactPaths();
  const resetPathsWithAgentAssets = resetArtifactPaths();
  assertResetPathsSafe(cwd, resetPathsWithAgentAssets);
  const existed = new Set(resetPathsWithAgentAssets.filter((relPath) => relativePathExists(cwd, relPath)));
  const resetState = createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  const backup = createBackup(cwd, resetPathsWithAgentAssets);
  const overwritten = [];
  const fromState = existingWorkflowStatus(cwd);

  try {
    replaceState(cwd, resetState);
    recordWrite(created, overwritten, '.terrace/state.json', existed.has('.terrace/state.json'));

    writeConfig(cwd, resetConfig);
    recordWrite(created, overwritten, '.terrace/config.json', existed.has('.terrace/config.json'));

    writePresetRegistry(cwd);
    recordWrite(created, overwritten, '.terrace/presets/registry.json', existed.has('.terrace/presets/registry.json'));

    writeDefaultRules(cwd);
    for (const relPath of defaultRuleFiles()) {
      recordWrite(created, overwritten, relPath, existed.has(relPath));
    }

    writeManagedText(cwd, 'events.jsonl', '');
    recordWrite(created, overwritten, '.terrace/events.jsonl', existed.has('.terrace/events.jsonl'));

    for (const relPath of ['docs/prd', 'docs/spec', 'docs/testing']) {
      ensureDir(cwd, relPath, created);
    }

    const agents = installAgentBootstrap(cwd);
    appendWrittenAgentAssets(created, agents, overwritten, existed);
    writeInitEvent(cwd, 'terrace init --force --yes', fromState);

    return {
      mode: 'reset',
      created,
      preserved: [],
      reset: {
        ...backup,
        overwritten
      },
      agents
    };
  } catch (error) {
    throw resetRecoveryError(cwd, backup, resetPathsWithAgentAssets, error);
  }
}

function preflightInitDirectories(cwd) {
  for (const relPath of ['docs/prd', 'docs/spec', 'docs/testing']) {
    resolveInitProjectArtifact(cwd, path.join(relPath, '.terrace-init-preflight'));
  }
}

function prepareInitConfig(cwd, opts) {
  if (opts.force || !relativePathExists(cwd, '.terrace/config.json')) {
    return defaultConfig(cwd);
  }
  return null;
}

function initCore(cwd, options) {
  const opts = options || {};
  if (Boolean(opts.force) !== Boolean(opts.yes)) {
    throw guidanceError('Refusing to reset Terrace state without explicit confirmation. Re-run with --force --yes.', {
      code: 'INIT_RESET_CONFIRMATION_REQUIRED',
      next_command: 'terrace init --force --yes',
      remediation: 'Run ordinary `terrace init` to repair missing artifacts, or use both flags to create a backup and reset managed Terrace state.',
      why_blocked: 'Resetting an initialized workflow can discard active state unless its backup is explicitly requested.'
    });
  }

  preflightInitDirectories(cwd);

  if (!opts.force) {
    preflightManagedArtifacts(cwd, [...coreArtifactPaths(), '.terrace/agents/manifest.json'].map((relPath) => relPath.slice('.terrace/'.length)));
    preflightAgentBootstrap(cwd);
  } else if (opts.yes) {
    assertResetPathsSafe(cwd, resetArtifactPaths());
  }

  const preparedConfig = prepareInitConfig(cwd, opts);
  return withManagedArtifactLock(cwd, () => initCoreLocked(cwd, opts, preparedConfig));
}

function initCoreLocked(cwd, opts, preparedConfig) {
  const created = [];
  const preserved = [];
  const existingManagedPaths = backupPaths().filter((relPath) => relativePathExists(cwd, relPath));
  if (opts.force && opts.yes && existingManagedPaths.length > 0) {
    return resetCore(cwd, opts, created, preparedConfig || defaultConfig(cwd));
  }

  const stateExists = relativePathExists(cwd, '.terrace/state.json');
  const configExists = relativePathExists(cwd, '.terrace/config.json');
  const eventsExist = relativePathExists(cwd, '.terrace/events.jsonl');
  const initialState = stateExists ? null : createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  const initialConfig = configExists ? null : (preparedConfig || defaultConfig(cwd));
  if (stateExists) {
    preserved.push('.terrace/state.json');
  } else {
    saveState(cwd, initialState);
    created.push('.terrace/state.json');
  }

  if (configExists) {
    preserved.push('.terrace/config.json');
  } else {
    writeConfig(cwd, initialConfig);
    created.push('.terrace/config.json');
  }

  if (relativePathExists(cwd, '.terrace/presets/registry.json')) {
    preserved.push('.terrace/presets/registry.json');
  } else {
    writePresetRegistry(cwd);
    created.push('.terrace/presets/registry.json');
  }

  const existingRulePaths = new Set(defaultRuleFiles().filter((relPath) => relativePathExists(cwd, relPath)));
  const writtenRules = ensureDefaultRules(cwd);
  preserved.push(...existingRulePaths);
  created.push(...writtenRules);

  for (const relPath of ['docs/prd', 'docs/spec', 'docs/testing']) {
    ensureDir(cwd, relPath, created);
  }

  if (eventsExist) {
    preserved.push('.terrace/events.jsonl');
  } else {
    writeManagedText(cwd, 'events.jsonl', '');
    created.push('.terrace/events.jsonl');
  }

  const agents = installAgentBootstrap(cwd);
  appendWrittenAgentAssets(created, agents);

  if (!stateExists && !eventsExist) {
    writeInitEvent(cwd, 'terrace init', 'uninitialized');
  }

  return {
    mode: stateExists ? (created.length > 0 ? 'repaired' : 'already_initialized') : 'initialized',
    created,
    preserved,
    reset: null,
    agents
  };
}

module.exports = {
  initCore
};
