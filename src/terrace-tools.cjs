#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  loadState,
  saveState,
  transitionState,
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  phaseCompleteWorkflow,
  alignFeature,
  interrogateFeature,
  interrogateMode,
  mapCodebase,
  designFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  uiImportStitch,
  uiPlanRefresh,
  uiDiff,
  shipPrepare,
  shipCheck,
  releasePreflight,
  reportRead,
  reportUpdate,
  reportOpen,
  reportHistory,
  reportCeremony,
  renderCliHelp,
  renderCliHelpJson
} = require('../packages/terrace-core/src/index.cjs');
const { resolveCommandDispatch } = require('../packages/terrace-core/src/command-parser.cjs');
const { createPhaseCliRouter } = require('./phase-cli-router.cjs');
const { createSeniorCycleCliRouter } = require('./senior-cycle-cli-router.cjs');
const { createReleaseReadinessCliRouter } = require('./release-readiness-cli-router.cjs');
const { createReportCliRouter } = require('./report-cli-router.cjs');
const { createLegacyCliRouter } = require('./legacy-cli-router.cjs');

const packageJson = require('../package.json');

const HELP_TEXT = renderCliHelp();
const phaseCliRouter = createPhaseCliRouter({
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  phaseCompleteWorkflow,
  loadState,
  saveState,
  transitionState
});
const seniorCycleCliRouter = createSeniorCycleCliRouter({
  optionsFor: seniorOptions,
  alignFeature,
  interrogateFeature,
  interrogateMode,
  mapCodebase,
  designFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  uiImportStitch,
  uiPlanRefresh,
  uiDiff
});
const releaseReadinessCliRouter = createReleaseReadinessCliRouter({
  releasePreflight,
  shipCheck,
  shipPrepare,
  releaseOptionsFor,
  shipOptionsFor
});
const reportCliRouter = createReportCliRouter({
  reportRead,
  reportUpdate,
  reportOpen,
  reportHistory,
  reportCeremony
});
const legacyCliRouter = createLegacyCliRouter();
const ROUTERS_BY_OWNER = Object.freeze({
  phase: phaseCliRouter,
  'senior-cycle': seniorCycleCliRouter,
  'release-readiness': releaseReadinessCliRouter,
  report: reportCliRouter,
  legacy: legacyCliRouter
});

function hasFlag(args, flag) {
  return args.includes(flag);
}

function stripFlags(args, flags) {
  return args.filter((arg) => !flags.includes(arg));
}

function optionValue(rawArgs, name) {
  const index = rawArgs.indexOf(name);
  return index === -1 ? null : rawArgs[index + 1] || null;
}

function shipModeOption(rawArgs) {
  if (hasFlag(rawArgs, '--mode')) {
    return optionValue(rawArgs, '--mode') || '';
  }
  return hasFlag(rawArgs, '--fast') ? 'fast' : hasFlag(rawArgs, '--local') ? 'local' : hasFlag(rawArgs, '--full') ? 'full' : undefined;
}

function releaseOptionsFor(rawArgs) {
  return {
    targetVersion: optionValue(rawArgs, '--target-version'),
    runCommands: !hasFlag(rawArgs, '--static'),
    shipMode: shipModeOption(rawArgs)
  };
}

function shipOptionsFor(rawArgs) {
  return {
    mode: shipModeOption(rawArgs)
  };
}

function seniorOptions(rawArgs) {
  return {
    tier: optionValue(rawArgs, '--tier'),
    userAnswers: interrogationAnswers(rawArgs)
  };
}

function interrogationAnswers(rawArgs) {
  const inline = optionValue(rawArgs, '--answers');
  if (inline) {
    return inline;
  }
  const answersFile = optionValue(rawArgs, '--answers-file');
  if (answersFile) {
    return readFileInput(process.cwd(), answersFile);
  }
  if (hasFlag(rawArgs, '--paste-answers')) {
    return readStdinInput();
  }
  return null;
}

function readFileInput(cwd, filePath) {
  if (!filePath) {
    throw new Error('Missing input file path.');
  }
  const resolved = path.resolve(cwd, filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error('Input file not found: ' + filePath);
  }
  return fs.readFileSync(resolved, 'utf8');
}

function readStdinInput() {
  return fs.readFileSync(0, 'utf8');
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
  const human = humanBlockerOutput(data);
  if (human) {
    process.stdout.write(human + '\n');
    return;
  }
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function humanAdoptionOutput(data) {
  if (!data || data.command !== 'terrace adoption status') {
    return null;
  }
  const lines = [
    data.question || 'Can Terrace replace GSD for me yet?',
    'Answer: ' + (data.answer || (data.ready ? 'Yes.' : 'No.')),
    'Mode: ' + (data.recommended_mode || data.status_label || 'unknown'),
    'Score: ' + String(data.score) + '/100',
    'Ready: ' + String(data.ready)
  ];
  const summary = data.readiness_summary || {};
  lines.push('');
  lines.push('Evidence:');
  lines.push('- Workflow continuity: ' + (summary.workflow_continuity ? 'yes' : 'no'));
  if (Object.prototype.hasOwnProperty.call(summary, 'gsd_command_surface')) {
    lines.push('- GSD-compatible command surface: ' + String(summary.gsd_command_surface) + ' commands');
  }
  if (Object.prototype.hasOwnProperty.call(summary, 'project_gates_detected')) {
    lines.push('- Project gates detected: ' + String(summary.project_gates_detected));
  }
  lines.push('- Agent assets complete: ' + String(Boolean(summary.agent_assets_complete)));
  lines.push('- Corpus passed: ' + String(Boolean(summary.corpus_passed)));
  lines.push('- Doctor passed: ' + String(Boolean(summary.doctor_passed)));
  lines.push('- Audit passed: ' + String(Boolean(summary.audit_passed)));

  const blockers = Array.isArray(data.blockers) ? data.blockers : [];
  lines.push('');
  lines.push('Blockers: ' + String(blockers.length));
  for (const blocker of blockers.slice(0, 5)) {
    lines.push('- ' + blocker.name + ': ' + (blocker.remediation || 'Resolve this readiness check.'));
  }

  const nextSteps = Array.isArray(data.next_steps) ? data.next_steps : [];
  if (nextSteps.length > 0) {
    lines.push('');
    lines.push('Next commands:');
    for (const step of nextSteps.slice(0, 5)) {
      lines.push('- ' + step.command + (step.why ? ' - ' + step.why : ''));
    }
  }
  return lines.join('\n');
}

function fail(message, options) {
  const opts = options || {};
  if (opts.json) {
    const details = opts.details || null;
    output({
      error: message,
      details,
      next_command: opts.next_command || (details && details.next_command) || null,
      remediation: opts.remediation || (details && details.remediation) || null
    }, { json: true });
  } else {
    process.stderr.write('ERROR: ' + message + '\n');
    const details = opts.details || {};
    const nextCommand = opts.next_command || details.next_command;
    const remediation = opts.remediation || details.remediation;
    const file = opts.file || details.file;
    if (file) {
      process.stderr.write('File: ' + file + '\n');
    }
    if (remediation) {
      process.stderr.write('Fix: ' + remediation + '\n');
    }
    if (nextCommand) {
      process.stderr.write('Next: ' + nextCommand + '\n');
    }
  }
  process.exit(typeof opts.code === 'number' ? opts.code : 1);
}

function humanBlockerOutput(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const adoption = humanAdoptionOutput(data);
  if (adoption) {
    return adoption;
  }
  const blockers = Array.isArray(data.blockers) ? data.blockers : Array.isArray(data.blocking) ? data.blocking : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  if (data.passed !== false && blockers.length === 0 && warnings.length === 0) {
    return null;
  }
  const lines = [];
  if (Object.prototype.hasOwnProperty.call(data, 'passed')) {
    lines.push('Passed: ' + String(data.passed));
  }
  if (data.mode) {
    lines.push('Mode: ' + data.mode);
  }
  lines.push('Blockers: ' + String(blockers.length));
  lines.push('Warnings: ' + String(warnings.length));
  if (Array.isArray(data.categories)) {
    const deadCode = data.categories.find((category) => category && category.category === 'dead_code');
    if (deadCode) {
      const deadCodeBlocker = Array.isArray(deadCode.blocking) ? deadCode.blocking[0] : null;
      const deadCodeWarning = Array.isArray(deadCode.warnings) ? deadCode.warnings[0] : null;
      const signal = deadCodeBlocker || deadCodeWarning;
      if (signal) {
        lines.push('Dead code: ' + (deadCodeBlocker ? 'blocked' : 'warning') + ' - ' + (signal.code || 'DEAD_CODE') + ': ' + (signal.message || 'Dead-code readiness needs attention.'));
        if (signal.remediation) {
          lines.push('  Fix: ' + signal.remediation);
        }
        if (signal.next_command) {
          lines.push('  Next: ' + signal.next_command);
        }
      } else {
        lines.push('Dead code: ' + (deadCode.skipped ? 'skipped' : deadCode.passed ? 'passed' : 'failed'));
      }
    }
  }
  for (const blocker of blockers.slice(0, 3)) {
    lines.push('- ' + (blocker.code || 'BLOCKED') + ': ' + (blocker.message || 'Terrace gate is blocked.'));
    if (blocker.file || blocker.artifact) {
      lines.push('  File: ' + (blocker.file || blocker.artifact));
    }
    if (blocker.remediation) {
      lines.push('  Fix: ' + blocker.remediation);
    }
    if (blocker.next_command) {
      lines.push('  Next: ' + blocker.next_command);
    }
  }
  if (blockers.length === 0) {
    for (const warning of warnings.slice(0, 3)) {
      lines.push('- ' + (warning.code || 'WARNING') + ': ' + (warning.message || 'Terrace gate warning.'));
      if (warning.remediation) {
        lines.push('  Fix: ' + warning.remediation);
      }
      if (warning.next_command) {
        lines.push('  Next: ' + warning.next_command);
      }
    }
  }
  if (data.next_command) {
    lines.push('Next: ' + data.next_command);
  }
  if (data.recheck_command) {
    lines.push('Recheck: ' + data.recheck_command);
  }
  return lines.join('\n');
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const json = hasFlag(rawArgs, '--json');
  const apply = hasFlag(rawArgs, '--apply');
  const help = hasFlag(rawArgs, '--help') || hasFlag(rawArgs, '-h') || rawArgs[0] === 'help';
  const version = hasFlag(rawArgs, '--version') || hasFlag(rawArgs, '-v');
  const args = stripFlags(rawArgs, ['--json', '--force', '--yes', '--dry-run', '--apply', '--help', '-h', '--version', '-v']);

  if (version) {
    output(json ? {
      command: 'terrace',
      package: packageJson.name,
      version: packageJson.version
    } : packageJson.version, { json });
    return;
  }
  if (help || args.length === 0) {
    output(json ? renderCliHelpJson() : HELP_TEXT, { json });
    return;
  }

  if (apply && args[0] !== 'do') {
    fail('--apply is only supported with terrace do --apply <plan-token>.', { json });
    return;
  }

  const dispatch = resolveCommandDispatch({ args, raw_args: rawArgs });
  if (dispatch.kind === 'unknown') {
    fail('Unknown command: ' + dispatch.token, { json });
    return;
  }
  if (dispatch.kind === 'ambiguous') {
    fail('Ambiguous command route: ' + dispatch.candidates.join(', '), { json });
    return;
  }
  const router = ROUTERS_BY_OWNER[dispatch.owner];
  if (!router) {
    fail('No CLI route owner is registered for: ' + dispatch.owner, { json });
    return;
  }
  const route = router.route({ ...dispatch, cwd: process.cwd(), json });
  if (!route.handled) {
    fail('No CLI handler is registered for: ' + (dispatch.command_id || dispatch.family_id), { json });
    return;
  }
  if (route.kind === 'error') {
    fail(route.message, { json });
    return;
  }
  if (route.kind === 'passthrough') {
    if (route.exitCode) process.exitCode = route.exitCode;
    return;
  }
  output(route.data, { json });
  if (route.exitCode) {
    process.exitCode = route.exitCode;
  }
}

main().catch((error) => {
  const rawArgs = process.argv.slice(2);
  const json = rawArgs.includes('--json');
  fail(error && error.message ? error.message : String(error), {
    json,
    details: error && error.details ? error.details : null,
    next_command: error && error.next_command ? error.next_command : null,
    remediation: error && error.remediation ? error.remediation : null,
    file: error && error.file ? error.file : null
  });
});
