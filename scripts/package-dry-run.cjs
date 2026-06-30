'use strict';

const { spawnSync } = require('child_process');

const result = spawnSync('pnpm', ['pack', '--dry-run', '--config.node-linker=hoisted'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
