'use strict';

const { spawnSync } = require('child_process');

const result = spawnSync('pnpm', ['pack', '--dry-run', '--json', '--config.node-linker=hoisted'], {
  cwd: process.cwd(),
  encoding: 'utf8',
  shell: process.platform === 'win32'
});

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

let payload;
try {
  payload = JSON.parse(result.stdout || '{}');
} catch (error) {
  throw new Error('pnpm pack --dry-run did not return package JSON: ' + (error && error.message ? error.message : String(error)));
}

const paths = Array.isArray(payload.files) ? payload.files.map((file) => file.path) : [];
const required = [
  'src/terrace-tools.cjs',
  'scripts/terrace-corpus-eval.cjs',
  'scripts/terrace-corpus-default-config.json',
  'packages/terrace-core/src/index.cjs'
];
const missing = required.filter((file) => !paths.includes(file));
const forbidden = paths.filter((file) => file.startsWith('docs/') || file.startsWith('.agents/') || file.startsWith('.claude/'));

if (missing.length > 0 || forbidden.length > 0 || paths.length > 160) {
  throw new Error([
    'Package payload does not meet Terrace publish containment.',
    missing.length > 0 ? 'Missing runtime files: ' + missing.join(', ') + '.' : null,
    forbidden.length > 0 ? 'Forbidden repository artifacts: ' + forbidden.slice(0, 10).join(', ') + '.' : null,
    paths.length > 160 ? 'Package contains ' + String(paths.length) + ' files; limit is 160.' : null
  ].filter(Boolean).join(' '));
}

process.stdout.write('Package payload verified: ' + String(paths.length) + ' runtime files.\n');
