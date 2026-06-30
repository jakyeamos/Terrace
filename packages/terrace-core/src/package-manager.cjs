'use strict';

const fs = require('fs');
const path = require('path');

function readPackageJson(cwd) {
  const packagePath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function packageManagerFor(cwd) {
  const pkg = readPackageJson(cwd);
  const configured = typeof pkg.packageManager === 'string' ? pkg.packageManager : '';
  if (configured.startsWith('pnpm@')) {
    return 'pnpm';
  }
  if (configured.startsWith('yarn@')) {
    return 'yarn';
  }
  if (configured.startsWith('npm@')) {
    return 'npm';
  }
  if (fs.existsSync(path.resolve(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.resolve(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.resolve(cwd, 'package-lock.json'))) {
    return 'npm';
  }
  return 'npm';
}

function runCommandFor(packageManager, scriptName) {
  if (packageManager === 'yarn') {
    return ['yarn', scriptName];
  }
  return [packageManager, 'run', scriptName];
}

function scriptCommand(packageManager, scriptName) {
  return runCommandFor(packageManager, scriptName).join(' ');
}

function testCommand(packageManager) {
  return packageManager === 'yarn' ? 'yarn test' : packageManager + ' test';
}

function setScriptCommand(packageManager, scriptName, command) {
  if (packageManager === 'yarn') {
    return 'yarn pkg set scripts.' + scriptName + '="' + command + '"';
  }
  return packageManager + ' pkg set scripts["' + scriptName + '"]="' + command + '"';
}

function auditCommandFor(packageManager) {
  if (packageManager === 'pnpm') {
    return {
      file: 'pnpm-lock.yaml',
      command: ['pnpm', 'audit', '--prod', '--json'],
      display: 'pnpm audit --prod'
    };
  }
  if (packageManager === 'yarn') {
    return {
      file: 'yarn.lock',
      command: ['yarn', 'npm', 'audit', '--environment', 'production', '--json'],
      display: 'yarn npm audit --environment production'
    };
  }
  return {
    file: 'package-lock.json',
    command: ['npm', 'audit', '--omit=dev', '--json'],
    display: 'npm audit --omit=dev'
  };
}

function packageDryRunCommand(packageManager) {
  if (packageManager === 'pnpm') {
    return 'pnpm pack --dry-run';
  }
  if (packageManager === 'yarn') {
    return 'yarn pack';
  }
  return 'npm pack --dry-run';
}

module.exports = {
  packageManagerFor,
  runCommandFor,
  scriptCommand,
  testCommand,
  setScriptCommand,
  auditCommandFor,
  packageDryRunCommand
};
