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
  portGsd,
  phaseList,
  phaseShow,
  phasePlan,
  phaseExecute,
  phaseValidate,
  phaseReview,
  phaseComplete,
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
  reportRead,
  reportUpdate,
  reportOpen,
  reportHistory,
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
  backfill,
  workstreamsPlan,
  designSourceImport,
  designSourceDiff,
  runSecurityCheck
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
  '  terrace security check       Run deterministic local security checks',
  '  terrace port gsd [--dry-run] Migrate or inventory legacy GSD artifacts',
  '  terrace next                 Show the next workflow action',
  '  terrace resume               Reconstruct paused workflow context',
  '  terrace history              Summarize migrated operational history',
  '  terrace do <plain text>      Route natural language to a Terrace command',
  '  terrace autonomous           Plan next phase and stop at blocker or handoff',
  '  terrace commands discover    Discover project quality scripts',
  '  terrace align <feature>      Write senior-cycle alignment artifact',
  '  terrace interrogate <feature> Write edge-case and failure-mode artifact',
  '  terrace map-codebase         Write codebase context artifacts',
  '  terrace design <feature>     Write architecture decision artifact',
  '  terrace test-plan <feature>  Write behavior-first test strategy',
  '  terrace observe <feature>    Write observability plan',
  '  terrace validate-prod <feature> Write production validation plan',
  '  terrace cleanup <feature>    Write cleanup contract',
  '  terrace ui import-stitch <feature> Capture Stitch design import',
  '  terrace ui plan-refresh <feature> Plan UI refresh work',
  '  terrace ui diff <feature>    Write UI source/target diff',
  '  terrace phase list           List roadmap phases',
  '  terrace phase show <id>      Show a roadmap phase',
  '  terrace phase plan <id>      Generate a phase plan artifact',
  '  terrace phase execute <id>   Enter RED-gate execution for a phase',
  '  terrace phase validate <id>  Generate validation artifact',
  '  terrace phase review <id>    Generate review artifact',
  '  terrace phase complete <id>  Complete a phase with summary artifact',
  '  terrace quick list           List migrated quick-task history',
  '  terrace quick show <id>      Show one migrated quick task',
  '  terrace quick plan <title>   Create a stateful quick-task plan',
  '  terrace quick execute <id>   Enter RED-gate execution for a quick task',
  '  terrace quick complete <id>  Complete a quick task',
  '  terrace backlog list         List backlog items',
  '  terrace backlog add <title>  Add a backlog item',
  '  terrace ship check           Run release readiness checks',
  '  terrace ship prepare         Write PR/release readiness summary',
  '  terrace report [update|open|history]',
  '  terrace handoff create [--feature <id>] [--for codex|claude|generic]',
  '  terrace debt add|list|audit|resolve',
  '  terrace preflight <feature>  Write production failure preflight',
  '  terrace docu <feature>       Write production documentation draft',
  '  terrace test eval            Evaluate test-suite trust',
  '  terrace review ai --mode <mode>',
  '  terrace rule add <domain> <rule-id>',
  '  terrace rule audit',
  '  terrace backfill             Write standards backfill spec',
  '  terrace workstreams plan <feature>',
  '  terrace design-source import <source> <feature> <ref>',
  '  terrace plan-phase <id>      GSD-compatible alias for phase plan',
  '  terrace execute-phase <id>   GSD-compatible alias for phase execute',
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

function optionValue(rawArgs, name) {
  const index = rawArgs.indexOf(name);
  return index === -1 ? null : rawArgs[index + 1] || null;
}

function seniorOptions(rawArgs) {
  return {
    tier: optionValue(rawArgs, '--tier')
  };
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
      if (sub === 'add') {
        output(ruleAdd(cwd, args[2], args[3]), { json });
        return;
      }
      if (sub === 'audit') {
        output(ruleAudit(cwd), { json });
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
    case 'report': {
      const sub = args[1];
      if (!sub) {
        output(reportRead(cwd), { json });
        return;
      }
      if (sub === 'update') {
        output(reportUpdate(cwd, { command: 'terrace report update' }), { json });
        return;
      }
      if (sub === 'open') {
        output(reportOpen(cwd), { json });
        return;
      }
      if (sub === 'history') {
        output(reportHistory(cwd), { json });
        return;
      }
      fail('Unknown report subcommand: ' + sub + '. Use: update, open, history', { json });
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
    case 'align': {
      output(alignFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'interrogate': {
      if (['init', 'adjust', 'risk', 'milestone'].includes(args[1])) {
        output(interrogateMode(cwd, args[1], args[2], seniorOptions(rawArgs)), { json });
        return;
      }
      output(interrogateFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'map-codebase': {
      output(mapCodebase(cwd), { json });
      return;
    }
    case 'design': {
      output(designFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'test-plan': {
      output(testPlanFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'observe': {
      output(observeFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'validate-prod': {
      output(validateProdFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'cleanup': {
      output(cleanupFeature(cwd, args[1], seniorOptions(rawArgs)), { json });
      return;
    }
    case 'ui': {
      const sub = args[1];
      const feature = args[2];
      if (sub === 'import-stitch') {
        output(uiImportStitch(cwd, feature), { json });
        return;
      }
      if (sub === 'plan-refresh') {
        output(uiPlanRefresh(cwd, feature), { json });
        return;
      }
      if (sub === 'diff') {
        output(uiDiff(cwd, feature), { json });
        return;
      }
      fail('Unknown ui subcommand: ' + sub + '. Use: import-stitch, plan-refresh, diff', { json });
      return;
    }
    case 'do': {
      const text = args.slice(1).join(' ');
      if (!text) {
        fail('Usage: terrace do <plain text>', { json });
      }
      const result = routePlainText(cwd, text);
      output(result, { json });
      if (result.result && result.result.passed === false) {
        process.exitCode = 1;
      }
      return;
    }
    case 'plan-phase':
    case 'execute-phase':
    case 'validate-phase':
    case 'review-phase':
    case 'complete-phase': {
      const phaseId = args[1];
      if (!phaseId) {
        fail('Usage: terrace ' + command + ' <phase-id>', { json });
      }
      const action = command.replace('-phase', '');
      const handlers = {
        plan: phasePlan,
        execute: phaseExecute,
        validate: phaseValidate,
        review: phaseReview,
        complete: phaseComplete
      };
      output({
        command_alias: 'terrace phase ' + action + ' ' + phaseId,
        result: handlers[action](cwd, phaseId)
      }, { json });
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
      if (sub === 'list') {
        output(phaseList(cwd), { json });
        return;
      }
      if (sub === 'show') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase show <phase-id>', { json });
        }
        output(phaseShow(cwd, phaseId), { json });
        return;
      }
      if (sub === 'plan') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase plan <phase-id>', { json });
        }
        output(phasePlan(cwd, phaseId), { json });
        return;
      }
      if (sub === 'execute') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase execute <phase-id>', { json });
        }
        output(phaseExecute(cwd, phaseId), { json });
        return;
      }
      if (sub === 'validate') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase validate <phase-id>', { json });
        }
        output(phaseValidate(cwd, phaseId), { json });
        return;
      }
      if (sub === 'review') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase review <phase-id>', { json });
        }
        output(phaseReview(cwd, phaseId), { json });
        return;
      }
      if (sub === 'complete') {
        const phaseId = args[2];
        if (!phaseId) {
          fail('Usage: terrace phase complete <phase-id>', { json });
        }
        output(phaseComplete(cwd, phaseId), { json });
        return;
      }
      if (sub !== 'set') {
        fail('Unknown phase subcommand: ' + sub + '. Use: list, show, plan, execute, validate, review, complete, set', { json });
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
    case 'ship': {
      const sub = args[1];
      if (!sub || sub === 'check') {
        const result = shipCheck(cwd);
        output(result, { json });
        if (!result.passed) {
          process.exitCode = 1;
        }
        return;
      }
      if (sub === 'prepare') {
        const result = shipPrepare(cwd);
        output(result, { json });
        if (!result.passed) {
          process.exitCode = 1;
        }
        return;
      }
      fail('Unknown ship subcommand: ' + sub + '. Use: check, prepare', { json });
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
      try {
        reportUpdate(cwd, { command: 'terrace audit' });
      } catch (error) {
        result.report_refresh_skipped = error && error.message ? error.message : String(error);
      }
      output(result, { json });
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
