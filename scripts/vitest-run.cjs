'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function normalizeForwardedArgs(args) {
  return args[0] === '--' ? args.slice(1) : args;
}

function vitestBinPath() {
  const packagePath = require.resolve('vitest/package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin && packageJson.bin.vitest;
  if (typeof bin !== 'string') {
    throw new Error('Unable to locate the Vitest executable from vitest/package.json.');
  }
  return path.resolve(path.dirname(packagePath), bin);
}

function run(argv) {
  const result = spawnSync(process.execPath, [vitestBinPath(), 'run', '--reporter=verbose', ...normalizeForwardedArgs(argv)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

module.exports = {
  normalizeForwardedArgs,
  run
};
