'use strict';

const fs = require('fs');
const path = require('path');

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
  const changed = [];
  const skipped = [];

  for (const relPath of MIGRATED_ARTIFACTS) {
    const filePath = path.resolve(cwd, relPath);
    if (!fs.existsSync(filePath)) {
      skipped.push({ file: filePath, reason: 'missing' });
      continue;
    }
    const before = fs.readFileSync(filePath, 'utf8');
    const after = addSchemaVersion(before, targetVersion);
    if (before === after) {
      skipped.push({ file: filePath, reason: 'already_current' });
      continue;
    }
    fs.writeFileSync(filePath, after, 'utf8');
    changed.push({ file: filePath, from: 'unversioned', to: targetVersion });
  }

  return { changed, skipped };
}

module.exports = {
  addSchemaVersion,
  migrateArtifacts
};
