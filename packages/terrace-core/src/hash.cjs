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

function readSpecInput(input, cwd) {
  if (fs.existsSync(input)) {
    const resolved = fs.realpathSync(input);
    const root = fs.realpathSync(cwd || process.cwd());
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error('UNSAFE_PATH: file is outside the project root');
    }
    return fs.readFileSync(resolved, 'utf8');
  }
  return input;
}

function computeSpecHash(input, options) {
  const opts = options || {};
  const normalized = normalizeSpecContent(readSpecInput(input, opts.cwd));
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

module.exports = {
  normalizeSpecContent,
  computeSpecHash
};
