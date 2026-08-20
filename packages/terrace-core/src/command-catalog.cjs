'use strict';

// This module owns command metadata and explicit inbound dispatch forms. Every
// public projection and the CLI parser must read from this catalog rather than
// maintain a second command inventory or infer parser rules from help text.

const CATALOG_SCHEMA_VERSION = '1.0';

function freezeList(items) {
  return Object.freeze([...(items || [])]);
}

function agent(templateId, invocation, argumentHint, description) {
  return Object.freeze({
    template_id: templateId,
    invocation,
    argument_hint: argumentHint || '',
    description
  });
}

function help(usage, summary) {
  return Object.freeze({ visible: true, usage, summary });
}

function parameter(name) {
  return Object.freeze({ kind: 'parameter', name });
}

function option(name, flag) {
  return Object.freeze({ kind: 'option', name, flag });
}

function dispatchForm(literals, options) {
  const opts = options || {};
  return Object.freeze({
    literals: freezeList(literals),
    required_flags: freezeList(opts.requiredFlags),
    priority: Number.isInteger(opts.priority) ? opts.priority : 0,
    kind: opts.kind || 'command',
    family_id: opts.familyId || null,
    match: opts.match || 'prefix',
    alias_id: opts.aliasId || null
  });
}

function dispatch(owner, ...forms) {
  return Object.freeze({
    owner,
    forms: freezeList(forms)
  });
}

const F = dispatchForm;
const D = dispatch;
const G = (familyId, literals) => F(literals, { kind: 'family', familyId, priority: -100 });

const ADVANCED_HELP_COMMAND_IDS = new Set([
  'agents.repair',
  'agents.install-global',
  'spec.hash',
  'ci.check',
  'security.check',
  'corpus.run',
  'corpus.report',
  'adoption.status',
  'port.gsd',
  'port.gsd.dry-run',
  'port.gsd.compare',
  'port.gsd.verify-parity',
  'port.gsd.import-roadmap',
  'planning.refresh',
  'resume',
  'history',
  'autonomous',
  'settings.show',
  'settings.effort',
  'commands.discover',
  'map-codebase',
  'design',
  'observe',
  'validate-prod',
  'cleanup',
  'ui.import-stitch',
  'ui.plan-refresh',
  'ui.diff',
  'workstreams.plan',
  'design-source.import',
  'design-source.diff',
  'phase.list',
  'parallel.plan',
  'parallel.start',
  'parallel.status',
  'parallel.resume',
  'parallel.merge',
  'parallel.fail',
  'parallel.cleanup',
  'phase.show',
  'quick.list',
  'quick.show',
  'backlog.list',
  'backlog.add',
  'ship.prepare',
  'release-preflight',
  'handoff.create',
  'debt',
  'preflight',
  'docu',
  'test.eval',
  'review.ai',
  'waive',
  'workbench.status',
  'workbench.prepare',
  'rule.add',
  'rule.audit',
  'rule.list',
  'rule.explain',
  'backfill',
  'preset.list',
  'preset.install'
]);

// These forms are parser data, not display grammar. They intentionally include
// the compatibility defaults and flag precedence that are not expressible in
// argv_pattern, while leaving argument and option validation to the owner.
const COMMAND_DISPATCH_BY_ID = Object.freeze({
  help: D('top', F(['help']), F(['--help']), F(['-h'])),
  version: D('top', F(['--version']), F(['-v'])),
  init: D('legacy', F(['init'])),
  'agents.repair': D('legacy', G('agents', ['agents']), F(['agents', 'repair'])),
  'agents.install-global': D('legacy', F(['agents', 'install-global'])),
  'project.new': D('legacy', F(['new-project'])),
  'prd.import': D('legacy', G('prd', ['prd']), F(['prd', 'import'])),
  doctor: D('legacy', F(['doctor'])),
  'spec.validate': D('legacy', G('spec', ['spec']), F(['spec', 'validate'])),
  'spec.hash': D('legacy', F(['spec', 'hash'])),
  audit: D('legacy', F(['audit'])),
  'ci.check': D('legacy', G('ci', ['ci']), F(['ci', 'check'])),
  'security.check': D('legacy', G('security', ['security']), F(['security', 'check'])),
  'corpus.run': D('legacy', G('corpus', ['corpus']), F(['corpus', 'run'])),
  'corpus.report': D('legacy', F(['corpus', 'report'])),
  'adoption.status': D('legacy', G('adoption', ['adoption']), F(['adoption', 'status'])),
  'port.gsd': D('legacy', G('port', ['port']), F(['port', 'gsd'])),
  'port.gsd.dry-run': D('legacy', F(['port', 'gsd'], { requiredFlags: ['--dry-run'], priority: 100 })),
  'port.gsd.compare': D('legacy', F(['port', 'gsd'], { requiredFlags: ['--compare'], priority: 400 })),
  'port.gsd.verify-parity': D('legacy', F(['port', 'gsd'], { requiredFlags: ['--verify-parity'], priority: 300 })),
  'port.gsd.import-roadmap': D('legacy', F(['port', 'gsd'], { requiredFlags: ['--import-roadmap'], priority: 200 })),
  'planning.refresh': D('legacy', G('planning', ['planning']), F(['planning', 'refresh']), F(['planning', 'init'], { aliasId: 'planning.init' })),
  next: D('legacy', F(['next'])),
  resume: D('legacy', F(['resume'])),
  'blocker.list': D('legacy', G('blocker', ['blocker']), F(['blocker', 'list'])),
  'blocker.resolve': D('legacy', F(['blocker', 'resolve'])),
  history: D('legacy', F(['history'])),
  do: D('legacy', F(['do'])),
  autonomous: D('legacy', F(['autonomous'])),
  'phase.execute-complete': D('phase', F(['execute-phase-complete'])),
  'settings.show': D('legacy', G('settings', ['settings']), F(['settings'], { match: 'exact' }), F(['settings', 'show'])),
  'settings.effort': D('legacy', F(['settings', 'effort'])),
  'commands.discover': D('legacy', G('commands', ['commands']), F(['commands', 'discover'])),
  align: D('senior-cycle', F(['align'])),
  interrogate: D('senior-cycle', F(['interrogate'])),
  'map-codebase': D('senior-cycle', F(['map-codebase'])),
  design: D('senior-cycle', F(['design'])),
  'test-plan': D('senior-cycle', F(['test-plan'])),
  observe: D('senior-cycle', F(['observe'])),
  'validate-prod': D('senior-cycle', F(['validate-prod'])),
  cleanup: D('senior-cycle', F(['cleanup'])),
  'ui.import-stitch': D('senior-cycle', G('ui', ['ui']), F(['ui', 'import-stitch'])),
  'ui.plan-refresh': D('senior-cycle', F(['ui', 'plan-refresh'])),
  'ui.diff': D('senior-cycle', F(['ui', 'diff'])),
  'workstreams.plan': D('legacy', G('workstreams', ['workstreams']), F(['workstreams', 'plan'])),
  'design-source.import': D('legacy', G('design-source', ['design-source']), F(['design-source', 'import'])),
  'design-source.diff': D('legacy', F(['design-source', 'diff'])),
  'phase.list': D('phase', G('phase', ['phase']), F(['phase', 'list'])),
  'phase.show': D('phase', F(['phase', 'show'])),
  'phase.plan': D('phase', F(['phase', 'plan'])),
  'phase.execute': D('phase', F(['phase', 'execute'])),
  'parallel.plan': D('phase', F(['parallel', 'plan'])),
  'parallel.start': D('phase', F(['parallel', 'start'])),
  'parallel.status': D('phase', F(['parallel', 'status'])),
  'parallel.resume': D('phase', F(['parallel', 'resume'])),
  'parallel.merge': D('phase', F(['parallel', 'merge'])),
  'parallel.fail': D('phase', F(['parallel', 'fail'])),
  'parallel.cleanup': D('phase', F(['parallel', 'cleanup'])),
  'phase.validate': D('phase', F(['phase', 'validate'])),
  'phase.review': D('phase', F(['phase', 'review'])),
  'phase.complete': D('phase', F(['phase', 'complete'])),
  'phase.plan.alias': D('phase', F(['plan-phase'])),
  'phase.execute.alias': D('phase', F(['execute-phase'])),
  'phase.validate.alias': D('phase', F(['validate-phase'])),
  'phase.review.alias': D('phase', F(['review-phase'])),
  'phase.complete.alias': D('phase', F(['complete-phase'])),
  'quick.list': D('legacy', F(['quick', 'list'])),
  'quick.show': D('legacy', F(['quick', 'show'])),
  'quick.plan': D('legacy', F(['quick', 'plan'])),
  'quick.execute': D('legacy', F(['quick', 'execute'])),
  'quick.complete': D('legacy', F(['quick', 'complete'])),
  'backlog.list': D('legacy', G('backlog', ['backlog']), F(['backlog', 'list'])),
  'backlog.add': D('legacy', F(['backlog', 'add'])),
  'ship.check': D('release-readiness', G('ship', ['ship']), F(['ship'], { match: 'exact' }), F(['ship', 'check'])),
  'ship.prepare': D('release-readiness', F(['ship', 'prepare'])),
  'release-preflight': D('release-readiness', F(['release-preflight']), G('release', ['release']), F(['release', 'preflight'], { aliasId: 'release.preflight' })),
  report: D('report', G('report', ['report']), F(['report'], { match: 'exact' })),
  'handoff.create': D('legacy', G('handoff', ['handoff']), F(['handoff', 'create'])),
  debt: D('legacy', G('debt', ['debt'])),
  preflight: D('legacy', F(['preflight'])),
  docu: D('legacy', F(['docu'])),
  'test.eval': D('legacy', G('test', ['test']), F(['test', 'eval'])),
  'review.ai': D('legacy', G('review', ['review']), F(['review', 'ai'])),
  waive: D('legacy', F(['waive'])),
  'workbench.status': D('legacy', G('workbench', ['workbench']), F(['workbench', 'status'])),
  'workbench.prepare': D('legacy', F(['workbench', 'prepare'])),
  'rule.add': D('legacy', G('rule', ['rule']), G('add', ['add']), F(['rule', 'add']), F(['add', 'rule'], { aliasId: 'add.rule' })),
  'rule.audit': D('legacy', F(['rule', 'audit'])),
  'rule.list': D('legacy', F(['rule', 'list'])),
  'rule.explain': D('legacy', F(['rule', 'explain'])),
  backfill: D('legacy', F(['backfill'])),
  'preset.list': D('legacy', G('preset', ['preset']), F(['preset', 'list'])),
  'preset.install': D('legacy', F(['preset', 'install'])),
  'core.init': D('legacy', G('core', ['core']), F(['core', 'init'])),
  'quick.roadmap-item': D('legacy', F(['quick'])),
  'roadmap.execute': D('legacy', G('roadmap', ['roadmap']), F(['roadmap', 'execute'])),
  'report.update': D('report', F(['report', 'update'])),
  'report.open': D('report', F(['report', 'open'])),
  'report.history': D('report', F(['report', 'history'])),
  'report.ceremony': D('report', F(['report', 'ceremony'])),
  'debt.add': D('legacy', F(['debt', 'add'])),
  'debt.list': D('legacy', F(['debt', 'list'])),
  'debt.audit': D('legacy', F(['debt', 'audit'])),
  'debt.resolve': D('legacy', F(['debt', 'resolve'])),
  'phase.set': D('phase', F(['phase', 'set'])),
  'interrogate.mode': D('senior-cycle', F(['interrogate', 'init']), F(['interrogate', 'adjust']), F(['interrogate', 'risk']), F(['interrogate', 'milestone'])),
  steering: D('legacy', F(['steering'])),
  'baseline.protect': D('legacy', G('baseline', ['baseline']), F(['baseline', 'protect'])),
  'baseline.status': D('legacy', F(['baseline', 'status'])),
  'decision.log': D('legacy', G('decision', ['decision']), F(['decision', 'log'])),
  policy: D('legacy', F(['policy'])),
  'session.start': D('legacy', G('session', ['session']), F(['session', 'start'])),
  'session.end': D('legacy', F(['session', 'end'])),
  'session.reconstruct': D('legacy', F(['session', 'reconstruct'])),
  migrate: D('legacy', F(['migrate']))
});

function command(id, argvPattern, options) {
  const opts = options || {};
  return Object.freeze({
    id,
    argv_pattern: freezeList(argvPattern),
    aliases: freezeList(opts.aliases),
    help: opts.help || null,
    effect: opts.effect || 'write',
    json: opts.json !== false,
    visibility: opts.visibility || (ADVANCED_HELP_COMMAND_IDS.has(id) ? 'advanced' : 'primary'),
    agent: opts.agent || null,
    writes: freezeList(opts.writes),
    execution: freezeList(opts.execution),
    variants: freezeList(opts.variants),
    route_argv: freezeList(opts.route),
    dispatch: opts.dispatch || COMMAND_DISPATCH_BY_ID[id] || null
  });
}

const A = agent;
const H = help;
const P = parameter;
const O = option;

const COMMAND_CATALOG = Object.freeze([
  command('help', ['--help'], {
    effect: 'read',
    agent: A('terrace-help', 'terrace --help', '', 'Show the top-level Terrace command list.')
  }),
  command('version', ['--version'], {
    effect: 'read',
    agent: A('terrace-version', 'terrace --version', '', 'Print the installed Terrace package version.')
  }),
  command('init', ['init'], {
    effect: 'write',
    help: H('terrace init', 'Initialize or safely repair Terrace state in this repo'),
    agent: A('terrace-init', 'terrace init', '', 'Initialize or safely repair Terrace state and non-overwriting agent bootstrap assets.')
  }),
  command('agents.repair', ['agents', 'repair'], {
    effect: 'write',
    help: H('terrace agents repair', 'Repair missing repo-local Terrace agent assets'),
    agent: A('terrace-agents-repair', 'terrace agents repair', '', 'Repair missing repo-local Terrace agent assets without changing workflow state.')
  }),
  command('agents.install-global', ['agents', 'install-global'], {
    effect: 'write',
    help: H('terrace agents install-global', 'Install Terrace Codex skills into ~/.agents'),
    agent: A('terrace-agents-install-global', 'terrace agents install-global', '', 'Install non-overwriting global Codex and Claude Code Terrace assets.')
  }),
  command('project.new', ['new-project', '<name>', '--prd', '<file>|--paste-prd'], {
    effect: 'write',
    help: H('terrace new-project <name> --prd <file>|--paste-prd', 'Initialize Terrace from a source PRD'),
    agent: A('terrace-new-project', 'terrace new-project $ARGUMENTS', '<name> --prd <file>|--paste-prd', 'Initialize Terrace from a source PRD and write project artifacts.')
  }),
  command('prd.import', ['prd', 'import', '<feature>', '--file', '<file>|--paste'], {
    effect: 'write',
    help: H('terrace prd import <feature> --file <file>|--paste', 'Import a feature PRD into an existing Terrace project'),
    agent: A('terrace-prd-import', 'terrace prd import $ARGUMENTS', '<feature> --file <file>|--paste', 'Import a feature PRD into an existing Terrace project.')
  }),
  command('doctor', ['doctor'], {
    effect: 'read',
    help: H('terrace doctor', 'Diagnose Terrace installation health'),
    agent: A('terrace-doctor', 'terrace doctor', '', 'Check Terrace installation health.')
  }),
  command('spec.validate', ['spec', 'validate'], {
    effect: 'read',
    help: H('terrace spec validate', 'Validate governance artifacts'),
    agent: A('terrace-spec-validate', 'terrace spec validate', '', 'Validate Terrace governance artifacts.')
  }),
  command('spec.hash', ['spec', 'hash', '--file', '<path>'], {
    effect: 'read',
    help: H('terrace spec hash --file <path>', 'Compute a stable spec hash'),
    agent: A('terrace-spec-hash', 'terrace spec hash --file $ARGUMENTS', '<path>', 'Compute a stable spec hash for a file.')
  }),
  command('audit', ['audit'], {
    effect: 'read',
    help: H('terrace audit', 'Run governance audit checks'),
    agent: A('terrace-audit', 'terrace audit', '', 'Check artifacts and protected baselines.')
  }),
  command('ci.check', ['ci', 'check', '[files...]'], {
    effect: 'read',
    help: H('terrace ci check [files...]', 'Run audit plus protected-change checks'),
    agent: A('terrace-ci-check', 'terrace ci check $ARGUMENTS', '[files...]', 'Run audit plus protected-change enforcement.')
  }),
  command('security.check', ['security', 'check'], {
    effect: 'write',
    help: H('terrace security check', 'Run deterministic local security checks'),
    agent: A('terrace-security-check', 'terrace security check', '', 'Run deterministic local security checks.')
  }),
  command('corpus.run', ['corpus', 'run', '[--sample|--all-shadow]', '[--track', '<track>]', '[--dry-run-plan]'], {
    effect: 'write',
    help: H('terrace corpus run', 'Run the local Terrace corpus evaluator'),
    agent: A('terrace-corpus-run', 'terrace corpus run $ARGUMENTS', '[--sample|--all-shadow] [--track <track>] [--dry-run-plan]', 'Run the local Terrace corpus evaluator.')
  }),
  command('corpus.report', ['corpus', 'report'], {
    effect: 'read',
    help: H('terrace corpus report', 'Show the latest corpus report summary'),
    agent: A('terrace-corpus-report', 'terrace corpus report', '', 'Show the latest Terrace corpus report summary.')
  }),
  command('adoption.status', ['adoption', 'status'], {
    effect: 'read',
    route: ['adoption', 'status'],
    help: H('terrace adoption status', 'Report GSD replacement readiness'),
    agent: A('terrace-adoption-status', 'terrace adoption status', '', 'Report GSD replacement readiness and remaining adoption gaps.')
  }),
  command('port.gsd', ['port', 'gsd'], {
    effect: 'write',
    help: H('terrace port gsd [--dry-run|--compare|--verify-parity|--import-roadmap]', 'Migrate or inventory legacy GSD artifacts'),
    agent: A('terrace-port-gsd', 'terrace port gsd', '', 'Migrate supported legacy GSD artifacts into Terrace state.')
  }),
  command('port.gsd.dry-run', ['port', 'gsd', '--dry-run'], {
    effect: 'read',
    agent: A('terrace-port-gsd-dry-run', 'terrace port gsd --dry-run', '', 'Inventory legacy GSD artifacts without writing Terrace state.')
  }),
  command('port.gsd.compare', ['port', 'gsd', '--compare'], {
    effect: 'read',
    agent: A('terrace-port-gsd-compare', 'terrace port gsd --compare', '', 'Compare legacy GSD concepts against Terrace migration coverage before porting.')
  }),
  command('port.gsd.verify-parity', ['port', 'gsd', '--verify-parity'], {
    effect: 'read',
    agent: A('terrace-port-gsd-verify-parity', 'terrace port gsd --verify-parity', '', 'Fail when legacy GSD concepts are present but unmapped by Terrace migration.')
  }),
  command('port.gsd.import-roadmap', ['port', 'gsd', '--import-roadmap'], {
    effect: 'write',
    agent: A('terrace-port-gsd-import-roadmap', 'terrace port gsd --import-roadmap', '', 'Merge missing legacy roadmap phases into existing Terrace state without overwriting phases.')
  }),
  command('planning.refresh', ['planning', 'refresh'], {
    effect: 'write',
    aliases: [{ id: 'planning.init', argv_pattern: ['planning', 'init'], visibility: 'compatibility' }],
    help: H('terrace planning refresh', 'Initialize or refresh .planning from Terrace state'),
    agent: A('terrace-planning-refresh', 'terrace planning refresh', '', 'Initialize or refresh the repo-local .planning package from Terrace state.')
  }),

  command('next', ['next'], {
    effect: 'read',
    route: ['next'],
    help: H('terrace next', 'Show the next workflow action'),
    agent: A('terrace-next', 'terrace next', '', 'Find and follow the next Terrace workflow action.')
  }),
  command('resume', ['resume'], {
    effect: 'read',
    route: ['resume'],
    help: H('terrace resume', 'Reconstruct paused workflow context'),
    agent: A('terrace-resume', 'terrace resume', '', 'Reconstruct paused Terrace workflow context.')
  }),
  command('blocker.list', ['blocker', 'list'], {
    effect: 'read',
    route: ['blocker', 'list'],
    help: H('terrace blocker list', 'List migrated blocking actions and stable IDs'),
    agent: A('terrace-blocker-list', 'terrace blocker list', '', 'List migrated blocking actions and their stable IDs.')
  }),
  command('blocker.resolve', ['blocker', 'resolve', '<id>', '--owner', '<owner>', '--evidence', '<ref>'], {
    effect: 'write',
    route: ['blocker', 'resolve', P('blocker_id'), O('owner', '--owner'), O('evidence', '--evidence')],
    help: H('terrace blocker resolve <id> --owner <owner> --evidence <ref>', 'Record an evidence-bearing blocker correction'),
    agent: A('terrace-blocker-resolve', 'terrace blocker resolve $ARGUMENTS', '<id> --owner <owner> --evidence <ref>', 'Record an evidence-bearing correction for one blocking action.')
  }),
  command('history', ['history'], {
    effect: 'read',
    route: ['history'],
    help: H('terrace history', 'Summarize migrated operational history'),
    agent: A('terrace-history', 'terrace history', '', 'Summarize migrated phases, sessions, decisions, and quick tasks.')
  }),
  command('do', ['do', '<intent>', '|', '--apply', '<plan-token>'], {
    effect: 'mixed',
    help: H('terrace do <intent> | --apply <plan-token>', 'Preview a route or apply its state-bound plan token'),
    agent: A('terrace-do', 'terrace do "$ARGUMENTS"', '<intent> | --apply <plan-token>', 'Preview natural-language intent; apply only the state-bound plan token returned for a reviewed write.')
  }),
  command('autonomous', ['autonomous'], {
    effect: 'write',
    route: ['autonomous'],
    help: H('terrace autonomous', 'Plan next phase and stop at blocker or handoff'),
    agent: A('terrace-autonomous', 'terrace autonomous', '', 'Plan the next phase and stop at blockers or agent handoff.')
  }),
  command('phase.execute-complete', ['execute-phase-complete', '<id>'], {
    effect: 'write',
    route: ['execute-phase-complete', P('phase_id')],
    help: H('terrace execute-phase-complete <id>', 'Plan, execute, validate, review, and complete one phase'),
    agent: A('terrace-execute-phase-complete', 'terrace execute-phase-complete $ARGUMENTS', '<phase-id>', 'Run a complete Terrace phase lifecycle from planning through completion.')
  }),
  command('settings.show', ['settings', 'show'], {
    effect: 'read',
    help: H('terrace settings show', 'Show Terrace settings'),
    agent: A('terrace-settings-show', 'terrace settings show', '', 'Show current Terrace settings.')
  }),
  command('settings.effort', ['settings', 'effort', '<fast|standard|thorough>'], {
    effect: 'write',
    help: H('terrace settings effort <fast|standard|thorough>', 'Set the default phase-planning effort'),
    agent: A('terrace-settings-effort', 'terrace settings effort $ARGUMENTS', '<fast|standard|thorough>', 'Set the default phase effort used in planning and execution artifacts.')
  }),
  command('commands.discover', ['commands', 'discover'], {
    effect: 'read',
    help: H('terrace commands discover', 'Discover project quality scripts'),
    agent: A('terrace-commands-discover', 'terrace commands discover', '', 'Discover project quality scripts and command mappings.')
  }),

  command('align', ['align', '<feature>'], {
    effect: 'write',
    help: H('terrace align <feature>', 'Write senior-cycle alignment artifact'),
    agent: A('terrace-align', 'terrace align $ARGUMENTS', '<feature>', 'Write senior-cycle alignment intent for a feature.')
  }),
  command('interrogate', ['interrogate', '<feature>'], {
    effect: 'write',
    help: H('terrace interrogate <feature>', 'Capture user-driven edge-case and failure-mode interrogation'),
    agent: A('terrace-interrogate', 'terrace interrogate $ARGUMENTS', '<feature>', 'Gather user input for edge-case, assumption-challenge, and failure-mode interrogation.')
  }),
  command('map-codebase', ['map-codebase'], {
    effect: 'write',
    help: H('terrace map-codebase', 'Write codebase context artifacts'),
    agent: A('terrace-map-codebase', 'terrace map-codebase', '', 'Write repo-derived codebase map, architecture, risks, testing, and observability context.')
  }),
  command('design', ['design', '<feature>'], {
    effect: 'write',
    help: H('terrace design <feature>', 'Write architecture decision artifact'),
    agent: A('terrace-design', 'terrace design $ARGUMENTS', '<feature>', 'Record architecture decisions, tradeoffs, maintainability, and no-band-aid intent.')
  }),
  command('test-plan', ['test-plan', '<feature>'], {
    effect: 'write',
    help: H('terrace test-plan <feature>', 'Write behavior-first test strategy'),
    agent: A('terrace-test-plan', 'terrace test-plan $ARGUMENTS', '<feature>', 'Write the behavior-first test plan required before implementation.')
  }),
  command('observe', ['observe', '<feature>'], {
    effect: 'write',
    help: H('terrace observe <feature>', 'Write observability plan'),
    agent: A('terrace-observe', 'terrace observe $ARGUMENTS', '<feature>', 'Write feature observability and post-launch debugging intent.')
  }),
  command('validate-prod', ['validate-prod', '<feature>'], {
    effect: 'write',
    help: H('terrace validate-prod <feature>', 'Write production validation plan'),
    agent: A('terrace-validate-prod', 'terrace validate-prod $ARGUMENTS', '<feature>', 'Write production success signals, monitoring, and rollback conditions.')
  }),
  command('cleanup', ['cleanup', '<feature>'], {
    effect: 'write',
    help: H('terrace cleanup <feature>', 'Write cleanup contract'),
    agent: A('terrace-cleanup', 'terrace cleanup $ARGUMENTS', '<feature>', 'Write cleanup contract for flags, temporary code, and docs.')
  }),
  command('ui.import-stitch', ['ui', 'import-stitch', '<feature>'], {
    effect: 'write',
    help: H('terrace ui import-stitch <feature>', 'Capture Stitch design import'),
    agent: A('terrace-ui-import-stitch', 'terrace ui import-stitch $ARGUMENTS', '<feature>', 'Capture a Stitch design import for UI work.')
  }),
  command('ui.plan-refresh', ['ui', 'plan-refresh', '<feature>'], {
    effect: 'write',
    help: H('terrace ui plan-refresh <feature>', 'Plan UI refresh work'),
    agent: A('terrace-ui-plan-refresh', 'terrace ui plan-refresh $ARGUMENTS', '<feature>', 'Plan a design-driven UI refresh.')
  }),
  command('ui.diff', ['ui', 'diff', '<feature>'], {
    effect: 'write',
    help: H('terrace ui diff <feature>', 'Write UI source/target diff'),
    agent: A('terrace-ui-diff', 'terrace ui diff $ARGUMENTS', '<feature>', 'Write UI source and target diff context.')
  }),
  command('workstreams.plan', ['workstreams', 'plan', '<feature>'], {
    effect: 'write',
    help: H('terrace workstreams plan <feature>', 'Plan feature workstreams for production delivery'),
    agent: A('terrace-workstreams-plan', 'terrace workstreams plan $ARGUMENTS', '<feature>', 'Plan feature workstreams for production delivery.')
  }),
  command('design-source.import', ['design-source', 'import', '<source>', '<feature>', '<ref>'], {
    effect: 'write',
    help: H('terrace design-source import <source> <feature> <ref>', 'Import design-source context for a feature'),
    agent: A('terrace-design-source-import', 'terrace design-source import $ARGUMENTS', '<source> <feature> <ref>', 'Import design-source context for a feature.')
  }),
  command('design-source.diff', ['design-source', 'diff', '<source>', '<feature>', '<ref>'], {
    effect: 'write',
    help: H('terrace design-source diff <source> <feature> <ref>', 'Compare imported design-source context for a feature'),
    agent: A('terrace-design-source-diff', 'terrace design-source diff $ARGUMENTS', '<source> <feature> <ref>', 'Compare imported design-source context for a feature.')
  }),

  command('phase.list', ['phase', 'list'], {
    effect: 'read',
    help: H('terrace phase list', 'List roadmap phases'),
    agent: A('terrace-phase-list', 'terrace phase list', '', 'List canonical roadmap phases.')
  }),
  command('phase.show', ['phase', 'show', '<id>'], {
    effect: 'read',
    help: H('terrace phase show <id>', 'Show a roadmap phase'),
    agent: A('terrace-phase-show', 'terrace phase show $ARGUMENTS', '<phase-id>', 'Show one roadmap phase and its migrated plans.')
  }),
  command('phase.plan', ['phase', 'plan', '<id>'], {
    effect: 'write',
    route: ['phase', 'plan', P('phase_id')],
    help: H('terrace phase plan <id>', 'Generate a phase plan artifact'),
    agent: A('terrace-phase-plan', 'terrace phase plan $ARGUMENTS', '<phase-id>', 'Write a migrated-context phase plan artifact.')
  }),
  command('phase.execute', ['phase', 'execute', '<id>'], {
    effect: 'write',
    route: ['phase', 'execute', P('phase_id')],
    help: H('terrace phase execute <id> [--parallel]', 'Enter RED-gate execution for a phase'),
    agent: A('terrace-phase-execute', 'terrace phase execute $ARGUMENTS', '<phase-id> [--parallel]', 'Enter RED-gate execution for a phase after blockers are clear; use --parallel only for explicit non-overlapping plan ownership.')
  }),
  command('parallel.plan', ['parallel', 'plan', '<id>'], {
    effect: 'read',
    help: H('terrace parallel plan <id>', 'Preview safe parallel plan waves and file ownership'),
    agent: A('terrace-parallel-plan', 'terrace parallel plan $ARGUMENTS', '<phase-id>', 'Preview explicit plan dependencies, waves, owned files, and single-writer blockers.')
  }),
  command('parallel.start', ['parallel', 'start', '<id>'], {
    effect: 'write',
    help: H('terrace parallel start <id>', 'Start isolated worktrees for a phase'),
    agent: A('terrace-parallel-start', 'terrace parallel start $ARGUMENTS', '<phase-id>', 'Create isolated worktrees for the ready plan wave after Terrace gates pass.')
  }),
  command('parallel.status', ['parallel', 'status', '<id>'], {
    effect: 'read',
    help: H('terrace parallel status <id>', 'Inspect parallel worker evidence'),
    agent: A('terrace-parallel-status', 'terrace parallel status $ARGUMENTS', '<phase-id|run-id>', 'Inspect worker worktrees, committed changes, ownership, and SUMMARY.md readiness.')
  }),
  command('parallel.resume', ['parallel', 'resume', '<id>'], {
    effect: 'write',
    help: H('terrace parallel resume <id>', 'Recover an interrupted parallel run'),
    agent: A('terrace-parallel-resume', 'terrace parallel resume $ARGUMENTS', '<phase-id|run-id>', 'Recover an interrupted isolated execution run.')
  }),
  command('parallel.merge', ['parallel', 'merge', '<id>'], {
    effect: 'write',
    help: H('terrace parallel merge <id>', 'Merge verified parallel worker commits'),
    agent: A('terrace-parallel-merge', 'terrace parallel merge $ARGUMENTS', '<phase-id|run-id>', 'Merge verified worker commits in deterministic wave and plan-id order.')
  }),
  command('parallel.fail', ['parallel', 'fail', '<id>', '<plan-id>'], {
    effect: 'write',
    help: H('terrace parallel fail <id> <plan-id>', 'Record a failed parallel worker plan'),
    agent: A('terrace-parallel-fail', 'terrace parallel fail $ARGUMENTS', '<phase-id|run-id> <plan-id> --reason <text>', 'Record a failed worker plan while preserving its branch for recovery or review.')
  }),
  command('parallel.cleanup', ['parallel', 'cleanup', '<id>'], {
    effect: 'write',
    help: H('terrace parallel cleanup <id>', 'Clean up an isolated parallel run'),
    agent: A('terrace-parallel-cleanup', 'terrace parallel cleanup $ARGUMENTS', '<phase-id|run-id>', 'Remove isolated worktrees without deleting unmerged branches unless --force is explicit.')
  }),  command('phase.validate', ['phase', 'validate', '<id>'], {
    effect: 'write',
    route: ['phase', 'validate', P('phase_id')],
    help: H('terrace phase validate <id>', 'Generate validation artifact'),
    agent: A('terrace-phase-validate', 'terrace phase validate $ARGUMENTS', '<phase-id>', 'Write a phase validation artifact.')
  }),
  command('phase.review', ['phase', 'review', '<id>'], {
    effect: 'write',
    route: ['phase', 'review', P('phase_id')],
    help: H('terrace phase review <id>', 'Generate review artifact'),
    agent: A('terrace-phase-review', 'terrace phase review $ARGUMENTS', '<phase-id>', 'Write a phase review artifact.')
  }),
  command('phase.complete', ['phase', 'complete', '<id>'], {
    effect: 'write',
    route: ['phase', 'complete', P('phase_id')],
    help: H('terrace phase complete <id>', 'Complete a phase with summary artifact'),
    agent: A('terrace-phase-complete', 'terrace phase complete $ARGUMENTS', '<phase-id>', 'Write a phase summary and mark the phase complete.')
  }),
  command('phase.plan.alias', ['plan-phase', '<id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace plan-phase <id>', 'GSD-compatible alias for phase plan'),
    agent: A('terrace-plan-phase', 'terrace plan-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase planning alias.')
  }),
  command('phase.execute.alias', ['execute-phase', '<id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace execute-phase <id>', 'GSD-compatible alias for phase execute'),
    agent: A('terrace-execute-phase', 'terrace execute-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase execution alias.')
  }),
  command('phase.validate.alias', ['validate-phase', '<id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace validate-phase <id>', 'GSD-compatible alias for phase validate'),
    agent: A('terrace-validate-phase', 'terrace validate-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase validation alias.')
  }),
  command('phase.review.alias', ['review-phase', '<id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace review-phase <id>', 'GSD-compatible alias for phase review'),
    agent: A('terrace-review-phase', 'terrace review-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase review alias.')
  }),
  command('phase.complete.alias', ['complete-phase', '<id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace complete-phase <id>', 'GSD-compatible alias for phase complete'),
    agent: A('terrace-complete-phase', 'terrace complete-phase $ARGUMENTS', '<phase-id>', 'Run the GSD-compatible phase completion alias.')
  }),

  command('quick.list', ['quick', 'list'], {
    effect: 'read',
    route: ['quick', 'list'],
    help: H('terrace quick list', 'List migrated quick-task history'),
    agent: A('terrace-quick-list', 'terrace quick list', '', 'List migrated GSD quick-task history.')
  }),
  command('quick.show', ['quick', 'show', '<id>'], {
    effect: 'read',
    help: H('terrace quick show <id>', 'Show one migrated quick task'),
    agent: A('terrace-quick-show', 'terrace quick show $ARGUMENTS', '<quick-task-id>', 'Show one migrated quick task.')
  }),
  command('quick.plan', ['quick', 'plan', '<title>'], {
    effect: 'write',
    route: ['quick', 'plan', P('title')],
    help: H('terrace quick plan <title>', 'Create a stateful quick-task plan'),
    agent: A('terrace-quick-plan', 'terrace quick plan "$ARGUMENTS"', '<title>', 'Create a stateful quick-task plan.')
  }),
  command('quick.execute', ['quick', 'execute', '<id>'], {
    effect: 'write',
    help: H('terrace quick execute <id>', 'Enter RED-gate execution for a quick task'),
    agent: A('terrace-quick-execute', 'terrace quick execute $ARGUMENTS', '<quick-task-id>', 'Enter RED-gate execution for a quick task.')
  }),
  command('quick.complete', ['quick', 'complete', '<id>'], {
    effect: 'write',
    help: H('terrace quick complete <id>', 'Complete a quick task'),
    agent: A('terrace-quick-complete', 'terrace quick complete $ARGUMENTS', '<quick-task-id>', 'Complete a quick task after verification evidence exists.')
  }),
  command('backlog.list', ['backlog', 'list'], {
    effect: 'read',
    help: H('terrace backlog list', 'List backlog items'),
    agent: A('terrace-backlog-list', 'terrace backlog list', '', 'List backlog items.')
  }),
  command('backlog.add', ['backlog', 'add', '<title>'], {
    effect: 'write',
    help: H('terrace backlog add <title>', 'Add a backlog item'),
    agent: A('terrace-backlog-add', 'terrace backlog add "$ARGUMENTS"', '<title>', 'Append a backlog item.')
  }),

  command('ship.check', ['ship', 'check', '[--fast|--local|--full]'], {
    effect: 'read',
    route: ['ship', 'check'],
    help: H('terrace ship check [--fast|--local|--full]', 'Run release readiness checks'),
    agent: A('terrace-ship-check', 'terrace ship check', '', 'Run read-only release readiness checks; use --full only to execute project scripts.'),
    variants: [{ when: '--full', effect: 'executes_project', execution: ['Runs discovered project quality scripts outside Terrace artifact ownership.'] }]
  }),
  command('ship.prepare', ['ship', 'prepare', '[--fast|--local|--full]'], {
    effect: 'write',
    route: ['ship', 'prepare'],
    help: H('terrace ship prepare [--fast|--local|--full]', 'Write PR/release readiness summary'),
    agent: A('terrace-ship-prepare', 'terrace ship prepare', '', 'Write a release-readiness summary; --fast skips project scripts but still writes the summary.')
  }),
  command('release-preflight', ['release-preflight', '[--static]', '[--fast|--local|--full]', '[--target-version', '<version>]'], {
    effect: 'mixed',
    aliases: [{ id: 'release.preflight', argv_pattern: ['release', 'preflight'], visibility: 'compatibility' }],
    help: H('terrace release-preflight [--static] [--fast|--local|--full] [--target-version <version>]', 'Run Terrace 0.2.0 release preflight summary'),
    agent: A('terrace-release-preflight', 'terrace release-preflight $ARGUMENTS', '[--target-version <version>] [--static]', 'Run Terrace 0.2.0 release preflight and summarize trusted publishing, tag/version alignment, and stale release instructions.')
  }),
  command('report', ['report', '[update|open|history|ceremony]'], {
    effect: 'mixed',
    help: H('terrace report [update|open|history|ceremony]', 'Read or update report-card evidence'),
    agent: A('terrace-report', 'terrace report $ARGUMENTS', '[update|open|history|ceremony]', 'Read or update the Terrace report card and report history.')
  }),
  command('handoff.create', ['handoff', 'create', '[--feature', '<id>]', '[--for', 'codex|claude|generic]'], {
    effect: 'write',
    help: H('terrace handoff create [--feature <id>] [--for codex|claude|generic]', 'Create an agent or session handoff pack'),
    agent: A('terrace-handoff-create', 'terrace handoff create $ARGUMENTS', '[--feature <id>] [--for codex|claude|generic]', 'Create a Terrace handoff pack for another agent or session.')
  }),
  command('debt', ['debt', 'add|list|audit|resolve'], {
    effect: 'mixed',
    help: H('terrace debt add|list|audit|resolve', 'Manage production debt entries and release gates'),
    agent: A('terrace-debt', 'terrace debt $ARGUMENTS', 'add|list|audit|resolve', 'Manage production debt entries and release debt gates.')
  }),
  command('preflight', ['preflight', '<feature>'], {
    effect: 'write',
    help: H('terrace preflight <feature>', 'Write production failure preflight'),
    agent: A('terrace-preflight', 'terrace preflight $ARGUMENTS', '<feature>', 'Write production failure preflight evidence for a feature.')
  }),
  command('docu', ['docu', '<feature>'], {
    effect: 'write',
    help: H('terrace docu <feature>', 'Write production documentation draft'),
    agent: A('terrace-docu', 'terrace docu $ARGUMENTS', '<feature>', 'Write production documentation and runbook draft evidence.')
  }),
  command('test.eval', ['test', 'eval', '[--feature', '<id>]', '[--changed]'], {
    effect: 'write',
    help: H('terrace test eval', 'Evaluate test-suite trust'),
    agent: A('terrace-test-eval', 'terrace test eval $ARGUMENTS', '[--feature <id>] [--changed]', 'Evaluate test-suite trust and record evidence.')
  }),
  command('review.ai', ['review', 'ai', '--mode', '<mode>'], {
    effect: 'write',
    help: H('terrace review ai --mode <mode>', 'Run an AI release-review evidence pass'),
    agent: A('terrace-review-ai', 'terrace review ai $ARGUMENTS', '--mode <mode>', 'Run an AI release review evidence pass.')
  }),
  command('waive', ['waive', '<gate>'], {
    effect: 'write',
    help: H('terrace waive <gate>', 'Record a reviewed temporary waiver'),
    agent: A('terrace-waive', 'terrace waive $ARGUMENTS', '<gate> [--reason <text>] [--owner <name>] [--expires <date>]', 'Record a reviewed temporary gate waiver.')
  }),
  command('workbench.status', ['workbench', 'status', '[--feature', '<id>]'], {
    effect: 'read',
    route: ['workbench', 'status', O('feature_id', '--feature')],
    help: H('terrace workbench status [--feature <id>]', 'Read production workbench readiness'),
    agent: A('terrace-workbench-status', 'terrace workbench status $ARGUMENTS', '[--feature <id>]', 'Read production workbench readiness for a feature.')
  }),
  command('workbench.prepare', ['workbench', 'prepare', '<feature>', '[--tier', 'small|medium|large]', '[--for', 'codex|claude|generic]'], {
    effect: 'write',
    route: ['workbench', 'prepare', P('feature_id'), O('target', '--for')],
    help: H('terrace workbench prepare <feature> [--tier small|medium|large] [--for codex|claude|generic]', 'Prepare production workbench evidence'),
    agent: A('terrace-workbench-prepare', 'terrace workbench prepare $ARGUMENTS', '<feature> [--tier small|medium|large] [--for codex|claude|generic]', 'Prepare production workbench evidence and optional handoff artifacts.')
  }),

  command('rule.add', ['rule', 'add', '<domain>', '<rule-id>'], {
    effect: 'write',
    aliases: [{ id: 'add.rule', argv_pattern: ['add', 'rule', '<domain>', '<rule-id>'], visibility: 'compatibility' }],
    help: H('terrace rule add <domain> <rule-id>', 'Add a rule to the project rule pack'),
    agent: A('terrace-rule-add', 'terrace rule add $ARGUMENTS', '<domain> <rule-id>', 'Add a Terrace rule to the project rule pack.')
  }),
  command('rule.audit', ['rule', 'audit', '[--effectiveness]'], {
    effect: 'write',
    help: H('terrace rule audit', 'Audit installed rule packs and evidence'),
    agent: A('terrace-rule-audit', 'terrace rule audit $ARGUMENTS', '[--effectiveness]', 'Audit installed Terrace rules and rule evidence.')
  }),
  command('rule.list', ['rule', 'list'], {
    effect: 'read',
    help: H('terrace rule list', 'List installed rule packs'),
    agent: A('terrace-rule-list', 'terrace rule list', '', 'List installed rule packs.')
  }),
  command('rule.explain', ['rule', 'explain', '<id>'], {
    effect: 'read',
    help: H('terrace rule explain <id>', 'Explain a rule'),
    agent: A('terrace-rule-explain', 'terrace rule explain $ARGUMENTS', '<rule-id>', 'Explain a Terrace rule.')
  }),
  command('backfill', ['backfill', '[--rule', '<id>]', '[--since', '<ref>]', '[--feature', '<id>]'], {
    effect: 'write',
    help: H('terrace backfill', 'Write standards backfill spec'),
    agent: A('terrace-backfill', 'terrace backfill $ARGUMENTS', '[--rule <id>] [--since <ref>] [--feature <id>]', 'Write standards backfill evidence.')
  }),
  command('preset.list', ['preset', 'list'], {
    effect: 'read',
    help: H('terrace preset list', 'List installed presets'),
    agent: A('terrace-preset-list', 'terrace preset list', '', 'List installed presets.')
  }),
  command('preset.install', ['preset', 'install', '<id>'], {
    effect: 'write',
    help: H('terrace preset install <id>', 'Install a preset'),
    agent: A('terrace-preset-install', 'terrace preset install $ARGUMENTS', '<preset-id>', 'Install a Terrace preset.')
  }),

  command('core.init', ['core', 'init'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace core init', 'Compatibility alias for terrace init')
  }),
  command('quick.roadmap-item', ['quick', '<roadmap-item-id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace quick <roadmap-item-id>', 'Compatibility form for roadmap quick execution')
  }),
  command('roadmap.execute', ['roadmap', 'execute', '<roadmap-item-id>'], {
    effect: 'write',
    visibility: 'compatibility',
    help: H('terrace roadmap execute <roadmap-item-id>', 'Compatibility form for roadmap execution')
  }),
  command('report.update', ['report', 'update'], { effect: 'write', visibility: 'advanced' }),
  command('report.open', ['report', 'open'], { effect: 'read', visibility: 'advanced' }),
  command('report.history', ['report', 'history'], { effect: 'read', visibility: 'advanced' }),
  command('report.ceremony', ['report', 'ceremony'], { effect: 'read', visibility: 'advanced' }),
  command('debt.add', ['debt', 'add', '<feature>'], { effect: 'write', visibility: 'advanced' }),
  command('debt.list', ['debt', 'list'], { effect: 'read', visibility: 'advanced' }),
  command('debt.audit', ['debt', 'audit'], { effect: 'write', visibility: 'advanced' }),
  command('debt.resolve', ['debt', 'resolve', '<id>'], { effect: 'write', visibility: 'advanced' }),
  command('phase.set', ['phase', 'set', '<workflow-status>'], { effect: 'write', visibility: 'internal' }),
  command('interrogate.mode', ['interrogate', '<init|adjust|risk|milestone>', '<feature>'], { effect: 'write', visibility: 'advanced' }),
  command('steering', ['steering'], { effect: 'write', visibility: 'internal' }),
  command('baseline.protect', ['baseline', 'protect', '<file>', '--spec-ref', '<spec-id>'], { effect: 'write', visibility: 'internal' }),
  command('baseline.status', ['baseline', 'status'], { effect: 'read', visibility: 'internal' }),
  command('decision.log', ['decision', 'log', '--spec-ref', '<spec-id>'], { effect: 'write', visibility: 'internal' }),
  command('policy', ['policy'], { effect: 'write', visibility: 'internal' }),
  command('session.start', ['session', 'start'], { effect: 'write', visibility: 'internal' }),
  command('session.end', ['session', 'end'], { effect: 'write', visibility: 'internal' }),
  command('session.reconstruct', ['session', 'reconstruct'], { effect: 'read', visibility: 'internal' }),
  command('migrate', ['migrate'], { effect: 'write', visibility: 'internal' })
]);

const CONTRACTS = Object.freeze([
  ['next', 'terrace next', 'workflow', 'Report the next Terrace action from state, handoff, and blockers.'],
  ['resume', 'terrace resume', 'workflow', 'Reconstruct paused workflow context from Terrace sessions and migrated handoff data.'],
  ['blocker.list', 'terrace blocker list', 'workflow', 'List migrated blocking actions with stable IDs and resolution state.'],
  ['blocker.resolve', 'terrace blocker resolve <id> --owner <owner> --evidence <ref>', 'workflow', 'Record an evidence-bearing correction for one blocking action before retrying its stage.'],
  ['history', 'terrace history', 'workflow', 'Summarize migrated operational history across phases, sessions, decisions, and quick tasks.'],
  ['do', 'terrace do <intent> | --apply <plan-token>', 'workflow', 'Preview natural-language intent by default; --apply accepts only the state-bound token returned for a reviewed write-capable route.'],
  ['autonomous', 'terrace autonomous', 'workflow', 'Run next phase planning and execution readiness until Terrace reaches a blocker or agent handoff.'],
  ['phase.execute-complete', 'terrace execute-phase-complete <id>', 'workflow', 'Run the Terrace phase lifecycle end to end, stopping at blockers instead of bypassing gates.'],
  ['settings.effort', 'terrace settings effort <fast|standard|thorough>', 'workflow', 'Persist the default phase effort used by Terrace planning and execution artifacts.'],
  ['commands.discover', 'terrace commands discover', 'workflow', 'Discover project package scripts and Terrace quality-gate command mapping.'],
  ['align', 'terrace align <feature>', 'senior-cycle', 'Create the senior-cycle alignment artifact with customer, problem, metrics, risks, rollout, validation, and cleanup intent.'],
  ['interrogate', 'terrace interrogate <feature>', 'senior-cycle', 'Capture user-driven edge-case, assumption-challenge, and failure-mode interrogation before writing artifacts.'],
  ['map-codebase', 'terrace map-codebase', 'senior-cycle', 'Create codebase map, architecture, risk, testing, and observability context artifacts.'],
  ['design', 'terrace design <feature>', 'senior-cycle', 'Create architecture and maintainability decision artifacts with the no band-aid rule.'],
  ['test-plan', 'terrace test-plan <feature>', 'senior-cycle', 'Create the behavior-first test strategy required before implementation.'],
  ['observe', 'terrace observe <feature>', 'senior-cycle', 'Create the feature observability and post-launch debugging plan.'],
  ['validate-prod', 'terrace validate-prod <feature>', 'senior-cycle', 'Create production validation signals, monitoring plan, and rollback conditions.'],
  ['cleanup', 'terrace cleanup <feature>', 'senior-cycle', 'Create the cleanup contract for flags, temporary code, and documentation.'],
  ['ui.import-stitch', 'terrace ui import-stitch <feature>', 'ui', 'Capture imported Stitch design intent for greenfield or brownfield UI work.'],
  ['ui.plan-refresh', 'terrace ui plan-refresh <feature>', 'ui', 'Create a UI refresh plan from imported design context.'],
  ['ui.diff', 'terrace ui diff <feature>', 'ui', 'Create a source-to-target UI diff for implementation and verification.'],
  ['phase.list', 'terrace phase list', 'roadmap', 'List canonical Terrace roadmap phases.'],
  ['phase.show', 'terrace phase show <id>', 'roadmap', 'Show one canonical Terrace roadmap phase and its migrated plans.'],
  ['phase.plan', 'terrace phase plan <id>', 'roadmap', 'Generate a phase plan artifact and prepare one roadmap phase as the active slice.'],
  ['phase.execute', 'terrace phase execute <id>', 'roadmap', 'Enter RED-gate execution for one phase after blockers are clear.'],
  ['parallel.plan', 'terrace parallel plan <id>', 'parallel-execution', 'Preview explicit plan dependencies, waves, owned files, and single-writer blockers before creating worktrees.'],
  ['parallel.start', 'terrace parallel start <id>', 'parallel-execution', 'Create one isolated branch/worktree for each ready plan wave after Terrace gates pass.'],
  ['parallel.status', 'terrace parallel status <id>', 'parallel-execution', 'Inspect worker worktrees, committed changes, ownership, and SUMMARY.md readiness.'],
  ['parallel.resume', 'terrace parallel resume <id>', 'parallel-execution', 'Recover an interrupted run by reconciling recorded branches and worktree paths.'],
  ['parallel.merge', 'terrace parallel merge <id>', 'parallel-execution', 'Merge verified worker commits in deterministic wave and plan-id order.'],
  ['parallel.fail', 'terrace parallel fail <id> <plan-id>', 'parallel-execution', 'Record a failed worker plan while preserving its branch for recovery or review.'],
  ['parallel.cleanup', 'terrace parallel cleanup <id>', 'parallel-execution', 'Remove isolated worktrees without deleting unmerged branches unless --force is explicit.'],
  ['phase.validate', 'terrace phase validate <id>', 'roadmap', 'Generate validation instructions and move a phase to review readiness.'],
  ['phase.review', 'terrace phase review <id>', 'roadmap', 'Generate review checklist output for a phase.'],
  ['phase.complete', 'terrace phase complete <id>', 'roadmap', 'Complete a phase and write a summary artifact.'],
  ['quick.list', 'terrace quick list', 'quick-history', 'List migrated GSD quick-task history.'],
  ['quick.show', 'terrace quick show <id>', 'quick-history', 'Show one migrated GSD quick task.'],
  ['quick.plan', 'terrace quick plan <title>', 'quick-task', 'Create a stateful Terrace quick-task plan.'],
  ['quick.execute', 'terrace quick execute <id>', 'quick-task', 'Enter RED-gate execution for a quick task.'],
  ['quick.complete', 'terrace quick complete <id>', 'quick-task', 'Complete a quick task and write a summary artifact.'],
  ['backlog.list', 'terrace backlog list', 'backlog', 'List canonical Terrace backlog items.'],
  ['backlog.add', 'terrace backlog add <title>', 'backlog', 'Append a Terrace backlog item.'],
  ['corpus.run', 'terrace corpus run', 'corpus', 'Run the local Terrace corpus evaluator.'],
  ['corpus.report', 'terrace corpus report', 'corpus', 'Show the latest Terrace corpus report summary.'],
  ['ship.check', 'terrace ship check', 'shipping', 'Run read-only release-readiness checks without executing project package scripts.'],
  ['ship.check', 'terrace ship check --fast', 'shipping', 'Explicitly run the default read-only Terrace gates without executing project package scripts.'],
  ['ship.prepare', 'terrace ship prepare', 'shipping', 'Write a PR-ready summary after a clean full ship check; use --fast for a read-only snapshot before writing.'],
  ['release-preflight', 'terrace release-preflight', 'shipping', 'Run the Terrace 0.2.0 release preflight flow and summarize trusted publishing, version tags, and stale release instructions.'],
  ['workbench.status', 'terrace workbench status [--feature <id>]', 'shipping', 'Read release evidence, senior-cycle gaps, workstreams, debt, security, test eval, and report-card claim scope for one feature.'],
  ['workbench.prepare', 'terrace workbench prepare <feature>', 'shipping', 'Write production workbench artifacts from existing Terrace primitives: preflight, runbook, release AI review, workstreams, and optional handoff.'],
  ['report.ceremony', 'terrace report ceremony', 'shipping', 'Check artifact count, generated word volume, and low-density documentation signals.'],
  ['waive', 'terrace waive <gate>', 'shipping', 'Record a reviewed temporary gate waiver with owner, reason, and expiry.'],
  ['port.gsd.compare', 'terrace port gsd --compare', 'migration', 'Compare legacy GSD concepts against Terrace migration coverage before porting.'],
  ['port.gsd.verify-parity', 'terrace port gsd --verify-parity', 'migration', 'Fail when legacy GSD concepts are present but unmapped by Terrace migration.'],
  ['port.gsd.import-roadmap', 'terrace port gsd --import-roadmap', 'migration', 'Merge missing legacy roadmap phases into existing Terrace state without overwriting existing phase objects.'],
  ['planning.refresh', 'terrace planning refresh', 'planning', 'Initialize or refresh the repo .planning package from Terrace state and repository analysis.'],
  ['security.check', 'terrace security check', 'security', 'Run deterministic local security checks and write Terrace security evidence.']
].map(([commandId, commandName, category, purpose]) => Object.freeze({
  command_id: commandId,
  command: commandName,
  category,
  json: true,
  purpose
})));

const GLOBAL_OPTIONS = Object.freeze([
  ['--help, -h', 'Show this help'],
  ['--version, -v', 'Print Terrace version'],
  ['--json', 'Print machine-readable JSON where supported'],
  ['--apply', 'Apply a state-bound natural-language plan token from terrace do']
]);

const CATALOG_BY_ID = new Map(COMMAND_CATALOG.map((entry) => [entry.id, entry]));

function cloneAliases(aliases) {
  return aliases.map((alias) => ({ ...alias, argv_pattern: [...alias.argv_pattern] }));
}

function cloneRouteArgv(routeArgv) {
  return routeArgv.map((token) => typeof token === 'string' ? token : { ...token });
}

function cloneDispatch(dispatchEntry) {
  return dispatchEntry ? {
    owner: dispatchEntry.owner,
    forms: dispatchEntry.forms.map((form) => ({
      literals: [...form.literals],
      required_flags: [...form.required_flags],
      priority: form.priority,
      kind: form.kind,
      family_id: form.family_id,
      match: form.match,
      alias_id: form.alias_id
    }))
  } : null;
}

function cloneCommand(entry) {
  return {
    ...entry,
    argv_pattern: [...entry.argv_pattern],
    aliases: cloneAliases(entry.aliases),
    help: entry.help ? { ...entry.help } : null,
    agent: entry.agent ? { ...entry.agent } : null,
    writes: [...entry.writes],
    execution: [...entry.execution],
    variants: entry.variants.map((variant) => ({ ...variant, execution: [...(variant.execution || [])] })),
    route_argv: cloneRouteArgv(entry.route_argv),
    dispatch: cloneDispatch(entry.dispatch),
    contracts: CONTRACTS.filter((contract) => contract.command_id === entry.id).map((contract) => ({ ...contract }))
  };
}

function listCommandCatalog() {
  return COMMAND_CATALOG.map(cloneCommand);
}

function commandById(id) {
  const entry = CATALOG_BY_ID.get(id);
  return entry ? cloneCommand(entry) : null;
}

function renderCommandArgv(commandId, parameters) {
  const entry = CATALOG_BY_ID.get(commandId);
  if (!entry) {
    throw new Error('Unknown Terrace command catalog id: ' + commandId);
  }
  if (entry.route_argv.length === 0) {
    throw new Error('Terrace command catalog id has no intent-safe argv shape: ' + commandId);
  }
  const values = parameters || {};
  const argv = [];
  for (const token of entry.route_argv) {
    if (typeof token === 'string') {
      argv.push(token);
      continue;
    }
    const value = values[token.name];
    if (token.kind === 'option') {
      if (value === undefined || value === null || value === '') continue;
      argv.push(token.flag, String(value));
      continue;
    }
    if (token.kind === 'parameter') {
      if (value === undefined || value === null || value === '') {
        throw new Error('Missing route parameter ' + token.name + ' for command catalog id: ' + commandId);
      }
      argv.push(String(value));
      continue;
    }
    throw new Error('Unsupported command route token for catalog id: ' + commandId);
  }
  return argv;
}

function formatCommandDisplay(argv) {
  // Compatibility display only; callers execute the argv array, never this text.
  return ['terrace', ...argv].join(' ');
}

function helpEntry(entry) {
  return {
    id: entry.id,
    usage: entry.help.usage,
    summary: entry.help.summary,
    effect: entry.effect,
    json: entry.json,
    visibility: entry.visibility
  };
}

function listHelpCommands() {
  return COMMAND_CATALOG
    .filter((entry) => entry.help && entry.help.visible)
    .map(helpEntry);
}

function listHelpCatalog() {
  return COMMAND_CATALOG.map((entry) => ({
    id: entry.id,
    usage: entry.help ? entry.help.usage : formatCommandDisplay(entry.argv_pattern),
    summary: entry.help ? entry.help.summary : null,
    effect: entry.effect,
    visibility: entry.visibility,
    aliases: entry.aliases.map((alias) => ({
      id: alias.id,
      usage: formatCommandDisplay(alias.argv_pattern),
      visibility: alias.visibility || 'compatibility'
    }))
  }));
}

function aliasHelpEntry(entry, alias) {
  return {
    id: alias.id,
    usage: formatCommandDisplay(alias.argv_pattern),
    summary: 'Compatibility alias for ' + (entry.help ? entry.help.usage : formatCommandDisplay(entry.argv_pattern)),
    effect: entry.effect,
    json: entry.json,
    visibility: 'compatibility'
  };
}

function uniqueHelpEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.usage)) return false;
    seen.add(entry.usage);
    return true;
  });
}

function listCliHelpSections() {
  const helpCommands = listHelpCommands();
  const compatibility = [
    ...helpCommands.filter((entry) => entry.visibility === 'compatibility'),
    ...COMMAND_CATALOG.flatMap((entry) => entry.aliases
      .filter((alias) => (alias.visibility || 'compatibility') === 'compatibility')
      .map((alias) => aliasHelpEntry(entry, alias)))
  ];
  return {
    common: helpCommands.filter((entry) => entry.visibility === 'primary'),
    advanced: helpCommands.filter((entry) => entry.visibility === 'advanced'),
    compatibility: uniqueHelpEntries(compatibility)
  };
}

function formatHelpEntries(entries) {
  const width = entries.reduce((maximum, entry) => Math.max(maximum, entry.usage.length), 0);
  return entries.map((entry) => '  ' + entry.usage.padEnd(width + 1) + entry.summary);
}

function renderCliHelp() {
  const sections = listCliHelpSections();
  return [
    'Usage: terrace <command> [options]',
    '',
    'Common workflow:',
    ...formatHelpEntries(sections.common),
    '',
    'Advanced commands:',
    ...formatHelpEntries(sections.advanced),
    '',
    'Compatibility aliases:',
    ...formatHelpEntries(sections.compatibility),
    '',
    'Use `terrace --help --json` for the complete command catalog and alias metadata.',
    '',
    'Global options:',
    ...GLOBAL_OPTIONS.map(([option, description]) => '  ' + option.padEnd(18) + description)
  ].join('\n');
}

function renderCliHelpJson() {
  return {
    command: 'terrace --help',
    usage: 'terrace <command> [options]',
    sections: listCliHelpSections(),
    commands: listHelpCatalog(),
    global_options: GLOBAL_OPTIONS.map(([option, description]) => ({ option, description }))
  };
}

function renderReadmeCommandIndex() {
  return [
    '<!-- terrace-command-catalog:start -->',
    ...listHelpCommands().map((entry) => '- `' + entry.usage + '`' + (entry.summary ? ' — ' + entry.summary + '.' : '')),
    '',
    'Global options: `--help`, `--version`, `--json`, and `--apply`.',
    '<!-- terrace-command-catalog:end -->'
  ].join('\n');
}

function listAgentCommands() {
  return COMMAND_CATALOG
    .filter((entry) => entry.agent)
    .map((entry) => ({
      id: entry.id,
      name: entry.agent.template_id,
      command: entry.agent.invocation,
      argumentHint: entry.agent.argument_hint,
      description: entry.agent.description,
      help: entry.help ? entry.help.usage : undefined,
      effect: entry.effect,
      visibility: entry.visibility
    }));
}

function listProductReadinessSurface() {
  return listAgentCommands().map((entry) => ({ name: entry.name, help: entry.help }));
}

function listCommandContracts() {
  return CONTRACTS.map((contract) => ({
    command: contract.command,
    category: contract.category,
    json: contract.json,
    purpose: contract.purpose
  }));
}

function validateCommandCatalog() {
  const duplicateIds = [];
  const duplicateAgentNames = [];
  const seenIds = new Set();
  const seenAgents = new Set();
  const missingContractCommands = [];
  const missingDispatchCommands = [];
  const invalidDispatchCommands = [];

  for (const entry of COMMAND_CATALOG) {
    if (seenIds.has(entry.id)) duplicateIds.push(entry.id);
    seenIds.add(entry.id);
    if (entry.agent) {
      if (seenAgents.has(entry.agent.template_id)) duplicateAgentNames.push(entry.agent.template_id);
      seenAgents.add(entry.agent.template_id);
    }
    if (!entry.dispatch) {
      missingDispatchCommands.push(entry.id);
    } else if (!entry.dispatch.owner || entry.dispatch.forms.length === 0 || entry.dispatch.forms.some((form) => (
      !['command', 'family'].includes(form.kind)
      || !['prefix', 'exact'].includes(form.match)
      || form.literals.length === 0
      || (form.kind === 'family' && !form.family_id)
    ))) {
      invalidDispatchCommands.push(entry.id);
    }
  }
  for (const contract of CONTRACTS) {
    if (!CATALOG_BY_ID.has(contract.command_id)) missingContractCommands.push(contract.command_id);
  }

  return {
    schema_version: CATALOG_SCHEMA_VERSION,
    valid: duplicateIds.length === 0 && duplicateAgentNames.length === 0 && missingContractCommands.length === 0 && missingDispatchCommands.length === 0 && invalidDispatchCommands.length === 0,
    duplicate_ids: duplicateIds,
    duplicate_agent_names: duplicateAgentNames,
    missing_contract_commands: missingContractCommands,
    missing_dispatch_commands: missingDispatchCommands,
    invalid_dispatch_commands: invalidDispatchCommands,
    command_count: COMMAND_CATALOG.length,
    help_count: listHelpCommands().length,
    agent_count: listAgentCommands().length,
    contract_count: CONTRACTS.length
  };
}

module.exports = {
  CATALOG_SCHEMA_VERSION,
  commandById,
  formatCommandDisplay,
  listAgentCommands,
  listCliHelpSections,
  listCommandCatalog,
  listCommandContracts,
  listHelpCatalog,
  listHelpCommands,
  listProductReadinessSurface,
  renderCommandArgv,
  renderCliHelp,
  renderCliHelpJson,
  renderReadmeCommandIndex,
  validateCommandCatalog
};
