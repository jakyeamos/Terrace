'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHECK_DIRS = ['src', 'packages/terrace-core/src', 'scripts'];
const FAILURES = [];

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
}

const files = [];
for (const relDir of CHECK_DIRS) {
  walk(path.join(ROOT, relDir), files);
}

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    FAILURES.push(result.stderr || result.stdout || filePath);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (/\s$/.test(line) && line.length > 0) {
      FAILURES.push(`${path.relative(ROOT, filePath)}:${index + 1}: trailing whitespace`);
    }
  });
}

if (FAILURES.length > 0) {
  process.stderr.write(FAILURES.join('\n') + '\n');
  process.exit(1);
}

process.stdout.write(`Checked ${files.length} CommonJS files.\n`);
