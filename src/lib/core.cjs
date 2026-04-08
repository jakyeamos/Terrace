'use strict';

const fs = require('fs');
const path = require('path');

function hasFlag(args, flag) {
  return args.includes(flag);
}

function stripFlags(args, flags) {
  return args.filter((arg) => !flags.includes(arg));
}

function output(data, options) {
  const opts = options || {};
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return;
  }

  if (typeof data === 'string') {
    process.stdout.write(data + '\n');
    return;
  }

  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function fail(message, options) {
  const opts = options || {};
  const code = typeof opts.code === 'number' ? opts.code : 1;

  if (opts.json) {
    output({ error: message, details: opts.details || null }, { json: true });
  } else {
    process.stderr.write('ERROR: ' + message + '\n');
  }

  process.exit(code);
}

function resolveTerraceDir(cwd) {
  return path.resolve(cwd, '.terrace');
}

function ensureAllowedWrite(cwd, targetPath) {
  const resolvedCwd = path.resolve(cwd);
  const resolvedTarget = path.resolve(targetPath);
  const allowedRoots = [
    path.join(resolvedCwd, '.terrace'),
    path.join(resolvedCwd, 'docs')
  ];

  const allowed = allowedRoots.some((root) => {
    return resolvedTarget === root || resolvedTarget.startsWith(root + path.sep);
  });

  if (!allowed) {
    throw new Error('Write path outside allowed roots: ' + resolvedTarget);
  }

  return resolvedTarget;
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function loadConfig(cwd) {
  return readJson(path.resolve(cwd, '.terrace', 'config.json'), {});
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return { frontmatter: {}, body: content };
  }

  const end = content.indexOf('\n---', 4);
  if (end === -1) {
    return { frontmatter: {}, body: content };
  }

  const raw = content.slice(4, end).trim();
  const body = content.slice(end + 4).replace(/^\n/, '');
  const frontmatter = {};

  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    frontmatter[key] = value;
  }

  return { frontmatter, body };
}

function readTemplate(name) {
  return fs.readFileSync(path.resolve(__dirname, '..', 'templates', name), 'utf8');
}

module.exports = {
  hasFlag,
  stripFlags,
  output,
  fail,
  resolveTerraceDir,
  ensureAllowedWrite,
  readJson,
  writeJson,
  loadConfig,
  parseFrontmatter,
  readTemplate
};
