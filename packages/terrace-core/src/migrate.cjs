'use strict';

const path = require('path');
const { preflightProjectArtifacts, readProjectText, resolveProjectArtifact, withManagedArtifactLock, writeProjectText } = require('./managed-artifacts.cjs');

const MIGRATED_ARTIFACTS = [
  'docs/prd/PRD.md',
  'docs/spec/COMPILED-SPEC.md',
  'docs/testing/TEST-ARCH.md',
  'docs/spec/DECISION-LOG.md'
];

function addSchemaVersion(content, version) {
  if (content.includes('schema_version:')) {
    return content;
  }
  if (content.startsWith('---\n')) {
    return content.replace('---\n', '---\nschema_version: "' + version + '"\n');
  }
  return '---\nschema_version: "' + version + '"\n---\n\n' + content;
}

function migrateArtifacts(cwd, version) {
  const targetVersion = version || '1.0';
  const outputPaths = new Map(MIGRATED_ARTIFACTS.map((relativePath) => [relativePath, path.resolve(cwd, relativePath)]));
  return withManagedArtifactLock(cwd, () => {
    preflightProjectArtifacts(cwd, MIGRATED_ARTIFACTS);
    const changed = [];
    const skipped = [];

    for (const relPath of MIGRATED_ARTIFACTS) {
      const artifact = resolveProjectArtifact(cwd, relPath, { createParents: false });
      if (!artifact.fileStat) {
        skipped.push({ file: outputPaths.get(relPath), reason: 'missing' });
        continue;
      }
      const before = readProjectText(cwd, relPath);
      const after = addSchemaVersion(before, targetVersion);
      if (before === after) {
        skipped.push({ file: outputPaths.get(relPath), reason: 'already_current' });
        continue;
      }
      writeProjectText(cwd, relPath, after);
      changed.push({ file: outputPaths.get(relPath), from: 'unversioned', to: targetVersion });
    }

    return { changed, skipped };
  });
}

module.exports = {
  addSchemaVersion,
  migrateArtifacts
};
