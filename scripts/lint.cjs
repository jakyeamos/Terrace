'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.env.TERRACE_LINT_ROOT ? path.resolve(process.env.TERRACE_LINT_ROOT) : path.resolve(__dirname, '..');
const CHECK_DIRS = process.env.TERRACE_LINT_DIRS
  ? process.env.TERRACE_LINT_DIRS.split(',').map((dir) => dir.trim()).filter(Boolean)
  : ['.'];
const AUDITED_EXTENSIONS = new Set(['.cjs', '.ts', '.json', '.md']);
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const FAILURES = [];

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      walk(fullPath, files);
    } else if (entry.isFile() && AUDITED_EXTENSIONS.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
}

const files = [];
for (const relDir of CHECK_DIRS) {
  walk(path.join(ROOT, relDir), files);
}

for (const filePath of files) {
  if (filePath.endsWith('.cjs')) {
    const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
    if (result.status !== 0) {
      FAILURES.push(result.stderr || result.stdout || filePath);
    }
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('\r\n')) {
    FAILURES.push(`${path.relative(ROOT, filePath)}: CRLF line endings`);
  }
  if (filePath.endsWith('.cjs')) {
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const normalizedLine = line.replace(/\r$/, '');
      if (/\s$/.test(normalizedLine) && normalizedLine.length > 0) {
        FAILURES.push(`${path.relative(ROOT, filePath)}:${index + 1}: trailing whitespace`);
      }
    });
  }
}

if (FAILURES.length > 0) {
  process.stderr.write(FAILURES.join('\n') + '\n');
  process.exit(1);
}

process.stdout.write(`Checked ${files.length} text files.\n`);
