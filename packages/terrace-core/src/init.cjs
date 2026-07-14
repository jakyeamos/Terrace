'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { createDefaultState, saveState } = require('./state.cjs');
const { detectCommands, writeConfig } = require('./config.cjs');
const { appendEvent } = require('./events.cjs');
const { defaultRuleFiles, ensureDefaultRules, writeDefaultRules } = require('./rules.cjs');
const { installAgentBootstrap, templateAssets } = require('./agents.cjs');
const { guidanceError } = require('./guidance.cjs');

function ensureDir(cwd, relPath, created) {
  const fullPath = path.resolve(cwd, relPath);
  if (fs.existsSync(fullPath)) {
    return false;
  }
  fs.mkdirSync(fullPath, { recursive: true });
  created.push(relPath);
  return true;
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

function relativePathExists(cwd, relPath) {
  return fs.existsSync(path.resolve(cwd, relPath));
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

function writePresetRegistry(cwd) {
  const presetRegistryPath = path.resolve(cwd, '.terrace', 'presets', 'registry.json');
  fs.mkdirSync(path.dirname(presetRegistryPath), { recursive: true });
  fs.writeFileSync(presetRegistryPath, JSON.stringify(defaultPresetRegistry(), null, 2) + '\n', 'utf8');
}

function createBackup(cwd, relPaths) {
  const backupPath = '.terrace/backups/' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
  const backupRoot = path.resolve(cwd, backupPath);
  const backedUp = [];
  for (const relPath of relPaths) {
    const sourcePath = path.resolve(cwd, relPath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.resolve(backupRoot, relPath.replace(/^\.terrace\//, ''));
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    backedUp.push(relPath);
  }
  return { backup_path: backupPath, backed_up: backedUp };
}

function restoreBackup(cwd, backup, relPaths) {
  const backedUp = new Set(backup.backed_up);
  const restored = [];
  const removed = [];
  for (const relPath of relPaths) {
    const targetPath = path.resolve(cwd, relPath);
    if (backedUp.has(relPath)) {
      const sourcePath = path.resolve(cwd, backup.backup_path, relPath.replace(/^\.terrace\//, ''));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      restored.push(relPath);
    } else if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { force: true });
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
  const statePath = path.resolve(cwd, '.terrace', 'state.json');
  if (!fs.existsSync(statePath)) {
    return 'uninitialized';
  }
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
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

function resetCore(cwd, opts, created) {
  const resetPaths = coreArtifactPaths();
  const resetPathsWithAgentAssets = resetArtifactPaths();
  const existed = new Set(resetPathsWithAgentAssets.filter((relPath) => relativePathExists(cwd, relPath)));
  const resetState = createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  const resetConfig = defaultConfig(cwd);
  const backup = createBackup(cwd, resetPathsWithAgentAssets);
  const overwritten = [];
  const fromState = existingWorkflowStatus(cwd);

  try {
    saveState(cwd, resetState);
    recordWrite(created, overwritten, '.terrace/state.json', existed.has('.terrace/state.json'));

    writeConfig(cwd, resetConfig);
    recordWrite(created, overwritten, '.terrace/config.json', existed.has('.terrace/config.json'));

    writePresetRegistry(cwd);
    recordWrite(created, overwritten, '.terrace/presets/registry.json', existed.has('.terrace/presets/registry.json'));

    writeDefaultRules(cwd);
    for (const relPath of defaultRuleFiles()) {
      recordWrite(created, overwritten, relPath, existed.has(relPath));
    }

    const eventsPath = path.resolve(cwd, '.terrace', 'events.jsonl');
    fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
    fs.writeFileSync(eventsPath, '', 'utf8');
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

  const created = [];
  const preserved = [];
  const existingManagedPaths = backupPaths().filter((relPath) => relativePathExists(cwd, relPath));
  if (opts.force && opts.yes && existingManagedPaths.length > 0) {
    return resetCore(cwd, opts, created);
  }

  const stateExists = relativePathExists(cwd, '.terrace/state.json');
  const configExists = relativePathExists(cwd, '.terrace/config.json');
  const eventsExist = relativePathExists(cwd, '.terrace/events.jsonl');
  const initialState = stateExists ? null : createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  const initialConfig = configExists ? null : defaultConfig(cwd);
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
    const eventsPath = path.resolve(cwd, '.terrace', 'events.jsonl');
    fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
    fs.writeFileSync(eventsPath, '', 'utf8');
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
