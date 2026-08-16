'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const core = require('../packages/terrace-core/src/index.cjs');
const { managedArtifactExists, writeManagedText } = require('../packages/terrace-core/src/managed-artifacts.cjs');

function hasFlag(args, flag) {
  return args.includes(flag);
}

function optionValue(rawArgs, name) {
  const index = rawArgs.indexOf(name);
  return index === -1 ? null : rawArgs[index + 1] || null;
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

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function runCorpusCommand(cwd, rawArgs, json) {
  const forwarded = rawArgs.filter((arg) => arg !== '--json');
  const script = path.join(repoRoot(), 'scripts', 'terrace-corpus-eval.cjs');
  if (!fs.existsSync(script)) {
    throw new Error('Corpus evaluator script not found: ' + script);
  }
  const child = spawnSync(process.execPath, [script, ...forwarded], {
    cwd,
    encoding: 'utf8'
  });
  if (child.stdout) {
    process.stdout.write(child.stdout);
  }
  if (child.stderr) {
    process.stderr.write(child.stderr);
  }
  if (!json && !child.stdout && child.status === 0) {
    process.stdout.write('Corpus run completed.\n');
  }
  return child.status && child.status !== 0 ? child.status : undefined;
}

function corpusResultDirectories(cwd) {
  const configured = process.env.TERRACE_CORPUS_DIR;
  return [
    ...(configured ? [path.resolve(cwd, configured)] : []),
    path.join(cwd, '.terrace', 'corpus'),
    path.join(cwd, 'docs', 'terrace', 'corpus')
  ];
}

function corpusReport(cwd, json) {
  const reportDir = corpusResultDirectories(cwd).find((directory) => fs.existsSync(path.join(directory, 'latest-results.json')));
  if (!reportDir) {
    throw new Error('No corpus results found. Run terrace corpus run --sample first.');
  }
  const latestPath = path.join(reportDir, 'latest-results.json');
  const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  const reportPath = path.join(reportDir, 'REPORT.md');
  const data = {
    runId: latest.runId,
    totals: latest.summary ? latest.summary.totals : latest.totals,
    report: path.relative(cwd, reportPath),
    evidence: latest.summary && latest.summary.evidenceDir ? latest.summary.evidenceDir : null
  };
  if (json) return data;
  return [
    'Run: ' + data.runId,
    'Report: ' + data.report,
    'Evidence: ' + data.evidence,
    'Commands: ' + String(data.totals.commands),
    'Passed: ' + String(data.totals.pass),
    'Expected blockers: ' + String(data.totals.expectedBlockers),
    'Product weaknesses: ' + String(data.totals.productWeaknesses)
  ].join('\n');
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
  return core.installPreset(cwd, manifest, { force });
}

function result(data, exitCode) {
  return { handled: true, kind: 'result', data, exitCode };
}

function error(message) {
  return { handled: true, kind: 'error', message };
}

function familyError(familyId, args) {
  const sub = args[1];
  const messages = {
    agents: 'Unknown agents subcommand: ' + sub + '. Use: repair, install-global',
    prd: 'Unknown prd subcommand: ' + sub + '. Use: import',
    spec: 'Unknown spec subcommand: ' + sub + '. Use: validate, hash',
    ci: 'Unknown ci subcommand: ' + sub + '. Use: check',
    security: 'Unknown security subcommand: ' + sub + '. Use: check',
    corpus: 'Unknown corpus subcommand: ' + sub + '. Use: run, report',
    adoption: 'Unknown adoption subcommand: ' + sub + '. Use: status',
    port: 'Unknown port subcommand: ' + sub + '. Use: gsd',
    planning: 'Unknown planning subcommand: ' + sub + '. Use: refresh, init',
    blocker: 'Unknown blocker subcommand: ' + sub + '. Use: list, resolve',
    commands: 'Unknown commands subcommand: ' + sub + '. Use: discover',
    workstreams: 'Unknown workstreams subcommand: ' + sub + '. Use: plan',
    'design-source': 'Unknown design-source subcommand: ' + sub + '. Use: import, diff',
    backlog: 'Unknown backlog subcommand: ' + sub + '. Use: list, add',
    handoff: 'Unknown handoff subcommand: ' + sub + '. Use: create',
    debt: 'Unknown debt subcommand: ' + sub + '. Use: add, list, audit, resolve',
    test: 'Unknown test subcommand: ' + sub + '. Use: eval',
    review: 'Unknown review subcommand: ' + sub + '. Use: ai',
    workbench: 'Unknown workbench subcommand: ' + sub + '. Use: status, prepare',
    rule: 'Unknown rule subcommand: ' + sub + '. Use: add, audit, explain, list',
    preset: 'Unknown preset subcommand: ' + sub,
    core: 'Unknown core subcommand: ' + sub + '. Use: init',
    roadmap: 'Unknown roadmap subcommand: ' + sub + '. Use: execute',
    baseline: 'Unknown baseline subcommand: ' + sub + '. Use: protect, status',
    decision: 'Unknown decision subcommand: ' + sub + '. Use: log',
    session: 'Unknown session subcommand: ' + sub + '. Use: start, end, reconstruct',
    settings: 'Unknown settings subcommand: ' + sub + '. Use: show, effort',
    add: 'Unknown add subcommand: ' + sub + '. Use: rule'
  };
  return messages[familyId] || null;
}

function createLegacyCliRouter() {
  function route(input) {
    const {
      command_id: commandId,
      family_id: familyId,
      args,
      raw_args: rawArgs,
      cwd,
      json
    } = input;
    const force = hasFlag(rawArgs, '--force');
    const yes = hasFlag(rawArgs, '--yes');
    const dryRun = hasFlag(rawArgs, '--dry-run');
    const apply = hasFlag(rawArgs, '--apply');

    if (familyId) {
      const message = familyError(familyId, args);
      return message ? error(message) : { handled: false };
    }

    switch (commandId) {
      case 'project.new': {
        const name = args[1];
        const prdFile = optionValue(rawArgs, '--prd');
        const paste = hasFlag(rawArgs, '--paste-prd');
        if (!name || (!prdFile && !paste)) {
          return error('Usage: terrace new-project <name> --prd <file> | --paste-prd');
        }
        const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
        return result(core.newProjectFromPrd(cwd, {
          name,
          prdText,
          force,
          source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
        }));
      }
      case 'prd.import': {
        const feature = args[2];
        const prdFile = optionValue(rawArgs, '--file');
        const paste = hasFlag(rawArgs, '--paste');
        if (!feature || (!prdFile && !paste)) {
          return error('Usage: terrace prd import <feature> --file <file> | --paste');
        }
        const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
        return result(core.importFeaturePrd(cwd, {
          feature,
          prdText,
          force,
          source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
        }));
      }
      case 'core.init':
      case 'init':
        return result(core.initCore(cwd, { projectName: path.basename(cwd), force, yes }));
      case 'agents.repair':
        return result(core.installAgentBootstrap(cwd));
      case 'agents.install-global':
        return result(core.installGlobalAgentBootstrap());
      case 'rule.add':
        return result(core.ruleAdd(cwd, args[2], args[3]));
      case 'rule.audit':
        return result(core.ruleAudit(cwd, { effectiveness: hasFlag(rawArgs, '--effectiveness') }));
      case 'rule.explain': {
        const ruleId = args[2];
        if (!ruleId) return error('Usage: terrace rule explain <rule-id>');
        return result(core.explainRule(cwd, ruleId));
      }
      case 'rule.list':
        return result(core.loadRules(cwd));
      case 'quick.list':
        return result(core.quickList(cwd));
      case 'quick.show': {
        const quickId = args[2];
        if (!quickId) return error('Usage: terrace quick show <quick-task-id>');
        return result(core.quickShow(cwd, quickId));
      }
      case 'quick.plan':
        return result(core.quickPlan(cwd, args.slice(2).join(' ')));
      case 'quick.execute': {
        const quickId = args[2];
        if (!quickId) return error('Usage: terrace quick execute <quick-task-id>');
        return result(core.quickExecute(cwd, quickId));
      }
      case 'quick.complete': {
        const quickId = args[2];
        if (!quickId) return error('Usage: terrace quick complete <quick-task-id>');
        return result(core.quickComplete(cwd, quickId));
      }
      case 'quick.roadmap-item': {
        const itemId = args[1];
        if (!itemId) return error('Usage: terrace quick <roadmap-item-id> or terrace quick list|show|plan|execute|complete');
        return result(core.executeRoadmapItem(cwd, itemId));
      }
      case 'roadmap.execute': {
        const itemId = args[2];
        if (!itemId) return error('Usage: terrace roadmap execute <roadmap-item-id>');
        return result(core.executeRoadmapItem(cwd, itemId));
      }
      case 'port.gsd.compare':
        return result(core.portGsdCompare(cwd));
      case 'port.gsd.verify-parity': {
        const data = core.portGsdVerifyParity(cwd);
        return result(data, data.passed ? undefined : 1);
      }
      case 'port.gsd.import-roadmap':
        return result(core.portGsdImportRoadmap(cwd));
      case 'port.gsd.dry-run':
        return result(core.portGsdDryRun(cwd));
      case 'port.gsd':
        return result(dryRun ? core.portGsdDryRun(cwd) : core.portGsd(cwd, { force }));
      case 'planning.refresh':
        return result(core.refreshPlanningPackage(cwd));
      case 'next':
        return result(core.nextWorkflow(cwd));
      case 'resume':
        return result(core.resumeWorkflow(cwd));
      case 'blocker.list':
        return result(core.blockerList(cwd));
      case 'blocker.resolve':
        return result(core.blockerResolve(cwd, args[2], {
          owner: optionValue(rawArgs, '--owner'),
          evidence: optionValue(rawArgs, '--evidence')
        }));
      case 'history':
        return result(core.historySummary(cwd));
      case 'waive':
        return result(core.addWaiver(cwd, args[1], {
          reason: optionValue(rawArgs, '--reason'),
          owner: optionValue(rawArgs, '--owner'),
          expires: optionValue(rawArgs, '--expires')
        }));
      case 'handoff.create':
        return result(core.createHandoff(cwd, {
          feature: optionValue(rawArgs, '--feature'),
          for: optionValue(rawArgs, '--for')
        }));
      case 'debt.add':
        return result(core.addDebt(cwd, {
          feature: args[2],
          owner: optionValue(rawArgs, '--owner'),
          reason: optionValue(rawArgs, '--reason'),
          expiry: optionValue(rawArgs, '--expiry'),
          cleanup: optionValue(rawArgs, '--cleanup'),
          replacement: optionValue(rawArgs, '--replacement'),
          allowedToShip: hasFlag(rawArgs, '--allowed-to-ship')
        }));
      case 'debt.list':
        return result(core.listDebt(cwd));
      case 'debt.audit':
        return result(core.auditDebt(cwd));
      case 'debt.resolve':
        return result(core.resolveDebt(cwd, args[2]));
      case 'preflight':
        return result(core.preflightFeature(cwd, args[1], { mode: optionValue(rawArgs, '--mode') }));
      case 'docu':
        return result(core.docuFeature(cwd, args[1], { type: optionValue(rawArgs, '--type') }));
      case 'test.eval':
        return result(core.testEval(cwd, { feature: optionValue(rawArgs, '--feature'), changed: hasFlag(rawArgs, '--changed') }));
      case 'review.ai':
        return result(core.reviewAi(cwd, { mode: optionValue(rawArgs, '--mode'), feature: optionValue(rawArgs, '--feature'), from: optionValue(rawArgs, '--from') }));
      case 'backfill':
        return result(core.backfill(cwd, {
          rule: optionValue(rawArgs, '--rule'),
          since: optionValue(rawArgs, '--since'),
          feature: optionValue(rawArgs, '--feature')
        }));
      case 'workstreams.plan':
        return result(core.workstreamsPlan(cwd, args[2]));
      case 'workbench.status':
        return result(core.workbenchStatus(cwd, { feature: optionValue(rawArgs, '--feature') }));
      case 'workbench.prepare':
        return result(core.workbenchPrepare(cwd, {
          feature: args[2],
          tier: optionValue(rawArgs, '--tier'),
          for: optionValue(rawArgs, '--for')
        }));
      case 'design-source.import':
        return result(core.designSourceImport(cwd, args[2], args[3], args[4]));
      case 'design-source.diff':
        return result(core.designSourceDiff(cwd, args[2], args[3], args[4]));
      case 'autonomous':
        return result(core.autonomousWorkflow(cwd));
      case 'commands.discover':
        return result(core.discoverProjectCommands(cwd));
      case 'settings.show':
        return result(core.settingsShow(cwd));
      case 'settings.effort':
        return result(core.settingsSetEffort(cwd, args[2]));
      case 'do': {
        const text = args.slice(1).join(' ');
        if (!text) return error('Usage: terrace do <intent> | terrace do --apply <plan-token>');
        const data = apply ? core.applyPlainTextIntentPlan(cwd, text) : core.routePlainText(cwd, text);
        return result(data, data.result && data.result.passed === false ? 1 : undefined);
      }
      case 'doctor':
        return result(core.runDoctor(cwd));
      case 'preset.list':
        return result(core.listPresets(cwd));
      case 'preset.install': {
        const id = args[2];
        if (!id) return error('Usage: terrace preset install <id>');
        if (id.startsWith('terrace-')) return result(core.installBuiltInPreset(cwd, id, { force }));
        return result(installPresetFromId(cwd, id, force));
      }
      case 'backlog.list':
        return result(core.backlogList(cwd));
      case 'backlog.add':
        return result(core.backlogAdd(cwd, args.slice(2).join(' ')));
      case 'steering':
        return result(ensureSteering(cwd));
      case 'baseline.protect': {
        const filePath = args[2];
        const specIndex = args.indexOf('--spec-ref');
        if (!filePath || specIndex === -1 || !args[specIndex + 1]) {
          return error('Usage: terrace baseline protect <file> --spec-ref <SPEC-ID>');
        }
        return result(core.protectBaseline(cwd, filePath, args[specIndex + 1], {}));
      }
      case 'baseline.status':
        return result(core.baselineStatus(cwd));
      case 'decision.log': {
        const specIndex = args.indexOf('--spec-ref');
        if (specIndex === -1 || !args[specIndex + 1]) {
          return error('Usage: terrace decision log --spec-ref <SPEC-ID>');
        }
        return result(core.addDecision(cwd, { specRef: args[specIndex + 1] }));
      }
      case 'audit': {
        const data = core.runAudit(cwd, {});
        return result({ ...data, read_only: true });
      }
      case 'ci.check':
        return result(core.runCiCheck(cwd, args.slice(2)));
      case 'policy':
        return result(core.evaluatePolicy(cwd));
      case 'session.start':
        return result(core.startSession(cwd, {}));
      case 'session.end':
        return result(core.endSession(cwd, {}));
      case 'session.reconstruct':
        return result(core.reconstructSession(cwd));
      case 'migrate':
        return result(core.migrateArtifacts(cwd, '1.0'));
      case 'security.check': {
        const data = core.runSecurityCheck(cwd);
        return result(data, data.blocking && data.blocking.length > 0 ? 1 : undefined);
      }
      case 'corpus.run':
        return { handled: true, kind: 'passthrough', exitCode: runCorpusCommand(cwd, rawArgs.slice(2), json) };
      case 'corpus.report':
        return result(corpusReport(cwd, json));
      case 'adoption.status':
        return result(core.adoptionStatus(cwd));
      case 'spec.hash': {
        const fileIndex = args.indexOf('--file');
        if (fileIndex === -1 || !args[fileIndex + 1]) {
          return error('Usage: terrace spec hash --file <path>');
        }
        const hash = core.computeSpecHash(args[fileIndex + 1], { cwd });
        return result(json ? { hash } : hash);
      }
      case 'spec.validate': {
        const data = core.validateArtifacts(cwd, {});
        return result(data, data.blocking.length > 0 ? 1 : undefined);
      }
      default:
        return { handled: false };
    }
  }

  return { route };
}

module.exports = {
  createLegacyCliRouter
};
