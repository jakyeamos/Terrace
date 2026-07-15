#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
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
  portGsd,
  portGsdCompare,
  portGsdVerifyParity,
  portGsdImportRoadmap,
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
  phaseCompleteWorkflow,
  resumeWorkflow,
  nextWorkflow,
  historySummary,
  backlogList,
  backlogAdd,
  quickList,
  quickShow,
  quickPlan,
  quickExecute,
  quickComplete,
  shipPrepare,
  routePlainText,
  applyPlainTextIntentPlan,
  autonomousWorkflow,
  discoverProjectCommands,
  alignFeature,
  interrogateFeature,
  mapCodebase,
  designFeature,
  testPlanFeature,
  observeFeature,
  validateProdFeature,
  cleanupFeature,
  uiImportStitch,
  uiPlanRefresh,
  uiDiff,
  shipCheck,
  releasePreflight,
  reportRead,
  reportUpdate,
  reportOpen,
  reportHistory,
  reportCeremony,
  createHandoff,
  addDebt,
  listDebt,
  auditDebt,
  resolveDebt,
  preflightFeature,
  docuFeature,
  testEval,
  interrogateMode,
  reviewAi,
  ruleAdd,
  ruleAudit,
  addWaiver,
  backfill,
  workstreamsPlan,
  designSourceImport,
  designSourceDiff,
  runSecurityCheck,
  adoptionStatus,
  workbenchStatus,
  workbenchPrepare,
  settingsShow,
  settingsSetEffort,
  newProjectFromPrd,
  importFeaturePrd,
  installAgentBootstrap,
  installGlobalAgentBootstrap,
  refreshPlanningPackage,
  renderCliHelp
} = require('../packages/terrace-core/src/index.cjs');
const { managedArtifactExists, writeManagedText } = require('../packages/terrace-core/src/managed-artifacts.cjs');
const { createPhaseCliRouter } = require('./phase-cli-router.cjs');
const { createSeniorCycleCliRouter } = require('./senior-cycle-cli-router.cjs');
const { createReleaseReadinessCliRouter } = require('./release-readiness-cli-router.cjs');
const { createReportCliRouter } = require('./report-cli-router.cjs');

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

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function runCorpusCommand(rawArgs, json) {
  const forwarded = rawArgs.filter((arg) => arg !== '--json');
  const script = path.join(repoRoot(), 'scripts', 'terrace-corpus-eval.cjs');
  if (!fs.existsSync(script)) {
    throw new Error('Corpus evaluator script not found: ' + script);
  }
  const result = spawnSync(process.execPath, [script, ...forwarded], {
    cwd: repoRoot(),
    encoding: 'utf8'
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status && result.status !== 0) {
    process.exitCode = result.status;
  }
  if (!json && !result.stdout && result.status === 0) {
    process.stdout.write('Corpus run completed.\n');
  }
}

function corpusReport(json) {
  const latestPath = path.join(repoRoot(), 'docs', 'terrace', 'corpus', 'latest-results.json');
  if (!fs.existsSync(latestPath)) {
    throw new Error('No corpus results found. Run terrace corpus run --sample first.');
  }
  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  const reportPath = path.join(repoRoot(), 'docs', 'terrace', 'corpus', 'REPORT.md');
  const result = {
    runId: latest.runId,
    totals: latest.summary ? latest.summary.totals : latest.totals,
    report: path.relative(process.cwd(), reportPath),
    evidence: latest.summary && latest.summary.evidenceDir ? latest.summary.evidenceDir : null
  };
  if (json) {
    output(result, { json: true });
    return;
  }
  output([
    'Run: ' + result.runId,
    'Report: ' + result.report,
    'Evidence: ' + result.evidence,
    'Commands: ' + String(result.totals.commands),
    'Passed: ' + String(result.totals.pass),
    'Expected blockers: ' + String(result.totals.expectedBlockers),
    'Product weaknesses: ' + String(result.totals.productWeaknesses)
  ].join('\n'), { json: false });
}

function ensureSteering(cwd) {
  const steeringPath = path.resolve(cwd, '.terrace', 'steering.md');
  if (!managedArtifactExists(cwd, 'steering.md')) {
    writeManagedText(cwd, 'steering.md', [
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
    ].join('\n'));
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
  const apply = hasFlag(rawArgs, '--apply');
  const help = hasFlag(rawArgs, '--help') || hasFlag(rawArgs, '-h') || rawArgs[0] === 'help';
  const version = hasFlag(rawArgs, '--version') || hasFlag(rawArgs, '-v');
  const args = stripFlags(rawArgs, ['--json', '--force', '--yes', '--dry-run', '--apply', '--help', '-h', '--version', '-v']);

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

  if (apply && command !== 'do') {
    fail('--apply is only supported with terrace do --apply <plan-token>.', { json });
  }

  const phaseRoute = phaseCliRouter.route({ command, args, cwd });
  if (phaseRoute.handled) {
    if (phaseRoute.kind === 'error') {
      fail(phaseRoute.message, { json });
      return;
    }
    output(phaseRoute.data, { json });
    return;
  }

  const seniorCycleRoute = seniorCycleCliRouter.route({ command, args, rawArgs, cwd });
  if (seniorCycleRoute.handled) {
    if (seniorCycleRoute.kind === 'error') {
      fail(seniorCycleRoute.message, { json });
      return;
    }
    output(seniorCycleRoute.data, { json });
    return;
  }

  const releaseReadinessRoute = releaseReadinessCliRouter.route({ command, args, rawArgs, cwd });
  if (releaseReadinessRoute.handled) {
    if (releaseReadinessRoute.kind === 'error') {
      fail(releaseReadinessRoute.message, { json });
      return;
    }
    output(releaseReadinessRoute.data, { json });
    if (releaseReadinessRoute.exitCode) {
      process.exitCode = releaseReadinessRoute.exitCode;
    }
    return;
  }

  const reportRoute = reportCliRouter.route({ command, args, cwd });
  if (reportRoute.handled) {
    if (reportRoute.kind === 'error') {
      fail(reportRoute.message, { json });
      return;
    }
    output(reportRoute.data, { json });
    if (reportRoute.exitCode) {
      process.exitCode = reportRoute.exitCode;
    }
    return;
  }

  switch (command) {
    case 'new-project': {
      const name = args[1];
      const prdFile = optionValue(rawArgs, '--prd');
      const paste = hasFlag(rawArgs, '--paste-prd');
      if (!name || (!prdFile && !paste)) {
        fail('Usage: terrace new-project <name> --prd <file> | --paste-prd', { json });
      }
      const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
      output(newProjectFromPrd(cwd, {
        name,
        prdText,
        force,
        source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
      }), { json });
      return;
    }
    case 'prd': {
      const sub = args[1];
      if (sub === 'import') {
        const feature = args[2];
        const prdFile = optionValue(rawArgs, '--file');
        const paste = hasFlag(rawArgs, '--paste');
        if (!feature || (!prdFile && !paste)) {
          fail('Usage: terrace prd import <feature> --file <file> | --paste', { json });
        }
        const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
        output(importFeaturePrd(cwd, {
          feature,
          prdText,
          force,
          source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
        }), { json });
        return;
      }
      fail('Unknown prd subcommand: ' + sub + '. Use: import', { json });
      return;
    }
    case 'core': {
      const sub = args[1];
      if (sub === 'init') {
        output(initCore(cwd, { projectName: path.basename(cwd), force, yes }), { json });
        return;
      }
      fail('Unknown core subcommand: ' + sub + '. Use: init', { json });
      return;
    }
    case 'agents': {
      const sub = args[1];
      if (sub === 'repair') {
        output(installAgentBootstrap(cwd), { json });
        return;
      }
      if (sub === 'install-global') {
        output(installGlobalAgentBootstrap(), { json });
        return;
      }
      fail('Unknown agents subcommand: ' + sub + '. Use: repair, install-global', { json });
      return;
    }
    case 'rule': {
      const sub = args[1];
      if (sub === 'add') {
        output(ruleAdd(cwd, args[2], args[3]), { json });
        return;
      }
      if (sub === 'audit') {
        output(ruleAudit(cwd, { effectiveness: hasFlag(rawArgs, '--effectiveness') }), { json });
        return;
      }
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
      fail('Unknown rule subcommand: ' + sub + '. Use: add, audit, explain, list', { json });
      return;
    }
    case 'add': {
      if (args[1] === 'rule') {
        output(ruleAdd(cwd, args[2], args[3]), { json });
        return;
      }
      fail('Unknown add subcommand: ' + args[1] + '. Use: rule', { json });
      return;
    }
    case 'quick': {
      const sub = args[1];
      if (sub === 'list') {
        output(quickList(cwd), { json });
        return;
      }
      if (sub === 'show') {
        const quickId = args[2];
        if (!quickId) {
          fail('Usage: terrace quick show <quick-task-id>', { json });
        }
        output(quickShow(cwd, quickId), { json });
        return;
      }
      if (sub === 'plan') {
        output(quickPlan(cwd, args.slice(2).join(' ')), { json });
        return;
      }
      if (sub === 'execute') {
        const quickId = args[2];
        if (!quickId) {
          fail('Usage: terrace quick execute <quick-task-id>', { json });
        }
        output(quickExecute(cwd, quickId), { json });
        return;
      }
      if (sub === 'complete') {
        const quickId = args[2];
        if (!quickId) {
          fail('Usage: terrace quick complete <quick-task-id>', { json });
        }
        output(quickComplete(cwd, quickId), { json });
        return;
      }
      const itemId = sub;
      if (!itemId) {
        fail('Usage: terrace quick <roadmap-item-id> or terrace quick list|show|plan|execute|complete', { json });
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
        if (hasFlag(rawArgs, '--compare')) {
          output(portGsdCompare(cwd), { json });
          return;
        }
        if (hasFlag(rawArgs, '--verify-parity')) {
          const result = portGsdVerifyParity(cwd);
          output(result, { json });
          if (!result.passed) {
            process.exitCode = 1;
          }
          return;
        }
        if (hasFlag(rawArgs, '--import-roadmap')) {
          output(portGsdImportRoadmap(cwd), { json });
          return;
        }
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
    case 'planning': {
      const sub = args[1];
      if (sub === 'refresh' || sub === 'init') {
        output(refreshPlanningPackage(cwd), { json });
        return;
      }
      fail('Unknown planning subcommand: ' + sub + '. Use: refresh, init', { json });
      return;
    }
    case 'next': {
      output(nextWorkflow(cwd), { json });
      return;
    }
    case 'resume': {
      output(resumeWorkflow(cwd), { json });
      return;
    }
    case 'history': {
      output(historySummary(cwd), { json });
      return;
    }
    case 'waive': {
      output(addWaiver(cwd, args[1], {
        reason: optionValue(rawArgs, '--reason'),
        owner: optionValue(rawArgs, '--owner'),
        expires: optionValue(rawArgs, '--expires')
      }), { json });
      return;
    }
    case 'handoff': {
      const sub = args[1];
      if (sub === 'create') {
        output(createHandoff(cwd, {
          feature: optionValue(rawArgs, '--feature'),
          for: optionValue(rawArgs, '--for')
        }), { json });
        return;
      }
      fail('Unknown handoff subcommand: ' + sub + '. Use: create', { json });
      return;
    }
    case 'debt': {
      const sub = args[1];
      if (sub === 'add') {
        output(addDebt(cwd, {
          feature: args[2],
          owner: optionValue(rawArgs, '--owner'),
          reason: optionValue(rawArgs, '--reason'),
          expiry: optionValue(rawArgs, '--expiry'),
          cleanup: optionValue(rawArgs, '--cleanup'),
          replacement: optionValue(rawArgs, '--replacement'),
          allowedToShip: hasFlag(rawArgs, '--allowed-to-ship')
        }), { json });
        return;
      }
      if (sub === 'list') {
        output(listDebt(cwd), { json });
        return;
      }
      if (sub === 'audit') {
        output(auditDebt(cwd), { json });
        return;
      }
      if (sub === 'resolve') {
        output(resolveDebt(cwd, args[2]), { json });
        return;
      }
      fail('Unknown debt subcommand: ' + sub + '. Use: add, list, audit, resolve', { json });
      return;
    }
    case 'preflight': {
      output(preflightFeature(cwd, args[1], { mode: optionValue(rawArgs, '--mode') }), { json });
      return;
    }
    case 'docu': {
      output(docuFeature(cwd, args[1], { type: optionValue(rawArgs, '--type') }), { json });
      return;
    }
    case 'test': {
      const sub = args[1];
      if (sub === 'eval') {
        output(testEval(cwd, { feature: optionValue(rawArgs, '--feature'), changed: hasFlag(rawArgs, '--changed') }), { json });
        return;
      }
      fail('Unknown test subcommand: ' + sub + '. Use: eval', { json });
      return;
    }
    case 'review': {
      const sub = args[1];
      if (sub === 'ai') {
        output(reviewAi(cwd, { mode: optionValue(rawArgs, '--mode'), feature: optionValue(rawArgs, '--feature'), from: optionValue(rawArgs, '--from') }), { json });
        return;
      }
      fail('Unknown review subcommand: ' + sub + '. Use: ai', { json });
      return;
    }
    case 'backfill': {
      output(backfill(cwd, {
        rule: optionValue(rawArgs, '--rule'),
        since: optionValue(rawArgs, '--since'),
        feature: optionValue(rawArgs, '--feature')
      }), { json });
      return;
    }
    case 'workstreams': {
      const sub = args[1];
      if (sub === 'plan') {
        output(workstreamsPlan(cwd, args[2]), { json });
        return;
      }
      fail('Unknown workstreams subcommand: ' + sub + '. Use: plan', { json });
      return;
    }
    case 'workbench': {
      const sub = args[1];
      if (sub === 'status') {
        output(workbenchStatus(cwd, { feature: optionValue(rawArgs, '--feature') }), { json });
        return;
      }
      if (sub === 'prepare') {
        output(workbenchPrepare(cwd, {
          feature: args[2],
          tier: optionValue(rawArgs, '--tier'),
          for: optionValue(rawArgs, '--for')
        }), { json });
        return;
      }
      fail('Unknown workbench subcommand: ' + sub + '. Use: status, prepare', { json });
      return;
    }
    case 'design-source': {
      const sub = args[1];
      if (sub === 'import') {
        output(designSourceImport(cwd, args[2], args[3], args[4]), { json });
        return;
      }
      if (sub === 'diff') {
        output(designSourceDiff(cwd, args[2], args[3], args[4]), { json });
        return;
      }
      fail('Unknown design-source subcommand: ' + sub + '. Use: import, diff', { json });
      return;
    }
    case 'autonomous': {
      output(autonomousWorkflow(cwd), { json });
      return;
    }
    case 'commands': {
      const sub = args[1];
      if (sub === 'discover') {
        output(discoverProjectCommands(cwd), { json });
        return;
      }
      fail('Unknown commands subcommand: ' + sub + '. Use: discover', { json });
      return;
    }
    case 'settings': {
      const sub = args[1];
      if (!sub || sub === 'show') {
        output(settingsShow(cwd), { json });
        return;
      }
      if (sub === 'effort') {
        output(settingsSetEffort(cwd, args[2]), { json });
        return;
      }
      fail('Unknown settings subcommand: ' + sub + '. Use: show, effort', { json });
      return;
    }
    case 'do': {
      const text = args.slice(1).join(' ');
      if (!text) {
        fail('Usage: terrace do <intent> | terrace do --apply <plan-token>', { json });
      }
      const result = apply ? applyPlainTextIntentPlan(cwd, text) : routePlainText(cwd, text);
      output(result, { json });
      if (result.result && result.result.passed === false) {
        process.exitCode = 1;
      }
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
    case 'backlog': {
      const sub = args[1];
      if (sub === 'list') {
        output(backlogList(cwd), { json });
        return;
      }
      if (sub === 'add') {
        output(backlogAdd(cwd, args.slice(2).join(' ')), { json });
        return;
      }
      fail('Unknown backlog subcommand: ' + sub + '. Use: list, add', { json });
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
      const result = runAudit(cwd, {});
      output({ ...result, read_only: true }, { json });
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
      const result = runSecurityCheck(cwd);
      output(result, { json });
      if (result.blocking && result.blocking.length > 0) {
        process.exitCode = 1;
      }
      return;
    }
    case 'corpus': {
      const sub = args[1];
      if (sub === 'run') {
        runCorpusCommand(rawArgs.slice(2), json);
        return;
      }
      if (sub === 'report') {
        corpusReport(json);
        return;
      }
      fail('Unknown corpus subcommand: ' + sub + '. Use: run, report', { json });
      return;
    }
    case 'adoption': {
      const sub = args[1];
      if (sub === 'status') {
        output(adoptionStatus(cwd), { json });
        return;
      }
      fail('Unknown adoption subcommand: ' + sub + '. Use: status', { json });
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
  fail(error && error.message ? error.message : String(error), {
    json,
    details: error && error.details ? error.details : null,
    next_command: error && error.next_command ? error.next_command : null,
    remediation: error && error.remediation ? error.remediation : null,
    file: error && error.file ? error.file : null
  });
});
