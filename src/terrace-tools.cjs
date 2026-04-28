#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { hasFlag, stripFlags, output, fail, readJson, writeJson, loadConfig, readTemplate } = require('./lib/core.cjs');
const { cmdInit } = require('./lib/init.cjs');
const { runDoctor } = require('./lib/doctor.cjs');
const { installPreset, listPresets } = require('./lib/preset.cjs');
const { installBuiltInPreset } = require('./lib/built-in-presets.cjs');
const { setPhase } = require('./lib/lifecycle.cjs');
const { validateArtifacts } = require('./lib/validate.cjs');
const { computeSpecHash } = require('./lib/spec-hash.cjs');
const { protectBaseline, baselineStatus, enforceProtectedChanges } = require('./lib/baseline.cjs');
const { evaluatePolicy } = require('./lib/policy.cjs');
const { addDecision } = require('./lib/decision-log.cjs');
const { runAudit } = require('./lib/audit.cjs');
const { runCiCheck } = require('./lib/ci.cjs');
const { startSession, endSession, reconstructSession } = require('./lib/session.cjs');
const { migrateArtifacts } = require('./lib/migrate.cjs');

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
        if (id.startsWith('terrace-')) {
          output(installBuiltInPreset(cwd, id, { force }), { json });
          return;
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
    case 'baseline': {
      const sub = args[1];
      if (sub === 'protect') {
        const filePath = args[2];
        const specIdx = args.indexOf('--spec-ref');
        if (!filePath || specIdx === -1 || !args[specIdx + 1]) {
          fail('Usage: terrace baseline protect <file> --spec-ref <SPEC-ID>', { json });
        }
        output(protectBaseline(cwd, filePath, args[specIdx + 1], {}), { json });
        return;
      }
      if (sub === 'status') {
        output(baselineStatus(cwd), { json });
        return;
      }
      fail('Unknown baseline subcommand: ' + sub + '. Use: protect, status', { json });
      return;
    }
    case 'decision': {
      const sub = args[1];
      if (sub !== 'log') {
        fail('Unknown decision subcommand: ' + sub + '. Use: log', { json });
      }
      const specIdx = args.indexOf('--spec-ref');
      if (specIdx === -1 || !args[specIdx + 1]) {
        fail('Usage: terrace decision log --spec-ref <SPEC-ID>', { json });
      }
      output(addDecision(cwd, { specRef: args[specIdx + 1] }), { json });
      return;
    }
    case 'audit': {
      output(runAudit(cwd), { json });
      return;
    }
    case 'ci': {
      const sub = args[1];
      if (sub !== 'check') {
        fail('Unknown ci subcommand: ' + sub + '. Use: check', { json });
      }
      output(runCiCheck(cwd, args.slice(2)), { json });
      return;
    }
    case 'policy': {
      output(evaluatePolicy(cwd), { json });
      return;
    }
    case 'session': {
      const sub = args[1];
      if (sub === 'start') {
        output(startSession(cwd, {}), { json });
        return;
      }
      if (sub === 'end') {
        output(endSession(cwd, {}), { json });
        return;
      }
      if (sub === 'reconstruct') {
        output(reconstructSession(cwd), { json });
        return;
      }
      fail('Unknown session subcommand: ' + sub + '. Use: start, end, reconstruct', { json });
      return;
    }
    case 'migrate': {
      output(migrateArtifacts(cwd, '1.0'), { json });
      return;
    }
    case 'security': {
      const sub = args[1];
      if (sub !== 'check') {
        fail('Unknown security subcommand: ' + sub + '. Use: check', { json });
      }
      output({
        checks: ['semgrep', 'trivy', 'osv'],
        status: 'not_configured',
        message: 'terrace-security metadata is installed; external scanners are intentionally not invoked by the stdlib CLI.'
      }, { json });
      return;
    }
    case 'spec': {
      const sub = args[1];
      if (sub === 'hash') {
        const fileIdx = args.indexOf('--file');
        if (fileIdx === -1 || !args[fileIdx + 1]) {
          fail('Usage: terrace spec hash --file <path>', { json });
        }
        try {
          const hash = computeSpecHash(args[fileIdx + 1]);
          output(json ? { hash } : hash, { json });
        } catch (error) {
          fail(error && error.message ? error.message : String(error), { json });
        }
        return;
      }
      if (sub !== 'validate') {
        fail('Unknown spec subcommand: ' + sub + '. Use: validate, hash', { json });
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
