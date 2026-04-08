#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { hasFlag, stripFlags, output, fail, readJson, writeJson, loadConfig, readTemplate } = require('./lib/core.cjs');
const { cmdInit } = require('./lib/init.cjs');
const { runDoctor } = require('./lib/doctor.cjs');
const { installPreset, listPresets } = require('./lib/preset.cjs');
const { setPhase } = require('./lib/lifecycle.cjs');
const { validateArtifacts } = require('./lib/validate.cjs');

function ensureState(cwd) {
  const statePath = path.resolve(cwd, '.terrace', 'project-state.json');
  const state = readJson(statePath, null);
  if (!state) {
    throw new Error('Missing .terrace/project-state.json. Run `terrace init` first.');
  }
  return { statePath, state };
}

function ensureSteering(cwd) {
  const steeringPath = path.resolve(cwd, '.terrace', 'steering.md');
  if (!fs.existsSync(steeringPath)) {
    fs.mkdirSync(path.dirname(steeringPath), { recursive: true });
    fs.writeFileSync(steeringPath, readTemplate('steering.md'), 'utf8');
  }
  return { path: steeringPath };
}

function installPresetFromId(cwd, id, force) {
  const manifest = {
    id,
    name: id,
    version: '1.0',
    category: 'testing',
    effect: 'Read-only',
    agents: [],
    workflows: [],
    fragments: [],
    flags: []
  };
  return installPreset(cwd, manifest, { force });
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const json = hasFlag(rawArgs, '--json');
  const force = hasFlag(rawArgs, '--force');
  const yes = hasFlag(rawArgs, '--yes');
  const args = stripFlags(rawArgs, ['--json', '--force', '--yes']);

  const command = args[0];
  const cwd = process.cwd();

  switch (command) {
    case 'init': {
      output(cmdInit(cwd, { force, yes }), { json });
      return;
    }
    case 'doctor': {
      output(runDoctor(cwd), { json });
      return;
    }
    case 'preset': {
      const sub = args[1];
      if (sub === 'list') {
        output(listPresets(cwd), { json });
        return;
      }
      if (sub === 'install') {
        const id = args[2];
        if (!id) {
          fail('Usage: terrace preset install <id>', { json });
        }
        output(installPresetFromId(cwd, id, force), { json });
        return;
      }
      fail('Unknown preset subcommand: ' + sub, { json });
      return;
    }
    case 'phase': {
      const sub = args[1];
      if (sub !== 'set') {
        fail('Unknown phase subcommand: ' + sub + '. Use: set', { json });
      }
      const nextPhase = args[2];
      if (!nextPhase) {
        fail('Usage: terrace phase set <phase>', { json });
      }
      const { statePath, state } = ensureState(cwd);
      const updated = setPhase(state, nextPhase);
      writeJson(statePath, updated);
      output(updated, { json });
      return;
    }
    case 'steering': {
      output(ensureSteering(cwd), { json });
      return;
    }
    case 'spec': {
      const sub = args[1];
      if (sub !== 'validate') {
        fail('Unknown spec subcommand: ' + sub + '. Use: validate', { json });
      }
      const result = validateArtifacts(cwd, loadConfig(cwd));
      output(result, { json });
      if (result.blocking.length > 0) {
        process.exitCode = 1;
      }
      return;
    }
    default:
      fail('Unknown command: ' + command, { json });
  }
}

main().catch((error) => {
  const rawArgs = process.argv.slice(2);
  const json = rawArgs.includes('--json');
  fail(error && error.message ? error.message : String(error), { json });
});
