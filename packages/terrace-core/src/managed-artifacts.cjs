'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { guidanceError } = require('./guidance.cjs');

const MANAGED_LOCK_PATH = 'locks/managed-artifacts.lock';
const MANAGED_RECOVERY_PATH = 'locks/managed-artifacts.lock.recovery';
const PRESET_TRANSACTION_KIND = 'terrace-preset-install-transaction';
const PRESET_TRANSACTION_PATHS = ['policy.json', 'presets/registry.json'];
const activeManagedLocks = new Map();
const activeManagedLockRoots = new Map();

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

function normalizedManagedPath(relativePath) {
  const rawPath = String(relativePath || '');
  const parts = rawPath.split(/[\\/]/);
  const normalized = path.normalize(rawPath);
  if (!rawPath || path.isAbsolute(rawPath) || rawPath.includes('\\') || parts.some((part) => !part || part === '.' || part === '..') || normalized === '.' || normalized === '..' || normalized.startsWith('..' + path.sep)) {
    throw guidanceError('Terrace managed artifact paths must stay inside .terrace/.', {
      code: 'MANAGED_ARTIFACT_PATH_UNSAFE',
      file: rawPath || '.terrace',
      why_blocked: 'The artifact path is empty, absolute, or contains an unsafe path segment.',
      next_command: 'Use a normalized path relative to .terrace/.',
      remediation: 'Use a Terrace-managed relative artifact path without traversal segments.'
    });
  }
  return normalized;
}

function displayPath(relativePath) {
  return '.terrace/' + relativePath.split(path.sep).join('/');
}

function artifactError(code, relativePath, message, details) {
  return guidanceError(message, {
    code,
    file: displayPath(relativePath),
    next_command: 'Run `terrace doctor` after resolving the managed-artifact issue.',
    remediation: 'Resolve the managed-artifact issue before retrying the command.',
    ...details
  });
}

function unsafeManagedPath(relativePath, reason) {
  throw artifactError('MANAGED_ARTIFACT_PATH_UNSAFE', relativePath, 'Refusing to use unsafe Terrace managed artifact ' + displayPath(relativePath) + '.', {
    why_blocked: reason,
    remediation: 'Replace the symlink or unexpected filesystem object with an ordinary Terrace-managed path, then retry.'
  });
}

function directoryIdentity(stat) {
  return { dev: stat.dev, ino: stat.ino };
}

function sameDirectoryIdentity(stat, identity) {
  return Boolean(stat && identity && !stat.isSymbolicLink() && stat.isDirectory() && stat.dev === identity.dev && stat.ino === identity.ino);
}

function sameFileIdentity(stat, identity) {
  return Boolean(stat && identity && !stat.isSymbolicLink() && stat.isFile() && stat.dev === identity.dev && stat.ino === identity.ino);
}

function withPinnedDirectory(directory, identity, onUnsafe, action) {
  if (action && action.constructor && action.constructor.name === 'AsyncFunction') {
    const error = new Error('Terrace managed-artifact directory operations must not start asynchronous work.');
    error.code = 'MANAGED_ARTIFACT_ASYNC_UNSUPPORTED';
    throw error;
  }
  let previousIdentity;
  let previousCanonicalDirectory;
  try {
    previousCanonicalDirectory = fs.realpathSync('.');
    const previousStat = lstatIfExists('.');
    if (!previousStat || previousStat.isSymbolicLink() || !previousStat.isDirectory()) {
      return onUnsafe('Terrace could not anchor its current working directory before managing an artifact.');
    }
    previousIdentity = directoryIdentity(previousStat);
  } catch (error) {
    return onUnsafe('Terrace could not anchor its current working directory before managing an artifact.');
  }
  let restorePath = null;
  let actionError = null;
  try {
    process.chdir(directory);
  } catch (error) {
    return onUnsafe('Terrace could not enter the managed-artifact directory without following an unsafe replacement.');
  }

  try {
    const stat = lstatIfExists('.');
    if (!sameDirectoryIdentity(stat, identity)) {
      return onUnsafe('The managed-artifact directory changed before Terrace could anchor its filesystem operation.');
    }
    restorePath = path.relative(fs.realpathSync('.'), previousCanonicalDirectory) || '.';
    const result = action();
    if (result && typeof result.then === 'function') {
      const error = new Error('Terrace managed-artifact directory operations must complete synchronously.');
      error.code = 'MANAGED_ARTIFACT_ASYNC_UNSUPPORTED';
      throw error;
    }
    return result;
  } catch (error) {
    actionError = error;
    throw error;
  } finally {
    let restoreError = null;
    try {
      if (!sameDirectoryIdentity(lstatIfExists('.'), identity)) {
        try {
          onUnsafe('The managed-artifact operation changed its pinned working directory before Terrace could restore the caller directory.');
        } catch (error) {
          restoreError = error;
        }
      }
    } catch (error) {
      restoreError = error;
    }
    try {
      process.chdir(restorePath || previousCanonicalDirectory);
    } catch (error) {
      restoreError = restoreError || error;
    }
    try {
      if (!restoreError && !sameDirectoryIdentity(lstatIfExists('.'), previousIdentity)) {
        try {
          onUnsafe('Terrace refused to leave the managed-artifact directory through a replaced caller path.');
        } catch (error) {
          restoreError = error;
        }
      }
    } catch (error) {
      restoreError = restoreError || error;
    }
    if (restoreError && !actionError) {
      throw restoreError;
    }
  }
}

function boundProjectDirectoryFor(cwd, relativePath) {
  const requestedRoot = path.resolve(cwd);
  const active = activeManagedLockRoots.get(requestedRoot);
  if (!active) {
    return null;
  }

  let currentRoot;
  try {
    currentRoot = fs.realpathSync(requestedRoot);
  } catch (error) {
    unsafeManagedPath(relativePath, 'The project root changed while a Terrace managed-artifact lock was held.');
  }
  if (currentRoot !== active.project.directory || !sameDirectoryIdentity(lstatIfExists(currentRoot), active.project.identity)) {
    unsafeManagedPath(relativePath, 'The project root changed while a Terrace managed-artifact lock was held.');
  }
  return active.project;
}

function bindManagedLockRoot(active, cwd, relativePath, resolvedRoot) {
  const requestedRoot = path.resolve(cwd);
  const currentRoot = resolvedRoot || fs.realpathSync(requestedRoot);
  if (currentRoot !== active.project.directory || !sameDirectoryIdentity(lstatIfExists(currentRoot), active.project.identity)) {
    unsafeManagedPath(relativePath, 'The project root changed while a Terrace managed-artifact lock was held.');
  }
  active.roots.add(requestedRoot);
  activeManagedLockRoots.set(requestedRoot, active);
  return active.project;
}

function clearManagedLockRoots(active) {
  for (const root of active.roots) {
    if (activeManagedLockRoots.get(root) === active) {
      activeManagedLockRoots.delete(root);
    }
  }
}

function projectDirectoryFor(cwd, relativePath) {
  const bound = boundProjectDirectoryFor(cwd, relativePath);
  if (bound) {
    return bound;
  }

  let directory;
  try {
    directory = fs.realpathSync(path.resolve(cwd));
  } catch (error) {
    unsafeManagedPath(relativePath, 'Terrace could not resolve the project directory before managing an artifact.');
  }
  const stat = lstatIfExists(directory);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    unsafeManagedPath(relativePath, 'The Terrace project directory must be a real directory before managing an artifact.');
  }
  const project = {
    directory,
    identity: directoryIdentity(stat),
    ancestors: [{ directory, identity: directoryIdentity(stat) }]
  };
  const active = activeManagedLocks.get(directory);
  if (active) {
    return bindManagedLockRoot(active, cwd, relativePath, directory);
  }
  if (activeManagedLocks.size > 0) {
    unsafeManagedPath(relativePath, 'Terrace cannot switch project roots while a managed-artifact lock is held.');
  }
  return project;
}

function assertManagedDirectoryChain(directory, relativePath) {
  for (const ancestor of directory.ancestors || [directory]) {
    if (!sameDirectoryIdentity(lstatIfExists(ancestor.directory), ancestor.identity)) {
      unsafeManagedPath(relativePath, 'A managed-artifact parent directory changed while Terrace was operating.');
    }
  }
}

function withManagedDirectoryDescriptor(directory, relativePath, action) {
  assertManagedDirectoryChain(directory, relativePath);
  return withPinnedDirectory(directory.directory, directory.identity, (reason) => unsafeManagedPath(relativePath, reason), () => {
    assertManagedDirectoryChain(directory, relativePath);
    return action();
  });
}

function managedDirectoryEntry(parent, name, relativePath, createIfMissing) {
  let stat = null;
  let created = false;
  assertManagedDirectoryChain(parent, relativePath);
  withManagedDirectoryDescriptor(parent, relativePath, () => {
    assertManagedDirectoryChain(parent, relativePath);
    stat = lstatIfExists(name);
    if (!stat && createIfMissing) {
      try {
        fs.mkdirSync(name);
        created = true;
      } catch (error) {
        if (!error || error.code !== 'EEXIST') {
          throw error;
        }
      }
      stat = lstatIfExists(name);
    }
    if (!stat) {
      return;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      unsafeManagedPath(relativePath, 'Every parent of a managed artifact must be a real directory, never a link or special filesystem object.');
    }
  });
  if (!stat) {
    return null;
  }

  const directory = path.join(parent.directory, name);
  const identity = directoryIdentity(stat);
  if (!sameDirectoryIdentity(lstatIfExists(directory), identity)) {
    unsafeManagedPath(relativePath, 'A managed-artifact directory changed while Terrace was preparing to use it.');
  }
  return {
    directory,
    identity,
    created,
    ancestors: [...(parent.ancestors || [parent]), { directory, identity }]
  };
}

function managedRootDirectory(cwd, relativePath, createIfMissing) {
  const project = projectDirectoryFor(cwd, relativePath);
  return managedDirectoryEntry(project, '.terrace', relativePath, createIfMissing);
}

function resolveManagedDirectory(cwd, relativeDirectory, options) {
  const relative = normalizedManagedPath(relativeDirectory);
  const createParents = Boolean((options || {}).createParents);
  let directory = managedRootDirectory(cwd, relative, createParents);
  if (!directory) {
    return null;
  }
  for (const part of relative.split(path.sep)) {
    directory = managedDirectoryEntry(directory, part, relative, createParents);
    if (!directory) {
      return null;
    }
  }
  return directory;
}

function assertSafeRegularFile(filePath, relativePath, missingAllowed, allowExistingLeafSymlink) {
  const stat = lstatIfExists(filePath);
  if (!stat && missingAllowed) {
    return null;
  }
  if (!stat) {
    return null;
  }
  if (stat.isSymbolicLink() && allowExistingLeafSymlink) {
    return stat;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    unsafeManagedPath(relativePath, 'Managed artifacts must be regular files, never links or special filesystem objects.');
  }
  return stat;
}

function assertResolvedFileUnchanged(resolved, current, operation) {
  if (resolved.fileStat) {
    if (!sameFileIdentity(current, resolved.fileStat)) {
      unsafeManagedPath(resolved.relative, 'The managed artifact changed while Terrace was preparing to ' + operation + '.');
    }
  } else if (current) {
    unsafeManagedPath(resolved.relative, 'A managed artifact appeared while Terrace was preparing to ' + operation + '.');
  }
  return current;
}

function resolveProjectArtifact(cwd, relativePath, options) {
  const relative = normalizedManagedPath(relativePath);
  const opts = options || {};
  const createParents = Boolean(opts.createParents);
  const allowExistingLeafSymlink = Boolean(opts.allowExistingLeafSymlink);
  const parts = relative.split(path.sep);
  const root = projectDirectoryFor(cwd, relative);
  let directory = root;
  for (const part of parts.slice(0, -1)) {
    directory = managedDirectoryEntry(directory, part, relative, createParents);
    if (!directory) {
      return {
        relative,
        filePath: path.join(root.directory, relative),
        directory: null,
        directoryIdentity: null,
        directoryAncestors: null,
        fileStat: null
      };
    }
  }

  const fileName = parts[parts.length - 1];
  let fileStat;
  withManagedDirectoryDescriptor(directory, relative, () => {
    fileStat = assertSafeRegularFile(fileName, relative, true, allowExistingLeafSymlink);
  });
  return {
    relative,
    filePath: path.join(directory.directory, fileName),
    directory: directory.directory,
    directoryIdentity: directory.identity,
    directoryAncestors: directory.ancestors,
    fileStat
  };
}

function resolveManagedArtifact(cwd, relativePath, options) {
  const relative = normalizedManagedPath(relativePath);
  const opts = options || {};
  const createParents = Boolean(opts.createParents);
  const parts = relative.split(path.sep);
  const project = projectDirectoryFor(cwd, relative);
  const terraceDirectory = path.join(project.directory, '.terrace');
  let directory = managedRootDirectory(cwd, relative, createParents);
  if (!directory) {
    return {
      relative,
      filePath: path.join(terraceDirectory, relative),
      directory: null,
      directoryIdentity: null,
      fileStat: null
    };
  }
  for (const part of parts.slice(0, -1)) {
    directory = managedDirectoryEntry(directory, part, relative, createParents);
    if (!directory) {
      return {
        relative,
        filePath: path.join(terraceDirectory, relative),
        directory: null,
        directoryIdentity: null,
        fileStat: null
      };
    }
  }

  const fileName = parts[parts.length - 1];
  let fileStat;
  withManagedDirectoryDescriptor(directory, relative, () => {
    fileStat = assertSafeRegularFile(fileName, relative, true);
  });
  const filePath = path.join(directory.directory, fileName);
  return {
    relative,
    filePath,
    directory: directory.directory,
    directoryIdentity: directory.identity,
    directoryAncestors: directory.ancestors,
    fileStat
  };
}

function assertDirectoryIdentity(resolved) {
  if (!resolved.directory) {
    unsafeManagedPath(resolved.relative, 'The parent directory is missing.');
  }
  assertManagedDirectoryChain({
    directory: resolved.directory,
    identity: resolved.directoryIdentity,
    ancestors: resolved.directoryAncestors
  }, resolved.relative);
}

function withManagedDirectory(resolved, action) {
  if (!resolved.directory) {
    unsafeManagedPath(resolved.relative, 'The parent directory is missing.');
  }
  return withManagedDirectoryDescriptor({
    directory: resolved.directory,
    identity: resolved.directoryIdentity,
    ancestors: resolved.directoryAncestors
  }, resolved.relative, action);
}

function withProjectArtifactDirectory(resolved, action) {
  if (!resolved.directory) {
    unsafeManagedPath(resolved.relative, 'The parent directory is missing.');
  }
  return withManagedDirectoryDescriptor({
    directory: resolved.directory,
    identity: resolved.directoryIdentity,
    ancestors: resolved.directoryAncestors
  }, resolved.relative, action);
}

function ensureProjectDirectory(cwd, relativeDirectory) {
  const relative = normalizedManagedPath(relativeDirectory);
  let directory = projectDirectoryFor(cwd, relative);
  let created = false;
  for (const part of relative.split(path.sep)) {
    directory = managedDirectoryEntry(directory, part, relative, true);
    created = created || directory.created;
  }
  return { directory: directory.directory, created };
}

function syncDirectory(directory) {
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

function readManagedText(cwd, relativePath) {
  const resolved = resolveManagedArtifact(cwd, relativePath, { createParents: false });
  if (!resolved.fileStat) {
    return null;
  }

  return withManagedDirectory(resolved, () => {
    let descriptor;
    try {
      assertDirectoryIdentity(resolved);
      descriptor = fs.openSync(path.basename(resolved.filePath), fs.constants.O_RDONLY | noFollowFlag());
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || !sameFileIdentity(stat, resolved.fileStat)) {
        unsafeManagedPath(resolved.relative, 'The managed artifact changed while Terrace was reading it.');
      }
      return fs.readFileSync(descriptor, 'utf8');
    } catch (error) {
      if (error && error.code === 'ELOOP') {
        unsafeManagedPath(resolved.relative, 'Terrace refuses to follow a managed-artifact symlink.');
      }
      throw error;
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
    }
  });
}

function readProjectText(cwd, relativePath, options) {
  const resolved = resolveProjectArtifact(cwd, relativePath, options);
  if (!resolved.fileStat || resolved.fileStat.isSymbolicLink()) {
    return null;
  }
  return withProjectArtifactDirectory(resolved, () => {
    let descriptor;
    try {
      descriptor = fs.openSync(path.basename(resolved.filePath), fs.constants.O_RDONLY | noFollowFlag());
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile() || !sameFileIdentity(stat, resolved.fileStat)) {
        unsafeManagedPath(resolved.relative, 'The project artifact changed while Terrace was reading it.');
      }
      return fs.readFileSync(descriptor, 'utf8');
    } catch (error) {
      if (error && error.code === 'ELOOP') {
        unsafeManagedPath(resolved.relative, 'Terrace refuses to follow a project-artifact symlink.');
      }
      throw error;
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
    }
  });
}

function readManagedJson(cwd, relativePath, fallback) {
  const text = readManagedText(cwd, relativePath);
  if (text === null) {
    return fallback;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw artifactError('MANAGED_ARTIFACT_JSON_INVALID', normalizedManagedPath(relativePath), 'Terrace managed artifact is not valid JSON: ' + displayPath(normalizedManagedPath(relativePath)) + '.', {
      why_blocked: error && error.message ? error.message : 'JSON parsing failed.',
      remediation: 'Restore valid JSON before retrying; Terrace will not silently replace damaged managed data.'
    });
  }
}

function writeAll(descriptor, text) {
  const buffer = Buffer.from(text, 'utf8');
  let offset = 0;
  while (offset < buffer.length) {
    offset += fs.writeSync(descriptor, buffer, offset, buffer.length - offset);
  }
}

function writeManagedTextUnlocked(cwd, relativePath, text) {
  const resolved = resolveManagedArtifact(cwd, relativePath, { createParents: true });
  const targetName = path.basename(resolved.filePath);
  const temporaryName = '.' + targetName + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  return withManagedDirectory(resolved, () => {
    let descriptor;
    try {
      descriptor = fs.openSync(temporaryName, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
      writeAll(descriptor, String(text));
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;

      assertDirectoryIdentity(resolved);
      assertResolvedFileUnchanged(resolved, assertSafeRegularFile(targetName, resolved.relative, true), 'replace it');
      fs.renameSync(temporaryName, targetName);
      syncDirectory('.');
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
      if (lstatIfExists(temporaryName)) {
        fs.unlinkSync(temporaryName);
      }
    }
    return resolved.filePath;
  });
}

function writeManagedText(cwd, relativePath, text) {
  return withManagedArtifactLock(cwd, () => writeManagedTextUnlocked(cwd, relativePath, text));
}

function writeProjectTextUnlocked(cwd, relativePath, text) {
  const resolved = resolveProjectArtifact(cwd, relativePath, { createParents: true });
  const targetName = path.basename(resolved.filePath);
  const temporaryName = '.' + targetName + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  return withProjectArtifactDirectory(resolved, () => {
    let descriptor;
    try {
      descriptor = fs.openSync(temporaryName, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
      writeAll(descriptor, String(text));
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;

      assertManagedDirectoryChain({
        directory: resolved.directory,
        identity: resolved.directoryIdentity,
        ancestors: resolved.directoryAncestors
      }, resolved.relative);
      assertResolvedFileUnchanged(resolved, assertSafeRegularFile(targetName, resolved.relative, true), 'replace it');
      fs.renameSync(temporaryName, targetName);
      syncDirectory('.');
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
      if (lstatIfExists(temporaryName)) {
        fs.unlinkSync(temporaryName);
      }
    }
    return resolved.filePath;
  });
}

function writeProjectText(cwd, relativePath, text, options) {
  if (options && options.lock === false) {
    return writeProjectTextUnlocked(cwd, relativePath, text);
  }
  return withManagedArtifactLock(cwd, () => writeProjectTextUnlocked(cwd, relativePath, text));
}

function writeProjectTextIfMissingUnlocked(cwd, relativePath, text, options) {
  const resolved = resolveProjectArtifact(cwd, relativePath, {
    createParents: true,
    allowExistingLeafSymlink: Boolean(options && options.allowExistingLeafSymlink)
  });
  if (resolved.fileStat) {
    return false;
  }

  const targetName = path.basename(resolved.filePath);
  const temporaryName = '.' + targetName + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  return withProjectArtifactDirectory(resolved, () => {
    let descriptor;
    try {
      if (assertSafeRegularFile(targetName, resolved.relative, true, Boolean(options && options.allowExistingLeafSymlink))) {
        return false;
      }
      descriptor = fs.openSync(temporaryName, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
      writeAll(descriptor, String(text));
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
      descriptor = undefined;

      assertManagedDirectoryChain({
        directory: resolved.directory,
        identity: resolved.directoryIdentity,
        ancestors: resolved.directoryAncestors
      }, resolved.relative);
      if (assertSafeRegularFile(targetName, resolved.relative, true, Boolean(options && options.allowExistingLeafSymlink))) {
        return false;
      }
      try {
        fs.linkSync(temporaryName, targetName);
      } catch (error) {
        if (error && error.code === 'EEXIST') {
          return false;
        }
        throw error;
      }
      syncDirectory('.');
      return true;
    } finally {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
      }
      if (lstatIfExists(temporaryName)) {
        fs.unlinkSync(temporaryName);
      }
    }
  });
}

function writeProjectTextIfMissing(cwd, relativePath, text, options) {
  if (options && options.lock === false) {
    return writeProjectTextIfMissingUnlocked(cwd, relativePath, text, options);
  }
  return withManagedArtifactLock(cwd, () => writeProjectTextIfMissingUnlocked(cwd, relativePath, text, options));
}

function writeManagedJson(cwd, relativePath, value) {
  return writeManagedText(cwd, relativePath, JSON.stringify(value, null, 2) + '\n');
}

function appendManagedText(cwd, relativePath, text) {
  return withManagedArtifactLock(cwd, () => {
    const existing = readManagedText(cwd, relativePath);
    return writeManagedText(cwd, relativePath, (existing || '') + String(text));
  });
}

function appendManagedJsonLine(cwd, relativePath, value) {
  return withManagedArtifactLock(cwd, () => {
    const existing = readManagedText(cwd, relativePath);
    if (existing !== null) {
      readManagedJsonLines(cwd, relativePath);
    }
    return writeManagedText(cwd, relativePath, (existing || '') + JSON.stringify(value) + '\n');
  });
}

function readManagedJsonLines(cwd, relativePath) {
  const text = readManagedText(cwd, relativePath);
  if (text === null) {
    return [];
  }
  const lines = text.split('\n').filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw artifactError('MANAGED_ARTIFACT_JSONL_INVALID', normalizedManagedPath(relativePath), 'Terrace event ledger contains invalid JSON on line ' + String(index + 1) + '.', {
        why_blocked: error && error.message ? error.message : 'JSON parsing failed.',
        remediation: 'Restore or repair the managed event ledger before retrying; Terrace will not discard prior event evidence.'
      });
    }
  });
}

function managedArtifactExists(cwd, relativePath) {
  return Boolean(resolveManagedArtifact(cwd, relativePath, { createParents: false }).fileStat);
}

function preflightManagedArtifacts(cwd, relativePaths) {
  return relativePaths.map((relativePath) => resolveManagedArtifact(cwd, relativePath, { createParents: false }));
}

function preflightProjectArtifacts(cwd, relativePaths) {
  return withManagedArtifactLock(cwd, () => relativePaths.map((relativePath) => resolveProjectArtifact(cwd, relativePath, { createParents: false })));
}

function removeManagedArtifactUnlocked(cwd, relativePath) {
  const resolved = resolveManagedArtifact(cwd, relativePath, { createParents: false });
  if (!resolved.fileStat) {
    return false;
  }
  return withManagedDirectory(resolved, () => {
    assertDirectoryIdentity(resolved);
    assertResolvedFileUnchanged(resolved, assertSafeRegularFile(path.basename(resolved.filePath), resolved.relative, false), 'remove it');
    fs.unlinkSync(path.basename(resolved.filePath));
    syncDirectory('.');
    return true;
  });
}

function removeManagedArtifact(cwd, relativePath) {
  return withManagedArtifactLock(cwd, () => removeManagedArtifactUnlocked(cwd, relativePath));
}

function removeProjectArtifactUnlocked(cwd, relativePath) {
  const resolved = resolveProjectArtifact(cwd, relativePath, { createParents: false });
  if (!resolved.fileStat) {
    return false;
  }
  return withProjectArtifactDirectory(resolved, () => {
    assertResolvedFileUnchanged(resolved, assertSafeRegularFile(path.basename(resolved.filePath), resolved.relative, false), 'remove it');
    fs.unlinkSync(path.basename(resolved.filePath));
    syncDirectory('.');
    return true;
  });
}

function removeProjectArtifact(cwd, relativePath) {
  return withManagedArtifactLock(cwd, () => removeProjectArtifactUnlocked(cwd, relativePath));
}

function listManagedJsonArtifacts(cwd, relativeDirectory) {
  const relative = normalizedManagedPath(relativeDirectory);
  const artifacts = [];
  const directory = resolveManagedDirectory(cwd, relative, { createParents: false });
  if (!directory) {
    return artifacts;
  }

  function collect(currentDirectory, currentRelative) {
    const childDirectories = withManagedDirectoryDescriptor(currentDirectory, currentRelative, () => {
      const directories = [];
      for (const entry of fs.readdirSync('.').sort()) {
        const childRelative = currentRelative + '/' + entry;
        const stat = lstatIfExists(entry);
        if (!stat || stat.isSymbolicLink()) {
          unsafeManagedPath(childRelative, 'Terrace refuses to traverse missing or symlinked managed artifact entries.');
        }
        if (stat.isDirectory()) {
          directories.push({
            directory: path.join(currentDirectory.directory, entry),
            identity: directoryIdentity(stat),
            ancestors: [...(currentDirectory.ancestors || [currentDirectory]), {
              directory: path.join(currentDirectory.directory, entry),
              identity: directoryIdentity(stat)
            }],
            relative: childRelative
          });
        } else if (stat.isFile()) {
          if (entry.endsWith('.json')) {
            artifacts.push(childRelative);
          }
        } else {
          unsafeManagedPath(childRelative, 'Managed artifact entries must be regular files or directories.');
        }
      }
      return directories;
    });
    for (const child of childDirectories) {
      collect(child, child.relative);
    }
  }
  collect(directory, relative);
  return artifacts;
}

function exclusiveMarkerExistsError() {
  const error = new Error('Exclusive Terrace managed-artifact marker already exists.');
  error.code = 'EEXIST';
  return error;
}

function acquireExclusiveMarker(cwd, relativePath) {
  const resolved = resolveManagedArtifact(cwd, relativePath, { createParents: true });
  if (resolved.fileStat) {
    throw exclusiveMarkerExistsError();
  }

  let descriptor;
  let identity;
  const markerName = path.basename(resolved.filePath);
  withManagedDirectory(resolved, () => {
    try {
      assertDirectoryIdentity(resolved);
      descriptor = fs.openSync(markerName, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollowFlag(), 0o600);
      const stat = fs.fstatSync(descriptor);
      if (!stat.isFile()) {
        unsafeManagedPath(resolved.relative, 'Terrace managed-artifact locks must remain regular files while held.');
      }
      identity = { dev: stat.dev, ino: stat.ino };
      writeAll(descriptor, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }) + '\n');
      fs.fsyncSync(descriptor);
      assertDirectoryIdentity(resolved);
    } catch (error) {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
        const current = lstatIfExists(markerName);
        if (sameFileIdentity(current, identity)) {
          fs.unlinkSync(markerName);
        }
      }
      throw error;
    }
  });

  return {
    release() {
      if (descriptor !== undefined) {
        fs.closeSync(descriptor);
        descriptor = undefined;
      }
      withManagedDirectory(resolved, () => {
        const current = lstatIfExists(markerName);
        if (sameFileIdentity(current, identity)) {
          fs.unlinkSync(markerName);
          syncDirectory('.');
        }
      });
    }
  };
}

function lockOwner(cwd, relativePath) {
  const text = readManagedText(cwd, relativePath);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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

function managedLockError(relativePath, owner, whyBlocked) {
  throw artifactError('MANAGED_ARTIFACT_WRITE_LOCKED', relativePath, 'Terrace managed artifacts are locked by another writer.', {
    lock: owner,
    why_blocked: whyBlocked,
    remediation: 'Wait for the active Terrace mutation to finish. Terrace reclaims a lock only when its recorded PID is confirmed absent; inspect an interrupted recovery claim before manual intervention.'
  });
}

function assertNoManagedRecovery(cwd) {
  const recovery = resolveManagedArtifact(cwd, MANAGED_RECOVERY_PATH, { createParents: false });
  if (recovery.fileStat) {
    managedLockError(MANAGED_RECOVERY_PATH, lockOwner(cwd, MANAGED_RECOVERY_PATH), 'A stale-lock recovery claim is active, so Terrace will not race it or remove its marker automatically.');
  }
}

function reclaimStaleManagedLock(cwd, expectedStat) {
  let recoveryGate;
  try {
    recoveryGate = acquireExclusiveMarker(cwd, MANAGED_RECOVERY_PATH);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      return null;
    }
    if (error && error.code === 'ELOOP') {
      unsafeManagedPath(MANAGED_RECOVERY_PATH, 'Terrace refuses to follow a managed-artifact stale-lock recovery symlink.');
    }
    throw error;
  }

  let claimed = false;
  try {
    const current = resolveManagedArtifact(cwd, MANAGED_LOCK_PATH, { createParents: false });
    if (!sameFileIdentity(current.fileStat, expectedStat)) {
      return null;
    }
    const owner = lockOwner(cwd, MANAGED_LOCK_PATH);
    if (!owner || !processIsConfirmedDead(owner.pid)) {
      return null;
    }
    withManagedDirectory(current, () => {
      assertDirectoryIdentity(current);
      const markerName = path.basename(current.filePath);
      if (!sameFileIdentity(lstatIfExists(markerName), expectedStat)) {
        return;
      }
      fs.unlinkSync(markerName);
      syncDirectory('.');
      claimed = true;
    });
    if (!claimed) {
      return null;
    }
    return recoveryGate;
  } finally {
    if (!claimed) {
      recoveryGate.release();
    }
  }
}

function acquireManagedArtifactLock(cwd) {
  const lock = resolveManagedArtifact(cwd, MANAGED_LOCK_PATH, { createParents: true });
  assertNoManagedRecovery(cwd);
  let recoveryGate = null;
  if (lock.fileStat) {
    recoveryGate = reclaimStaleManagedLock(cwd, lock.fileStat);
    if (!recoveryGate) {
      managedLockError(MANAGED_LOCK_PATH, lockOwner(cwd, MANAGED_LOCK_PATH), 'A managed-artifact lock already exists, so Terrace cannot safely merge concurrent writes.');
    }
  }

  let lockMarker = null;
  try {
    if (!recoveryGate) {
      assertNoManagedRecovery(cwd);
    }
    lockMarker = acquireExclusiveMarker(cwd, MANAGED_LOCK_PATH);
    if (recoveryGate) {
      recoveryGate.release();
      recoveryGate = null;
    }
    return lockMarker.release;
  } catch (error) {
    if (lockMarker) {
      try {
        lockMarker.release();
      } catch {
        // Preserve the failure that interrupted lock handoff; a remaining marker fails closed.
      }
      lockMarker = null;
    }
    if (recoveryGate) {
      try {
        recoveryGate.release();
      } catch {
        // Preserve the failure that interrupted lock handoff; a remaining marker fails closed.
      }
      recoveryGate = null;
    }
    if (error && error.code === 'EEXIST') {
      managedLockError(MANAGED_LOCK_PATH, lockOwner(cwd, MANAGED_LOCK_PATH), 'A managed-artifact lock appeared while Terrace was preparing the write.');
    }
    if (error && error.code === 'ELOOP') {
      unsafeManagedPath(MANAGED_LOCK_PATH, 'Terrace refuses to follow a managed-artifact lock symlink.');
    }
    throw error;
  }
}

function transactionError(relativePath, message, details) {
  return artifactError('MANAGED_ARTIFACT_TRANSACTION_INVALID', relativePath, message, {
    remediation: 'Resolve or restore the managed transaction journal before retrying the command.',
    ...details
  });
}

function normalizedTransactionEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw transactionError('transactions', 'Terrace managed-artifact transactions require at least one update.');
  }
  const normalized = entries.map((entry) => ({
    relative_path: normalizedManagedPath(entry.relative_path),
    value: entry.value
  }));
  if (new Set(normalized.map((entry) => entry.relative_path)).size !== normalized.length) {
    throw transactionError('transactions', 'Terrace managed-artifact transactions cannot update the same file twice.');
  }
  const paths = normalized.map((entry) => entry.relative_path).sort();
  const supported = (paths.length === 1 && paths[0] === PRESET_TRANSACTION_PATHS[0])
    || (paths.length === PRESET_TRANSACTION_PATHS.length && paths.every((entryPath, index) => entryPath === PRESET_TRANSACTION_PATHS[index]));
  if (!supported) {
    throw transactionError('transactions', 'Terrace only recovers the coupled preset policy and registry transaction.');
  }
  return normalized;
}

function validateJournal(journalPath, journal) {
  if (!journal || journal.kind !== PRESET_TRANSACTION_KIND || !['prepared', 'committed'].includes(journal.status) || !Array.isArray(journal.entries)) {
    throw transactionError(journalPath, 'Terrace managed-artifact transaction journal is invalid.');
  }
  const entries = [];
  for (const entry of journal.entries) {
    if (!entry || typeof entry.relative_path !== 'string' || (entry.before_text !== null && typeof entry.before_text !== 'string')) {
      throw transactionError(journalPath, 'Terrace managed-artifact transaction journal has an invalid entry.');
    }
    if (entry.before_text !== null) {
      try {
        JSON.parse(entry.before_text);
      } catch (error) {
        throw transactionError(journalPath, 'Terrace managed-artifact transaction journal contains an invalid JSON snapshot.', {
          why_blocked: error && error.message ? error.message : 'JSON parsing failed.'
        });
      }
    }
    entries.push({ relative_path: entry.relative_path });
  }
  normalizedTransactionEntries(entries);
}

function restoreTransactionEntries(cwd, entries) {
  for (const entry of [...entries].reverse()) {
    if (entry.before_text === null) {
      removeManagedArtifact(cwd, entry.relative_path);
    } else {
      writeManagedText(cwd, entry.relative_path, entry.before_text);
    }
  }
}

function recoverManagedTransactions(cwd) {
  for (const journalPath of listManagedJsonArtifacts(cwd, 'transactions')) {
    if (!/^transactions\/preset-install-[0-9a-f-]+\.json$/.test(journalPath)) {
      throw transactionError(journalPath, 'Terrace refuses to replay an unrecognized managed-artifact transaction journal.');
    }
    const journal = readManagedJson(cwd, journalPath, null);
    validateJournal(journalPath, journal);
    if (journal.status === 'prepared') {
      restoreTransactionEntries(cwd, journal.entries);
    }
    removeManagedArtifact(cwd, journalPath);
  }
}

function withManagedArtifactLock(cwd, action) {
  const project = projectDirectoryFor(cwd, MANAGED_LOCK_PATH);
  const key = project.directory;
  const active = activeManagedLocks.get(key);
  if (active) {
    active.depth += 1;
    try {
      const result = action();
      if (result && typeof result.then === 'function') {
        artifactError('MANAGED_ARTIFACT_ASYNC_UNSUPPORTED', MANAGED_LOCK_PATH, 'Terrace managed-artifact writes must finish synchronously while their lock is held.', {
          why_blocked: 'The current managed-artifact lock protocol is synchronous and cannot safely release around a pending Promise.'
        });
      }
      return result;
    } finally {
      active.depth -= 1;
    }
  }

  const context = { depth: 1, project, roots: new Set() };
  activeManagedLocks.set(key, context);
  let release = null;
  let actionError = null;
  try {
    bindManagedLockRoot(context, cwd, MANAGED_LOCK_PATH, key);
    release = acquireManagedArtifactLock(cwd);
    recoverManagedTransactions(cwd);
    const result = action();
    if (result && typeof result.then === 'function') {
      artifactError('MANAGED_ARTIFACT_ASYNC_UNSUPPORTED', MANAGED_LOCK_PATH, 'Terrace managed-artifact writes must finish synchronously while their lock is held.', {
        why_blocked: 'The current managed-artifact lock protocol is synchronous and cannot safely release around a pending Promise.'
      });
    }
    return result;
  } catch (error) {
    actionError = error;
    throw error;
  } finally {
    clearManagedLockRoots(context);
    activeManagedLocks.delete(key);
    if (release) {
      try {
        release();
      } catch (releaseError) {
        if (!actionError) {
          throw releaseError;
        }
      }
    }
  }
}

function writeManagedJsonTransactionUnlocked(cwd, entries) {
  const updates = normalizedTransactionEntries(entries);
  preflightManagedArtifacts(cwd, updates.map((entry) => entry.relative_path));
  const journalPath = 'transactions/preset-install-' + crypto.randomUUID() + '.json';
  const journal = {
    kind: PRESET_TRANSACTION_KIND,
    status: 'prepared',
    created_at: new Date().toISOString(),
    entries: updates.map((entry) => ({
      relative_path: entry.relative_path,
      before_text: readManagedText(cwd, entry.relative_path)
    }))
  };
  writeManagedJson(cwd, journalPath, journal);

  let committed = false;
  try {
    for (const update of updates) {
      writeManagedJson(cwd, update.relative_path, update.value);
    }
    writeManagedJson(cwd, journalPath, {
      ...journal,
      status: 'committed',
      committed_at: new Date().toISOString()
    });
    committed = true;
    removeManagedArtifact(cwd, journalPath);
  } catch (error) {
    if (!committed) {
      try {
        restoreTransactionEntries(cwd, journal.entries);
        removeManagedArtifact(cwd, journalPath);
      } catch (recoveryError) {
        throw artifactError('MANAGED_ARTIFACT_TRANSACTION_RECOVERY_REQUIRED', journalPath, 'Terrace managed-artifact transaction failed and automatic recovery also failed.', {
          transaction_error: error && error.message ? error.message : String(error),
          recovery_error: recoveryError && recoveryError.message ? recoveryError.message : String(recoveryError),
          remediation: 'Restore the managed artifacts from the transaction journal before retrying the command.'
        });
      }
    }
    throw error;
  }
  return updates.map((entry) => displayPath(entry.relative_path));
}

function writeManagedJsonTransaction(cwd, entries) {
  return withManagedArtifactLock(cwd, () => writeManagedJsonTransactionUnlocked(cwd, entries));
}

module.exports = {
  appendManagedText,
  appendManagedJsonLine,
  ensureProjectDirectory,
  listManagedJsonArtifacts,
  managedArtifactExists,
  preflightManagedArtifacts,
  preflightProjectArtifacts,
  readProjectText,
  readManagedJson,
  readManagedJsonLines,
  readManagedText,
  removeManagedArtifact,
  removeProjectArtifact,
  resolveProjectArtifact,
  resolveManagedArtifact,
  withProjectArtifactDirectory,
  withPinnedDirectory,
  withManagedArtifactLock,
  writeManagedJsonTransaction,
  writeManagedJson,
  writeManagedText,
  writeProjectText,
  writeProjectTextIfMissing
};
