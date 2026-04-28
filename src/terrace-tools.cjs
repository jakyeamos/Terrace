#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  initCore,
  runDoctor,
  installPreset,
  listPresets,
  installBuiltInPreset,
  loadState,
  saveState,
  transitionState,
  validateArtifacts,
  computeSpecHash,
  protectBaseline,
  baselineStatus,
  evaluatePolicy,
  addDecision,
  runAudit,
  runCiCheck,
  startSession,
  endSession,
  reconstructSession,
  migrateArtifacts,
  explainRule,
  loadRules,
  executeRoadmapItem,
  portGsdDryRun,
  portGsd
} = require('../packages/terrace-core/src/index.cjs');

const packageJson = require('../package.json');

const HELP_TEXT = [
  'Usage: terrace <command> [options]',
  '',
  'Commands:',
  '  terrace init                 Initialize Terrace state in this repo',
  '  terrace doctor               Diagnose Terrace installation health',
  '  terrace spec validate        Validate governance artifacts',
  '  terrace spec hash --file <path>',
  '  terrace audit                Run governance audit checks',
  '  terrace ci check [files...]  Run audit plus protected-change checks',
  '  terrace port gsd [--dry-run] Migrate or inventory legacy GSD artifacts',
  '  terrace rule list            List installed rule packs',
  '  terrace rule explain <id>    Explain a rule',
  '  terrace preset list          List installed presets',
  '  terrace preset install <id>  Install a preset',
  '',
  'Global options:',
  '  --help, -h       Show this help',
  '  --version, -v    Print Terrace version',
  '  --json           Print machine-readable JSON where supported'
].join('\n');

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
  if (opts.json) {
    output({ error: message, details: opts.details || null }, { json: true });
  } else {
    process.stderr.write('ERROR: ' + message + '\n');
  }
  process.exit(typeof opts.code === 'number' ? opts.code : 1);
}

function ensureSteering(cwd) {
  const steeringPath = path.resolve(cwd, '.terrace', 'steering.md');
  if (!fs.existsSync(steeringPath)) {
    fs.mkdirSync(path.dirname(steeringPath), { recursive: true });
    fs.writeFileSync(steeringPath, [
      '---',
      'version: "1.0"',
      'project: "{{PROJECT_NAME}}"',
      'phase: "{{CURRENT_PHASE}}"',
      'policy_mode: "strict"',
      '---',
      '',
      'intent: Keep spec-driven work bounded and testable.',
      'non_negotiables: Do not bypass protected behavior without a decision.',
      'scope_boundaries: Use Terrace-owned files for workflow state.',
      ''
    ].join('\n'), 'utf8');
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
  const dryRun = hasFlag(rawArgs, '--dry-run');
  const help = hasFlag(rawArgs, '--help') || hasFlag(rawArgs, '-h') || rawArgs[0] === 'help';
  const version = hasFlag(rawArgs, '--version') || hasFlag(rawArgs, '-v');
  const args = stripFlags(rawArgs, ['--json', '--force', '--yes', '--dry-run', '--help', '-h', '--version', '-v']);

  if (version) {
    output(packageJson.version, { json });
    return;
  }
  if (help || rawArgs.length === 0) {
    output(HELP_TEXT, { json: false });
    return;
  }

  const command = args[0];
  const cwd = process.cwd();

  switch (command) {
    case 'core': {
      const sub = args[1];
      if (sub === 'init') {
        output(initCore(cwd, { projectName: path.basename(cwd) }), { json });
        return;
      }
      fail('Unknown core subcommand: ' + sub + '. Use: init', { json });
      return;
    }
    case 'rule': {
      const sub = args[1];
      if (sub === 'explain') {
        const ruleId = args[2];
        if (!ruleId) {
          fail('Usage: terrace rule explain <rule-id>', { json });
        }
        output(explainRule(cwd, ruleId), { json });
        return;
      }
      if (sub === 'list') {
        output(loadRules(cwd), { json });
        return;
      }
      fail('Unknown rule subcommand: ' + sub + '. Use: explain, list', { json });
      return;
    }
    case 'quick': {
      const itemId = args[1];
      if (!itemId) {
        fail('Usage: terrace quick <roadmap-item-id>', { json });
      }
      output(executeRoadmapItem(cwd, itemId), { json });
      return;
    }
    case 'roadmap': {
      const sub = args[1];
      if (sub !== 'execute') {
        fail('Unknown roadmap subcommand: ' + sub + '. Use: execute', { json });
      }
      const itemId = args[2];
      if (!itemId) {
        fail('Usage: terrace roadmap execute <roadmap-item-id>', { json });
      }
      output(executeRoadmapItem(cwd, itemId), { json });
      return;
    }
    case 'port': {
      const sub = args[1];
      if (sub === 'gsd') {
        if (!dryRun) {
          output(portGsd(cwd, { force }), { json });
          return;
        }
        output(portGsdDryRun(cwd), { json });
        return;
      }
      fail('Unknown port subcommand: ' + sub + '. Use: gsd', { json });
      return;
    }
    case 'init': {
      output(initCore(cwd, { projectName: path.basename(cwd), force, yes }), { json });
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
      const nextStatus = args[2];
      if (!nextStatus) {
        fail('Usage: terrace phase set <workflow-status>', { json });
      }
      const updated = transitionState(loadState(cwd), nextStatus);
      saveState(cwd, updated);
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
      output(runAudit(cwd, {}), { json });
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
          const hash = computeSpecHash(args[fileIdx + 1], { cwd });
          output(json ? { hash } : hash, { json });
        } catch (error) {
          fail(error && error.message ? error.message : String(error), { json });
        }
        return;
      }
      if (sub !== 'validate') {
        fail('Unknown spec subcommand: ' + sub + '. Use: validate, hash', { json });
      }
      const result = validateArtifacts(cwd, {});
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
