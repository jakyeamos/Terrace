'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stateSchema = require('../schemas/state.schema.json');
const { guidanceError } = require('./guidance.cjs');

const STATE_SCHEMA_VERSION = '1.1';
const STATE_FINGERPRINT = Symbol('terrace.state.fingerprint');
const ajv = new Ajv({ allErrors: true, strict: false });
const validateCanonicalState = ajv.compile(stateSchema);

const LEGAL_TRANSITIONS = {
  uninitialized: ['initialized'],
  initialized: ['intake_recorded'],
  intake_recorded: ['interrogated'],
  interrogated: ['spec_compiled'],
  spec_compiled: ['roadmap_ready'],
  roadmap_ready: ['slice_planned'],
  slice_planned: ['red_required'],
  red_required: ['implementation_allowed'],
  implementation_allowed: ['green_required'],
  green_required: ['protected'],
  protected: ['handoff_ready'],
  handoff_ready: ['roadmap_ready']
};

function legacyExtensionDefaults() {
  return {
    migration: null,
    handoff: null,
    handoffs: [],
    workstreams: {},
    design_sources: {},
    preflights: {},
    ai_reviews: [],
    debt: [],
    documentation: {},
    test_evaluations: [],
    rule_audits: [],
    waivers: [],
    backfills: [],
    report_card: {},
    backlog: {
      items: []
    },
    blocked_actions: [],
    quick_tasks: []
  };
}

function createDefaultState(options) {
  const opts = options || {};
  return {
    schema_version: STATE_SCHEMA_VERSION,
    state_revision: 0,
    project: {
      name: opts.projectName || 'untitled',
      created_at: new Date().toISOString()
    },
    workflow: {
      status: 'initialized',
      mode: 'strict',
      active_feature: null
    },
    roadmap: {
      phases: []
    },
    active_slice: null,
    red_gate: {
      status: 'not_started',
      evidence: []
    },
    green_gate: {
      status: 'not_started',
      evidence: []
    },
    protected_tests: [],
    decisions: [],
    sessions: [],
    ...legacyExtensionDefaults()
  };
}

function statePathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'state.json');
}

function lockPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'state.lock');
}

function stateError(code, message, details) {
  return guidanceError(message, {
    code,
    file: '.terrace/state.json',
    next_command: 'Run `terrace doctor` after resolving the state-store issue.',
    remediation: 'Resolve the state-store issue before rerunning the command.',
    ...details
  });
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

function noFollowFlag() {
  return fs.constants.O_NOFOLLOW || 0;
}

function unsafeStatePath(filePath, reason) {
  throw stateError('STATE_PATH_UNSAFE', 'Refusing to use unsafe Terrace state path ' + filePath + '.', {
    file: filePath,
    why_blocked: reason,
    remediation: 'Replace the symlink or unexpected filesystem object with a regular Terrace state path, then retry.'
  });
}

function ensureTerraceDirectory(cwd, createIfMissing) {
  const directory = path.resolve(cwd, '.terrace');
  let stat = lstatIfExists(directory);
  if (!stat) {
    if (!createIfMissing) {
      return { directory, exists: false, identity: null };
    }
    fs.mkdirSync(directory, { recursive: true });
    stat = lstatIfExists(directory);
  }
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    unsafeStatePath(directory, '.terrace must be a real directory owned by the project.');
  }
  return {
    directory,
    exists: true,
    identity: { dev: stat.dev, ino: stat.ino }
  };
}

function assertDirectoryIdentity(directory, expectedIdentity) {
  const stat = lstatIfExists(directory);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    unsafeStatePath(directory, '.terrace changed while Terrace was writing state.');
  }
  if (expectedIdentity && (stat.dev !== expectedIdentity.dev || stat.ino !== expectedIdentity.ino)) {
    unsafeStatePath(directory, '.terrace was replaced while Terrace was writing state.');
  }
}

function resolveStatePaths(cwd, createIfMissing) {
  const terrace = ensureTerraceDirectory(cwd, createIfMissing);
  return {
    ...terrace,
    statePath: path.join(terrace.directory, 'state.json'),
    lockPath: path.join(terrace.directory, 'state.lock'),
    recoveryPath: path.join(terrace.directory, 'state.lock.recovery')
  };
}

function assertSafeRegularFile(filePath, missingAllowed) {
  const stat = lstatIfExists(filePath);
  if (!stat && missingAllowed) {
    return null;
  }
  if (!stat) {
    return null;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    unsafeStatePath(filePath, 'Terrace state files must be regular files, not links or special filesystem objects.');
  }
  return stat;
}

function readRegularText(filePath) {
  const initialStat = assertSafeRegularFile(filePath, true);
  if (!initialStat) {
    return null;
  }

  let descriptor;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollowFlag());
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile()) {
      unsafeStatePath(filePath, 'Terrace state files must remain regular files while read.');
    }
    return fs.readFileSync(descriptor, 'utf8');
  } catch (error) {
    if (error && error.code === 'ELOOP') {
      unsafeStatePath(filePath, 'Terrace refuses to follow a state-file symlink.');
    }
    throw error;
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
}

function fingerprint(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function attachFingerprint(state, value) {
  Object.defineProperty(state, STATE_FINGERPRINT, {
    value,
    configurable: true,
    enumerable: true,
    writable: true
  });
  return state;
}

function parseState(text, filePath) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw stateError('STATE_JSON_INVALID', 'Terrace state is not valid JSON: ' + filePath + '.', {
      file: filePath,
      why_blocked: error && error.message ? error.message : 'JSON parsing failed.',
      remediation: 'Restore a valid .terrace/state.json backup or run `terrace init --force --yes` to deliberately reset it.'
    });
  }
}

function migrateState(rawState) {
  if (!rawState || Array.isArray(rawState) || typeof rawState !== 'object') {
    throw stateError('STATE_SCHEMA_INVALID', 'Terrace state must be a JSON object.', {
      why_blocked: 'The top-level state value is not an object.'
    });
  }

  if (rawState.schema_version === '1.0') {
    return {
      ...legacyExtensionDefaults(),
      ...rawState,
      schema_version: STATE_SCHEMA_VERSION,
      state_revision: Object.prototype.hasOwnProperty.call(rawState, 'state_revision') ? rawState.state_revision : 0
    };
  }

  if (rawState.schema_version !== STATE_SCHEMA_VERSION) {
    const code = typeof rawState.schema_version === 'string' ? 'STATE_VERSION_UNSUPPORTED' : 'STATE_SCHEMA_INVALID';
    throw stateError(code, 'Terrace cannot load state schema version ' + String(rawState.schema_version) + '.', {
      why_blocked: 'This Terrace version supports state schema versions 1.0 and 1.1 only.',
      remediation: 'Use a compatible Terrace release or restore a supported .terrace/state.json backup.'
    });
  }

  return rawState;
}

function validateState(state) {
  if (!validateCanonicalState(state)) {
    throw stateError('STATE_SCHEMA_INVALID', 'Terrace state does not satisfy the canonical 1.1 schema.', {
      validation_errors: (validateCanonicalState.errors || []).map((error) => ({
        instance_path: error.instancePath,
        keyword: error.keyword,
        message: error.message,
        params: error.params
      })),
      remediation: 'Restore a valid state backup or run `terrace init --force --yes` only when a full reset is intended.'
    });
  }
  return state;
}

function parseAndValidateState(text, filePath) {
  return validateState(migrateState(parseState(text, filePath)));
}

function readCurrentState(paths, allowInvalid) {
  const text = readRegularText(paths.statePath);
  if (text === null) {
    return null;
  }
  try {
    return {
      text,
      state: parseAndValidateState(text, paths.statePath),
      fingerprint: fingerprint(text)
    };
  } catch (error) {
    if (!allowInvalid) {
      throw error;
    }
    return {
      text,
      state: null,
      fingerprint: fingerprint(text)
    };
  }
}

function lockOwner(lockPath) {
  const text = readRegularText(lockPath);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sameFileIdentity(stat, expectedIdentity) {
  return Boolean(
    stat &&
    expectedIdentity &&
    !stat.isSymbolicLink() &&
    stat.isFile() &&
    stat.dev === expectedIdentity.dev &&
    stat.ino === expectedIdentity.ino
  );
}

function exclusiveFileExistsError() {
  const error = new Error('Exclusive Terrace state marker already exists.');
  error.code = 'EEXIST';
  return error;
}

function acquireExclusiveMarker(markerPath) {
  if (assertSafeRegularFile(markerPath, true)) {
    throw exclusiveFileExistsError();
  }

  let descriptor;
  let identity;
  try {
    descriptor = fs.openSync(markerPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) {
      unsafeStatePath(markerPath, 'Terrace state markers must remain regular files while locked.');
    }
    identity = { dev: stat.dev, ino: stat.ino };
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }) + '\n', 'utf8');
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
      descriptor = undefined;
      const current = lstatIfExists(markerPath);
      if (sameFileIdentity(current, identity)) {
        fs.unlinkSync(markerPath);
      }
    }
    throw error;
  }

  return {
    release() {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
      }
      const current = lstatIfExists(markerPath);
      if (sameFileIdentity(current, identity)) {
        fs.unlinkSync(markerPath);
      }
    }
  };
}

function processIsConfirmedDead(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return Boolean(error && error.code === 'ESRCH');
  }
}

function reclaimStaleLock(paths, expectedStat) {
  let recoveryGate;
  try {
    recoveryGate = acquireExclusiveMarker(paths.recoveryPath);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      return null;
    }
    if (error && error.code === 'ELOOP') {
      unsafeStatePath(paths.recoveryPath, 'Terrace refuses to follow a stale-lock recovery symlink.');
    }
    throw error;
  }

  let claimed = false;
  try {
    const current = assertSafeRegularFile(paths.lockPath, true);
    if (!sameFileIdentity(current, expectedStat)) {
      return null;
    }

    const owner = lockOwner(paths.lockPath);
    if (!owner || !processIsConfirmedDead(owner.pid)) {
      return null;
    }

    fs.unlinkSync(paths.lockPath);
    claimed = true;
    return recoveryGate;
  } finally {
    if (!claimed) {
      recoveryGate.release();
    }
  }
}

function stateWriteLocked(paths, owner, whyBlocked, filePath) {
  throw stateError('STATE_WRITE_LOCKED', 'Terrace state is locked by another writer.', {
    file: filePath || paths.lockPath,
    lock: owner,
    why_blocked: whyBlocked,
    remediation: 'Wait for the active command to finish. Terrace reclaims a state lock only when its recorded PID is confirmed absent; an interrupted recovery claim must be inspected before retrying.'
  });
}

function assertNoRecoveryInProgress(paths) {
  if (assertSafeRegularFile(paths.recoveryPath, true)) {
    stateWriteLocked(
      paths,
      lockOwner(paths.recoveryPath),
      'A stale-lock recovery claim is active, so Terrace will not race it or remove its marker automatically.',
      paths.recoveryPath
    );
  }
}

function acquireStateLock(paths) {
  assertDirectoryIdentity(paths.directory, paths.identity);
  assertNoRecoveryInProgress(paths);
  const existingLock = assertSafeRegularFile(paths.lockPath, true);
  let recoveryGate = null;
  if (existingLock) {
    recoveryGate = reclaimStaleLock(paths, existingLock);
    if (!recoveryGate) {
      stateWriteLocked(paths, lockOwner(paths.lockPath), 'A state lock already exists, so Terrace cannot safely merge concurrent whole-file writes.');
    }
  }

  try {
    if (!recoveryGate) {
      assertNoRecoveryInProgress(paths);
    }
    const stateLock = acquireExclusiveMarker(paths.lockPath);
    if (recoveryGate) {
      recoveryGate.release();
      recoveryGate = null;
    }
    return stateLock.release;
  } catch (error) {
    if (recoveryGate) {
      recoveryGate.release();
      recoveryGate = null;
    }
    if (error && error.code === 'EEXIST') {
      stateWriteLocked(paths, lockOwner(paths.lockPath), 'A state lock appeared while Terrace was preparing the write.');
    }
    if (error && error.code === 'ELOOP') {
      unsafeStatePath(paths.lockPath, 'Terrace refuses to follow a state-lock symlink.');
    }
    throw error;
  }

}

function atomicWriteState(paths, text) {
  const temporaryPath = path.join(paths.directory, '.state.json.' + process.pid + '.' + crypto.randomUUID() + '.tmp');
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
    fs.writeFileSync(descriptor, text, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    assertDirectoryIdentity(paths.directory, paths.identity);
    assertSafeRegularFile(paths.statePath, true);
    fs.renameSync(temporaryPath, paths.statePath);
    syncStateDirectory(paths.directory);
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    const directory = lstatIfExists(paths.directory);
    if (directory && !directory.isSymbolicLink() && directory.isDirectory() && paths.identity && directory.dev === paths.identity.dev && directory.ino === paths.identity.ino && lstatIfExists(temporaryPath)) {
      fs.unlinkSync(temporaryPath);
    }
  }
}

function syncStateDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, fs.constants.O_RDONLY);
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (error && ['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'EPERM'].includes(error.code)) {
      return false;
    }
    throw error;
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
  }
  return true;
}

function writeState(cwd, candidate, options) {
  const opts = options || {};
  const canonicalCandidate = validateState(migrateState(candidate));
  const paths = resolveStatePaths(cwd, true);
  const releaseLock = acquireStateLock(paths);

  try {
    const current = readCurrentState(paths, Boolean(opts.replace));
    let nextRevision;
    if (!current) {
      nextRevision = canonicalCandidate.state_revision;
    } else if (opts.replace) {
      nextRevision = current.state ? current.state.state_revision + 1 : Math.max(canonicalCandidate.state_revision, 0) + 1;
    } else {
      const expectedFingerprint = candidate[STATE_FINGERPRINT];
      if (!expectedFingerprint || !current.state || expectedFingerprint !== current.fingerprint || candidate.state_revision !== current.state.state_revision) {
        throw stateError('STATE_REVISION_CONFLICT', 'Terrace state changed before this write could be committed.', {
          current_revision: current.state ? current.state.state_revision : null,
          expected_revision: candidate.state_revision,
          why_blocked: 'Whole-file state writes require the exact state snapshot returned by loadState.',
          remediation: 'Reload Terrace state and retry the command. Use an explicit reset path only when intentionally replacing state.'
        });
      }
      nextRevision = current.state.state_revision + 1;
    }

    const nextState = {
      ...canonicalCandidate,
      schema_version: STATE_SCHEMA_VERSION,
      state_revision: nextRevision
    };
    validateState(nextState);
    const text = JSON.stringify(nextState, null, 2) + '\n';
    atomicWriteState(paths, text);
    return paths.statePath;
  } finally {
    releaseLock();
  }
}

function assertLegalTransition(fromStatus, toStatus) {
  const allowed = LEGAL_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error('Illegal transition: ' + fromStatus + ' -> ' + toStatus);
  }
}

function transitionState(state, toStatus) {
  assertLegalTransition(state.workflow.status, toStatus);
  return {
    ...state,
    workflow: {
      ...state.workflow,
      status: toStatus
    }
  };
}

function saveState(cwd, state) {
  return writeState(cwd, state, { replace: false });
}

function replaceState(cwd, state) {
  return writeState(cwd, state, { replace: true });
}

function loadState(cwd) {
  const paths = resolveStatePaths(cwd, false);
  const text = readRegularText(paths.statePath);
  if (text === null) {
    throw stateError('STATE_MISSING', 'Missing .terrace/state.json. Run `terrace init` first.', {
      next_command: 'terrace init',
      remediation: 'Initialize Terrace before using stateful commands.'
    });
  }
  return attachFingerprint(parseAndValidateState(text, paths.statePath), fingerprint(text));
}

module.exports = {
  LEGAL_TRANSITIONS,
  STATE_SCHEMA_VERSION,
  createDefaultState,
  statePathFor,
  lockPathFor,
  assertLegalTransition,
  transitionState,
  validateState,
  saveState,
  replaceState,
  loadState
};
