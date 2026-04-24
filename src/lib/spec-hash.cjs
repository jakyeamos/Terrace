'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeSpecContent(raw) {
  return raw
    .split('\n')
    .filter((line) => !/^last_updated:/.test(line))
    .filter((line) => !/^\s*$/.test(line))
    .filter((line) => !/^\s*<!--.*-->\s*$/.test(line))
    .map((line) => line.trimEnd())
    .join('\n');
}

function readSpecInput(input) {
  if (fs.existsSync(input)) {
    const resolved = fs.realpathSync(input);
    const cwd = fs.realpathSync(process.cwd());
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
      throw new Error('UNSAFE_PATH: file is outside the project root');
    }
    return fs.readFileSync(resolved, 'utf-8');
  }
  return input;
}

function computeSpecHash(input) {
  const normalized = normalizeSpecContent(readSpecInput(input));
  return crypto.createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

module.exports = { computeSpecHash };
