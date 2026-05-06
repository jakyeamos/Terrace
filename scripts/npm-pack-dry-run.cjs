'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cacheDir = path.join(os.tmpdir(), 'terrace-npm-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const result = spawnSync('npm', ['pack', '--dry-run', '--cache', cacheDir], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (result.error) {
  throw result.error;
}

process.exit(typeof result.status === 'number' ? result.status : 1);
