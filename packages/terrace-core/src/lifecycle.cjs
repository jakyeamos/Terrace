'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');

function nowIso() {
  return new Date().toISOString();
}

function timestampId() {
  return nowIso().replace(/[:.]/g, '-');
}

function ensureDirFor(cwd, relativeFilePath) {
  fs.mkdirSync(path.dirname(path.resolve(cwd, relativeFilePath)), { recursive: true });
}

function writeText(cwd, relativeFilePath, content) {
  ensureDirFor(cwd, relativeFilePath);
  fs.writeFileSync(path.resolve(cwd, relativeFilePath), content, 'utf8');
  return relativeFilePath;
}

function writeJson(cwd, relativeFilePath, data) {
  return writeText(cwd, relativeFilePath, JSON.stringify(data, null, 2) + '\n');
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  return writeText(cwd, relativeFilePath, lines.join('\n') + '\n');
}

function relativeExists(cwd, relativeFilePath) {
  return fs.existsSync(path.resolve(cwd, relativeFilePath));
}

function featureRef(featureId) {
  return 'docs/terrace/features/' + featureId;
}

function normalizeFeatureId(feature) {
  const id = String(feature || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id) {
    throw new Error('Usage: terrace <command> <feature>');
  }
  return id;
}

function readJsonIfExists(cwd, relativeFilePath, fallback) {
  const filePath = path.resolve(cwd, relativeFilePath);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function activeFeature(state) {
  return state.senior_cycle && state.senior_cycle.active_feature
    ? state.senior_cycle.active_feature
    : state.workflow && state.workflow.active_feature
      ? state.workflow.active_feature
      : null;
}

function activeFeatureState(state) {
  const featureId = activeFeature(state);
  if (!featureId) {
    return null;
  }
  const features = state.senior_cycle && state.senior_cycle.features ? state.senior_cycle.features : {};
  const feature = features[featureId] || {};
  return {
    feature_id: featureId,
    tier: feature.tier || 'medium',
    artifacts: feature.artifacts || {}
  };
}

function seniorArtifactRefs(featureId) {
  const base = featureRef(featureId);
  return [
    base + '/ALIGNMENT.md',
    base + '/INTERROGATION.md',
    'docs/terrace/codebase/MAP.md',
    'docs/terrace/codebase/ARCHITECTURE.md',
    'docs/terrace/codebase/RISKS.md',
    base + '/DESIGN.md',
    'docs/testing/TEST-PLAN.md',
    base + '/OBSERVABILITY.md',
    base + '/VALIDATION.md',
    base + '/CLEANUP.md'
  ];
}

function currentChangedFiles(cwd) {
  try {
    const output = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    return null;
  }
}

function scoreStatus(score) {
  if (score >= 95) {
    return 'tier_one_ready';
  }
  if (score >= 85) {
    return 'strong_with_gaps';
  }
  if (score >= 70) {
    return 'usable_not_tier_one';
  }
  if (score >= 50) {
    return 'foundations_incomplete';
  }
  return 'planning_or_governance_weak';
}

function reportCheck(id, label, passed, points, evidence, remediation) {
  return {
    id,
    label,
    passed,
    points,
    earned: passed ? points : 0,
    evidence,
    remediation: passed ? null : remediation
  };
}

function debtEntries(state) {
  return Array.isArray(state.debt) ? state.debt : [];
}

function preflightEntries(state) {
  return state.preflights && typeof state.preflights === 'object' ? state.preflights : {};
}

function documentationEntries(state) {
  return state.documentation && typeof state.documentation === 'object' ? state.documentation : {};
}

function testEvaluationEntries(state) {
  return Array.isArray(state.test_evaluations) ? state.test_evaluations : [];
}

function aiReviewEntries(state) {
  return Array.isArray(state.ai_reviews) ? state.ai_reviews : [];
}

function ruleAuditEntries(state) {
  return Array.isArray(state.rule_audits) ? state.rule_audits : [];
}

function backfillEntries(state) {
  return Array.isArray(state.backfills) ? state.backfills : [];
}

function workstreamEntries(state) {
  return state.workstreams && typeof state.workstreams === 'object' ? state.workstreams : {};
}

function designSourceEntries(state) {
  return state.design_sources && typeof state.design_sources === 'object' ? state.design_sources : {};
}

function reportInputs(cwd, state) {
  const feature = activeFeatureState(state);
  const missingSeniorArtifacts = feature
    ? seniorArtifactRefs(feature.feature_id).filter((artifact) => !relativeExists(cwd, artifact))
    : [];
  const debts = debtEntries(state);
  const debtAudit = auditDebtState(debts);
  const preflights = preflightEntries(state);
  const hasActivePreflight = feature ? Boolean(preflights[feature.feature_id]) : Object.keys(preflights).length > 0;
  const completedPhases = state.roadmap && Array.isArray(state.roadmap.phases)
    ? state.roadmap.phases.filter((phase) => phase.status === 'completed')
    : [];
  const completedQuickTasks = Array.isArray(state.quick_tasks)
    ? state.quick_tasks.filter((task) => task.status === 'completed')
    : [];
  let audit;
  try {
    audit = runAudit(cwd);
  } catch (error) {
    audit = {
      healthy: false,
      blocking: [{ code: 'AUDIT_UNAVAILABLE', message: error && error.message ? error.message : String(error) }],
      warnings: []
    };
  }
  return {
    feature,
    missingSeniorArtifacts,
    debts,
    debtAudit,
    preflights,
    hasActivePreflight,
    completedPhases,
    completedQuickTasks,
    audit
  };
}

function buildReportCard(cwd, command) {
  const state = loadState(cwd);
  const inputs = reportInputs(cwd, state);
  const hasActiveFeature = Boolean(inputs.feature);
  const hasDocs = inputs.feature ? relativeExists(cwd, featureRef(inputs.feature.feature_id) + '/DOCS.md') : false;
  const hasTestEval = relativeExists(cwd, 'docs/testing/TEST-EVAL.md');
  const packageJson = readJsonIfExists(cwd, 'package.json', {});
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const hasTestScripts = Boolean(scripts.test && scripts['test:coverage']);
  const hasRuleAudit = Array.isArray(state.rule_audits) && state.rule_audits.length > 0;
  const checks = [
    reportCheck('senior_cycle', 'Senior Cycle artifacts', inputs.missingSeniorArtifacts.length === 0, 20, {
      active_feature: inputs.feature ? inputs.feature.feature_id : null,
      missing_artifacts: inputs.missingSeniorArtifacts
    }, 'Run the next senior-cycle command for the active feature.'),
    reportCheck('production_preflight', 'Production preflight', !hasActiveFeature || inputs.hasActivePreflight, 15, {
      active_feature: inputs.feature ? inputs.feature.feature_id : null,
      preflight_count: Object.keys(inputs.preflights).length,
      skipped: !hasActiveFeature
    }, 'Run `terrace preflight <feature>`.'),
    reportCheck('debt_health', 'Debt health', inputs.debtAudit.blockers.length === 0, 15, {
      open_debt_count: inputs.debts.filter((entry) => entry.status !== 'resolved').length,
      blockers: inputs.debtAudit.blockers
    }, 'Resolve expired or ownerless debt, or add owner and expiry metadata.'),
    reportCheck('governance_audit', 'Governance audit', inputs.audit.blocking.length === 0, 15, {
      blocking_count: inputs.audit.blocking.length,
      warning_count: inputs.audit.warnings.length
    }, 'Run `terrace audit` and fix blocking findings.'),
    reportCheck('completed_outcomes', 'Completed sprint outcomes', !hasActiveFeature || inputs.completedPhases.length + inputs.completedQuickTasks.length > 0, 10, {
      completed_phases: inputs.completedPhases.map((phase) => phase.id),
      completed_quick_tasks: inputs.completedQuickTasks.map((task) => task.id),
      skipped: !hasActiveFeature
    }, 'Complete at least one phase or quick task through Terrace.'),
    reportCheck('documentation', 'Documentation status', !hasActiveFeature || hasDocs, 10, {
      active_feature: inputs.feature ? inputs.feature.feature_id : null,
      docs_ref: inputs.feature ? featureRef(inputs.feature.feature_id) + '/DOCS.md' : null,
      skipped: !hasActiveFeature
    }, 'Run `terrace docu <feature>` when available or write feature documentation.'),
    reportCheck('test_suite_strength', 'Test-suite strength', hasTestEval || hasTestScripts, 10, {
      test_eval_ref: 'docs/testing/TEST-EVAL.md',
      exists: hasTestEval,
      scripts: {
        test: Boolean(scripts.test),
        coverage: Boolean(scripts['test:coverage'])
      }
    }, 'Run `terrace test eval` when available.'),
    reportCheck('rule_health', 'Rule health', hasRuleAudit, 5, {
      rule_audit_count: Array.isArray(state.rule_audits) ? state.rule_audits.length : 0
    }, 'Run `terrace rule audit` when available.')
  ];
  const score = checks.reduce((sum, check) => sum + check.earned, 0);
  const blockers = [
    ...inputs.missingSeniorArtifacts.map((artifact) => ({
      code: 'SENIOR_ARTIFACT_MISSING',
      message: 'Missing senior-cycle artifact: ' + artifact,
      artifact
    })),
    ...inputs.debtAudit.blockers,
    ...inputs.audit.blocking
  ];
  const warnings = [
    ...inputs.audit.warnings,
    ...inputs.debtAudit.warnings,
    ...checks.filter((check) => !check.passed && check.points <= 10).map((check) => ({
      code: 'REPORT_CHECK_INCOMPLETE',
      message: check.label + ' is incomplete.',
      remediation: check.remediation
    }))
  ];
  return {
    updated_at: nowIso(),
    last_updated_command: command || 'terrace report update',
    score,
    max_score: checks.reduce((sum, check) => sum + check.points, 0),
    status_label: scoreStatus(score),
    current_feature: inputs.feature,
    blockers,
    warnings,
    completed_sprint_outcomes: {
      phases: inputs.completedPhases.map((phase) => ({ id: phase.id, title: phase.title, summary_ref: phase.summary_ref || null })),
      quick_tasks: inputs.completedQuickTasks.map((task) => ({ id: task.id, title: task.title, summary_ref: task.summary_ref || null }))
    },
    missing_senior_cycle_artifacts: inputs.missingSeniorArtifacts,
    quality_ladder_status: {
      audit: inputs.audit.blocking.length === 0 ? 'passing' : 'blocked',
      audit_blockers: inputs.audit.blocking.length
    },
    documentation_status: hasDocs ? 'present' : 'missing',
    test_suite_strength_status: hasTestEval ? 'evaluated' : 'not_evaluated',
    debt_status: inputs.debtAudit.blockers.length === 0 ? 'healthy' : 'blocked',
    rule_health: hasRuleAudit ? 'audited' : 'not_audited',
    production_readiness: inputs.hasActivePreflight ? 'preflight_present' : 'preflight_missing',
    checks,
    next_three_actions: nextReportActions(inputs, hasDocs, hasTestEval, hasRuleAudit)
  };
}

function nextReportActions(inputs, hasDocs, hasTestEval, hasRuleAudit) {
  const actions = [];
  if (inputs.missingSeniorArtifacts.length > 0) {
    actions.push('Create missing senior-cycle artifact: ' + inputs.missingSeniorArtifacts[0]);
  }
  if (!inputs.hasActivePreflight && inputs.feature) {
    actions.push('Run terrace preflight ' + inputs.feature.feature_id);
  }
  if (inputs.debtAudit.blockers.length > 0) {
    actions.push('Run terrace debt audit and resolve blocking debt.');
  }
  if (!hasDocs && inputs.feature) {
    actions.push('Create feature documentation for ' + inputs.feature.feature_id + '.');
  }
  if (!hasTestEval) {
    actions.push('Run terrace test eval when the command is available.');
  }
  if (!hasRuleAudit) {
    actions.push('Run terrace rule audit when the command is available.');
  }
  if (actions.length === 0) {
    actions.push('Run terrace ship check.');
  }
  return actions.slice(0, 3);
}

function reportMarkdown(card) {
  return [
    '# Terrace Tier One Report Card',
    '',
    '## Status',
    '- Score: ' + String(card.score) + '/' + String(card.max_score),
    '- Label: ' + card.status_label,
    '- Last updated: ' + card.updated_at,
    '- Last command: ' + card.last_updated_command,
    '',
    '## Score Evidence',
    ...card.checks.map((check) => '- ' + check.label + ': ' + String(check.earned) + '/' + String(check.points) + ' - ' + (check.passed ? 'passed' : check.remediation)),
    '',
    '## Blockers',
    ...(card.blockers.length > 0 ? card.blockers.map((blocker) => '- ' + blocker.code + ': ' + blocker.message) : ['- None.']),
    '',
    '## Warnings',
    ...(card.warnings.length > 0 ? card.warnings.map((warning) => '- ' + warning.code + ': ' + warning.message) : ['- None.']),
    '',
    '## Next Three Actions',
    ...card.next_three_actions.map((action) => '- ' + action),
    '',
    '## Completed Sprint Outcomes',
    ...(card.completed_sprint_outcomes.phases.length > 0 ? card.completed_sprint_outcomes.phases.map((phase) => '- Phase: ' + phase.id) : ['- No completed phases recorded.']),
    ...(card.completed_sprint_outcomes.quick_tasks.length > 0 ? card.completed_sprint_outcomes.quick_tasks.map((task) => '- Quick task: ' + task.id) : [])
  ];
}

function reportUpdate(cwd, options) {
  const opts = options || {};
  const command = opts.command || 'terrace report update';
  const card = buildReportCard(cwd, command);
  const cardRef = '.terrace/report-card.json';
  const docsRef = 'docs/terrace/REPORT-CARD.md';
  const historyRef = 'docs/terrace/report-history/' + timestampId() + '.md';
  writeJson(cwd, cardRef, card);
  writeMarkdown(cwd, docsRef, reportMarkdown(card));
  writeMarkdown(cwd, historyRef, reportMarkdown(card));
  const state = loadState(cwd);
  const nextState = {
    ...state,
    report_card: {
      ...card,
      artifact: cardRef,
      docs_ref: docsRef,
      latest_history_ref: historyRef
    }
  };
  saveState(cwd, nextState);
  return {
    report_card: nextState.report_card,
    artifact: cardRef,
    docs_ref: docsRef,
    history_ref: historyRef
  };
}

function reportRead(cwd) {
  const existing = readJsonIfExists(cwd, '.terrace/report-card.json', null);
  if (existing) {
    return {
      report_card: existing,
      artifact: '.terrace/report-card.json',
      docs_ref: 'docs/terrace/REPORT-CARD.md'
    };
  }
  return {
    report_card: buildReportCard(cwd, 'terrace report'),
    artifact: null,
    docs_ref: null,
    mutation: false
  };
}

function reportOpen(cwd) {
  return {
    artifact: relativeExists(cwd, 'docs/terrace/REPORT-CARD.md') ? 'docs/terrace/REPORT-CARD.md' : null,
    exists: relativeExists(cwd, 'docs/terrace/REPORT-CARD.md'),
    command: 'terrace report update'
  };
}

function reportHistory(cwd) {
  const dir = path.resolve(cwd, 'docs/terrace/report-history');
  const items = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((file) => file.endsWith('.md')).sort().map((file) => 'docs/terrace/report-history/' + file)
    : [];
  return { items };
}

function createHandoff(cwd, options) {
  const opts = options || {};
  const state = loadState(cwd);
  const featureId = normalizeFeatureId(opts.feature || activeFeature(state) || 'project');
  const target = opts.for || 'generic';
  const stamp = timestampId();
  const markdownRef = 'docs/terrace/handoffs/' + stamp + '-' + featureId + '.md';
  const jsonRef = '.terrace/handoffs/' + stamp + '-' + featureId + '.json';
  const changedFiles = currentChangedFiles(cwd);
  const missingGates = seniorArtifactRefs(featureId).filter((artifact) => !relativeExists(cwd, artifact));
  const debts = debtEntries(state).filter((entry) => entry.feature_id === featureId && entry.status !== 'resolved');
  const preflight = preflightEntries(state)[featureId] || null;
  const handoff = {
    id: stamp + '-' + featureId,
    created_at: nowIso(),
    feature_id: featureId,
    target,
    tier: activeFeatureState(state) && activeFeatureState(state).feature_id === featureId ? activeFeatureState(state).tier : 'medium',
    workflow_status: state.workflow ? state.workflow.status : null,
    active_slice: state.active_slice || null,
    branch: currentBranch(cwd),
    next_command: state.handoff && state.handoff.next_action ? state.handoff.next_action : 'terrace next',
    missing_senior_cycle_gates: missingGates,
    changed_files: changedFiles,
    ownership_boundaries: inferOwnership(changedFiles),
    debts,
    blockers: state.blocked_actions || [],
    preflight,
    safe_next_action: missingGates.length > 0 ? 'Create missing gate: ' + missingGates[0] : 'Run terrace ship check.',
    do_not_touch: [],
    verification: {
      already_run: [],
      still_required: ['terrace audit', 'terrace ship check']
    },
    artifacts: {
      markdown: markdownRef,
      json: jsonRef
    }
  };
  writeJson(cwd, jsonRef, handoff);
  writeMarkdown(cwd, markdownRef, handoffMarkdown(handoff));
  const handoffs = Array.isArray(state.handoffs) ? state.handoffs : [];
  const nextState = {
    ...state,
    handoffs: [...handoffs, handoff],
    handoff: {
      status: 'handoff_ready',
      next_action: handoff.safe_next_action,
      feature: featureId,
      artifact: markdownRef
    }
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace handoff create' });
  return handoff;
}

function inferOwnership(files) {
  const roots = new Set(files.map((file) => file.split('/').slice(0, 2).join('/')));
  return Array.from(roots).filter(Boolean).map((root) => ({
    path: root,
    note: 'Review changes under ' + root + ' as one ownership boundary.'
  }));
}

function handoffMarkdown(handoff) {
  return [
    '# Agent Handoff: ' + handoff.feature_id,
    '',
    '## Context',
    '- Target agent: ' + handoff.target,
    '- Tier: ' + handoff.tier,
    '- Workflow status: ' + handoff.workflow_status,
    '- Branch: ' + (handoff.branch || 'unknown'),
    '- Next command: ' + handoff.next_command,
    '',
    '## Missing Senior Cycle Gates',
    ...(handoff.missing_senior_cycle_gates.length > 0 ? handoff.missing_senior_cycle_gates.map((artifact) => '- ' + artifact) : ['- None.']),
    '',
    '## Changed Files',
    ...(handoff.changed_files.length > 0 ? handoff.changed_files.map((file) => '- ' + file) : ['- None detected from git diff.']),
    '',
    '## Debts And Blockers',
    ...(handoff.debts.length > 0 ? handoff.debts.map((entry) => '- ' + entry.id + ': ' + entry.reason) : ['- No open feature debt recorded.']),
    ...(handoff.blockers.length > 0 ? handoff.blockers.map((blocker) => '- Blocker: ' + blocker.description) : []),
    '',
    '## Safe Next Action',
    handoff.safe_next_action,
    '',
    '## Do Not Touch',
    ...(handoff.do_not_touch.length > 0 ? handoff.do_not_touch.map((item) => '- ' + item) : ['- No explicit boundaries recorded.']),
    '',
    '## Verification',
    '- Already run: ' + (handoff.verification.already_run.length > 0 ? handoff.verification.already_run.join(', ') : 'none recorded'),
    '- Still required: ' + handoff.verification.still_required.join(', ')
  ];
}

function addDebt(cwd, options) {
  const opts = options || {};
  const featureId = normalizeFeatureId(opts.feature);
  const state = loadState(cwd);
  const entries = debtEntries(state);
  const id = 'debt-' + String(entries.length + 1);
  const entry = {
    id,
    feature_id: featureId,
    status: 'open',
    owner: opts.owner || null,
    reason: opts.reason || 'TODO: record why this debt is acceptable.',
    affected_files: opts.files || [],
    expiry_condition: opts.expiry || null,
    cleanup_trigger: opts.cleanup || null,
    replacement_design: opts.replacement || null,
    allowed_to_ship: Boolean(opts.allowedToShip),
    created_at: nowIso(),
    resolved_at: null
  };
  const nextState = {
    ...state,
    debt: [...entries, entry]
  };
  saveState(cwd, nextState);
  writeDebtDoc(cwd, featureId, nextState.debt.filter((item) => item.feature_id === featureId));
  reportUpdate(cwd, { command: 'terrace debt add ' + featureId });
  return {
    entry,
    artifact: featureRef(featureId) + '/DEBT.md',
    next_command: 'terrace debt audit'
  };
}

function writeDebtDoc(cwd, featureId, entries) {
  writeMarkdown(cwd, featureRef(featureId) + '/DEBT.md', [
    '# Debt: ' + featureId,
    '',
    '## Entries',
    ...(entries.length > 0 ? entries.flatMap((entry) => [
      '### ' + entry.id,
      '- Status: ' + entry.status,
      '- Owner: ' + (entry.owner || 'missing'),
      '- Reason: ' + entry.reason,
      '- Expiry condition: ' + (entry.expiry_condition || 'missing'),
      '- Cleanup trigger: ' + (entry.cleanup_trigger || 'missing'),
      '- Allowed to ship: ' + String(entry.allowed_to_ship)
    ]) : ['- No debt recorded.'])
  ]);
}

function listDebt(cwd) {
  return {
    entries: debtEntries(loadState(cwd))
  };
}

function auditDebtState(entries) {
  const open = entries.filter((entry) => entry.status !== 'resolved');
  const blockers = [];
  const warnings = [];
  for (const entry of open) {
    if (!entry.owner) {
      blockers.push({
        code: 'DEBT_OWNER_REQUIRED',
        id: entry.id,
        message: 'Debt entry has no owner: ' + entry.id,
        remediation: 'Resolve the debt or add an owner.'
      });
    }
    if (!entry.expiry_condition && !entry.cleanup_trigger) {
      blockers.push({
        code: 'DEBT_EXPIRY_REQUIRED',
        id: entry.id,
        message: 'Debt entry has no expiry condition or cleanup trigger: ' + entry.id,
        remediation: 'Add an expiry condition or cleanup trigger.'
      });
    }
    if (!entry.allowed_to_ship) {
      warnings.push({
        code: 'DEBT_NOT_ALLOWED_TO_SHIP',
        id: entry.id,
        message: 'Debt is open and not marked as allowed to ship: ' + entry.id
      });
    }
  }
  return {
    open_count: open.length,
    blockers,
    warnings,
    passed: blockers.length === 0
  };
}

function auditDebt(cwd) {
  const state = loadState(cwd);
  const result = auditDebtState(debtEntries(state));
  reportUpdate(cwd, { command: 'terrace debt audit' });
  return result;
}

function resolveDebt(cwd, id) {
  if (!id) {
    throw new Error('Usage: terrace debt resolve <id>');
  }
  const state = loadState(cwd);
  const entries = debtEntries(state);
  const found = entries.find((entry) => entry.id === id);
  if (!found) {
    throw new Error('Unknown debt id: ' + id);
  }
  const nextEntries = entries.map((entry) => entry.id === id ? { ...entry, status: 'resolved', resolved_at: nowIso() } : entry);
  const nextState = {
    ...state,
    debt: nextEntries
  };
  saveState(cwd, nextState);
  writeDebtDoc(cwd, found.feature_id, nextEntries.filter((entry) => entry.feature_id === found.feature_id));
  reportUpdate(cwd, { command: 'terrace debt resolve ' + id });
  return {
    entry: nextEntries.find((entry) => entry.id === id),
    artifact: featureRef(found.feature_id) + '/DEBT.md',
    next_command: 'terrace debt audit'
  };
}

function preflightFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const mode = options && options.mode ? options.mode : 'pre-ship';
  const artifact = featureRef(featureId) + '/PREFLIGHT.md';
  const entry = {
    feature_id: featureId,
    mode,
    artifact,
    created_at: nowIso(),
    checks: [
      'bad input',
      'permission errors',
      'slow network',
      'stale cache',
      'partial deploy',
      'missing environment variables',
      'failed migrations',
      'third-party outages',
      'rate limits',
      'rollback path',
      'observability gaps'
    ]
  };
  writeMarkdown(cwd, artifact, [
    '# Production Preflight: ' + featureId,
    '',
    '## Mode',
    '- ' + mode,
    '',
    '## Failure Checks',
    ...entry.checks.map((check) => '- ' + check + ': TODO define testable or monitorable evidence.'),
    '',
    '## Rollback Path',
    '- TODO: Describe rollback command, owner, and threshold.',
    '',
    '## Observability Gaps',
    '- TODO: Name missing logs, metrics, traces, alerts, or dashboards.',
    '',
    '## Ship Decision',
    '- Preflight is complete when every failure mode has evidence, an owner, or a documented exemption.'
  ]);
  const state = loadState(cwd);
  const nextState = {
    ...state,
    preflights: {
      ...preflightEntries(state),
      [featureId]: entry
    }
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace preflight ' + featureId });
  return {
    feature_id: featureId,
    mode,
    artifact,
    next_command: 'terrace report update'
  };
}

function docuFeature(cwd, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const type = options && options.type ? options.type : 'handoff';
  const refByType = {
    adr: featureRef(featureId) + '/ADR.md',
    runbook: featureRef(featureId) + '/RUNBOOK.md',
    'release-note': featureRef(featureId) + '/RELEASE-NOTES.md',
    migration: featureRef(featureId) + '/MIGRATION-GUIDE.md',
    api: featureRef(featureId) + '/DOCS.md',
    'user-guide': featureRef(featureId) + '/DOCS.md',
    handoff: featureRef(featureId) + '/DOCS.md'
  };
  const artifact = refByType[type] || featureRef(featureId) + '/DOCS.md';
  const entry = {
    feature_id: featureId,
    type,
    artifact,
    created_at: nowIso(),
    polish_adapter: 'none'
  };
  writeMarkdown(cwd, artifact, [
    '# Documentation: ' + featureId,
    '',
    '## Executive Summary',
    '- TODO: Summarize the change and production impact concisely.',
    '',
    '## Decision Context',
    '- TODO: Link relevant alignment, design, review, and verification evidence.',
    '',
    '## Operational Impact',
    '- TODO: Describe logs, metrics, support impact, migrations, and expected operator workflow.',
    '',
    '## Rollout And Rollback',
    '- TODO: Record rollout owner, rollout steps, rollback command, and rollback threshold.',
    '',
    '## User-Visible Changes',
    '- TODO: Describe behavior changes, UI changes, API changes, or docs-only impact.',
    '',
    '## Evidence Links',
    '- Alignment: ' + featureRef(featureId) + '/ALIGNMENT.md',
    '- Preflight: ' + featureRef(featureId) + '/PREFLIGHT.md',
    '- Debt: ' + featureRef(featureId) + '/DEBT.md',
    '',
    '## Open Questions',
    '- TODO: List unresolved questions and owners.'
  ]);
  const state = loadState(cwd);
  const docs = documentationEntries(state);
  const nextState = {
    ...state,
    documentation: {
      ...docs,
      [featureId]: entry
    }
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace docu ' + featureId });
  return {
    feature_id: featureId,
    type,
    artifact,
    next_command: 'terrace report update'
  };
}

function testEval(cwd, options) {
  const opts = options || {};
  const featureId = opts.feature ? normalizeFeatureId(opts.feature) : null;
  const artifact = 'docs/testing/TEST-EVAL.md';
  const packageJson = readJsonIfExists(cwd, 'package.json', {});
  const scripts = packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {};
  const testFiles = collectFiles(cwd, ['tests'], /\.(test|spec)\.[cm]?[jt]sx?$/).slice(0, 200);
  const snapshotFiles = collectFiles(cwd, ['tests', 'src'], /\.snap$/).slice(0, 50);
  const duplicateNames = duplicateBasenames(testFiles);
  const recommendations = [];
  if (testFiles.length === 0) {
    recommendations.push({ code: 'NO_TEST_FILES', message: 'No test files were found.' });
  }
  if (!scripts.test) {
    recommendations.push({ code: 'MISSING_TEST_SCRIPT', message: 'No package test script was found.' });
  }
  if (snapshotFiles.length > 5) {
    recommendations.push({ code: 'SNAPSHOT_REVIEW', message: 'Snapshot count is high enough to review intent and brittleness.' });
  }
  if (duplicateNames.length > 0) {
    recommendations.push({ code: 'DUPLICATE_TEST_NAMES', message: 'Duplicate test basenames may indicate consolidation candidates.' });
  }
  const blockers = scripts.test ? [] : [{
    code: 'TEST_SCRIPT_REQUIRED',
    message: 'No package test script was found.',
    remediation: 'Add a deterministic test script or document why this project cannot run tests.'
  }];
  const entry = {
    id: timestampId(),
    feature_id: featureId,
    artifact,
    changed_only: Boolean(opts.changed),
    created_at: nowIso(),
    trust_score: Math.max(0, 100 - blockers.length * 40 - recommendations.length * 10),
    blockers,
    recommendations,
    test_files: testFiles,
    duplicate_test_basenames: duplicateNames,
    snapshot_files: snapshotFiles
  };
  writeMarkdown(cwd, artifact, [
    '# Test Suite Evaluation',
    '',
    '## Scope',
    '- Feature: ' + (featureId || 'repository'),
    '- Changed only: ' + String(entry.changed_only),
    '',
    '## Trust Score',
    '- ' + String(entry.trust_score),
    '',
    '## Blockers',
    ...(blockers.length > 0 ? blockers.map((blocker) => '- ' + blocker.code + ': ' + blocker.message) : ['- None.']),
    '',
    '## Recommendations',
    ...(recommendations.length > 0 ? recommendations.map((item) => '- ' + item.code + ': ' + item.message) : ['- None.']),
    '',
    '## Inventory',
    '- Test files: ' + String(testFiles.length),
    '- Snapshot files: ' + String(snapshotFiles.length),
    '- Duplicate basenames: ' + String(duplicateNames.length),
    '',
    '## Deletion And Consolidation Candidates',
    ...(duplicateNames.length > 0 ? duplicateNames.map((name) => '- Review duplicate basename: ' + name) : ['- None detected statically.'])
  ]);
  const state = loadState(cwd);
  const nextState = {
    ...state,
    test_evaluations: [...testEvaluationEntries(state), entry]
  };
  saveState(cwd, nextState);
  reportUpdate(cwd, { command: 'terrace test eval' });
  return entry;
}

function collectFiles(cwd, roots, pattern) {
  const found = [];
  for (const root of roots) {
    const absoluteRoot = path.resolve(cwd, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    walk(absoluteRoot, (filePath) => {
      const relative = path.relative(cwd, filePath);
      if (pattern.test(relative)) {
        found.push(relative);
      }
    });
  }
  return found.sort();
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, visit);
    } else if (entry.isFile()) {
      visit(fullPath);
    }
  }
}

function duplicateBasenames(files) {
  const counts = new Map();
  for (const file of files) {
    const base = path.basename(file);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  return Array.from(counts.entries()).filter((entry) => entry[1] > 1).map((entry) => entry[0]);
}

function interrogateMode(cwd, mode, feature, options) {
  const featureId = normalizeFeatureId(feature);
  const normalized = ['init', 'adjust', 'risk', 'milestone'].includes(mode) ? mode : 'init';
  const artifactByMode = {
    init: featureRef(featureId) + '/INTERROGATION.md',
    adjust: featureRef(featureId) + '/ADJUSTMENT.md',
    risk: featureRef(featureId) + '/RISK.md',
    milestone: featureRef(featureId) + '/MILESTONE-INTERROGATION.md'
  };
  const headingByMode = {
    init: 'Interrogation',
    adjust: 'Adjustment Interrogation',
    risk: 'Risk Interrogation',
    milestone: 'Milestone Interrogation'
  };
  const artifact = artifactByMode[normalized];
  writeMarkdown(cwd, artifact, [
    '# ' + headingByMode[normalized] + ': ' + featureId,
    '',
    '## Mode',
    '- ' + normalized,
    '',
    '## Assumptions',
    '- TODO: Name assumptions this mode must challenge.',
    '',
    '## Evidence Needed',
    '- TODO: Name missing evidence and the command or artifact that should produce it.',
    '',
    '## Failure Modes',
    '- TODO: Describe how this change can fail and how the team will notice.',
    '',
    '## Decision Impact',
    '- TODO: Record scope, sequence, risk, or milestone changes caused by this interrogation.'
  ]);
  const state = loadState(cwd);
  const interrogations = Array.isArray(state.interrogations) ? state.interrogations : [];
  const entry = { feature_id: featureId, mode: normalized, artifact, created_at: nowIso() };
  saveState(cwd, {
    ...state,
    interrogations: [...interrogations, entry]
  });
  reportUpdate(cwd, { command: 'terrace interrogate ' + normalized + ' ' + featureId });
  return {
    ...entry,
    tier: options && options.tier ? options.tier : 'medium',
    next_command: normalized === 'init' ? 'terrace design ' + featureId : 'terrace report update'
  };
}

function reviewAi(cwd, options) {
  const opts = options || {};
  const mode = opts.mode || 'architecture';
  const featureId = normalizeFeatureId(opts.feature || activeFeature(loadState(cwd)) || 'project');
  const dir = 'docs/terrace/reviews/' + featureId;
  const artifact = dir + '/' + mode + '.json';
  const markdown = dir + '/' + mode + '.md';
  const finding = {
    id: 'finding-1',
    mode,
    severity: 'info',
    file_or_artifact: featureRef(featureId),
    claim: 'Structured AI review protocol initialized.',
    evidence: 'No automated reviewer findings were provided; this artifact establishes the stable format.',
    recommended_fix: 'Fill findings with concrete evidence before treating review as complete.',
    classification: 'warning'
  };
  const entry = {
    feature_id: featureId,
    mode,
    artifact,
    markdown,
    created_at: nowIso(),
    findings: [finding]
  };
  writeJson(cwd, artifact, entry);
  writeMarkdown(cwd, markdown, [
    '# AI Review: ' + mode + ' - ' + featureId,
    '',
    '## Findings',
    '- ' + finding.id + ' [' + finding.classification + ']: ' + finding.claim,
    '',
    '## Evidence',
    '- ' + finding.evidence,
    '',
    '## Recommended Fix',
    '- ' + finding.recommended_fix
  ]);
  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    ai_reviews: [...aiReviewEntries(state), entry]
  });
  reportUpdate(cwd, { command: 'terrace review ai --mode ' + mode });
  return entry;
}

function ruleAdd(cwd, domain, ruleId) {
  const normalizedDomain = normalizeFeatureId(domain);
  const normalizedRule = normalizeFeatureId(ruleId);
  const jsonRef = '.terrace/rules/' + normalizedDomain + '/' + normalizedRule + '.json';
  const docsRef = 'docs/terrace/rules/' + normalizedDomain + '/' + normalizedRule + '.md';
  const entry = {
    id: normalizedRule,
    domain: normalizedDomain,
    rationale: 'TODO: explain why this rule exists.',
    applies_to: [],
    forbidden_patterns: [],
    preferred_patterns: [],
    examples: [],
    enforcement_level: 'warning',
    owner: null,
    created_at: nowIso(),
    review_after: null,
    source: 'terrace rule add'
  };
  writeJson(cwd, jsonRef, entry);
  writeMarkdown(cwd, docsRef, [
    '# Rule: ' + normalizedDomain + '/' + normalizedRule,
    '',
    '## Rationale',
    entry.rationale,
    '',
    '## Applies To',
    '- TODO',
    '',
    '## Forbidden Patterns',
    '- TODO',
    '',
    '## Preferred Patterns',
    '- TODO',
    '',
    '## Enforcement',
    '- ' + entry.enforcement_level,
    '',
    '## Owner',
    '- missing'
  ]);
  return { rule: entry, artifact: jsonRef, docs_ref: docsRef, next_command: 'terrace rule audit' };
}

function ruleAudit(cwd) {
  const rules = collectRuleArtifacts(cwd);
  const blockers = [];
  const warnings = [];
  const seen = new Set();
  for (const rule of rules) {
    const key = rule.domain + '/' + rule.id;
    if (seen.has(key)) {
      warnings.push({ code: 'DUPLICATE_RULE', message: 'Duplicate rule id: ' + key });
    }
    seen.add(key);
    if (!rule.owner) {
      blockers.push({ code: 'RULE_OWNER_REQUIRED', message: 'Rule has no owner: ' + key });
    }
    if (!rule.rationale || /TODO/i.test(rule.rationale)) {
      warnings.push({ code: 'RULE_TOO_VAGUE', message: 'Rule rationale is too vague: ' + key });
    }
    if (!rule.review_after && !rule.expires_at) {
      warnings.push({ code: 'RULE_REVIEW_DATE_MISSING', message: 'Rule has no review_after or expires_at: ' + key });
    }
  }
  const artifact = 'docs/terrace/rules/RULE-AUDIT.md';
  const entry = {
    id: timestampId(),
    artifact,
    created_at: nowIso(),
    rule_count: rules.length,
    blockers,
    warnings,
    passed: blockers.length === 0
  };
  writeMarkdown(cwd, artifact, [
    '# Rule Audit',
    '',
    '## Summary',
    '- Rule count: ' + String(rules.length),
    '- Passed: ' + String(entry.passed),
    '',
    '## Blockers',
    ...(blockers.length > 0 ? blockers.map((item) => '- ' + item.code + ': ' + item.message) : ['- None.']),
    '',
    '## Warnings',
    ...(warnings.length > 0 ? warnings.map((item) => '- ' + item.code + ': ' + item.message) : ['- None.']),
    '',
    '## Automation Candidates',
    '- TODO: Promote stable blocking rules into automated checks.'
  ]);
  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    rule_audits: [...ruleAuditEntries(state), entry]
  });
  reportUpdate(cwd, { command: 'terrace rule audit' });
  return entry;
}

function collectRuleArtifacts(cwd) {
  const root = path.resolve(cwd, '.terrace/rules');
  const rules = [];
  if (!fs.existsSync(root)) {
    return rules;
  }
  walk(root, (filePath) => {
    if (!filePath.endsWith('.json')) {
      return;
    }
    try {
      rules.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      rules.push({ id: path.basename(filePath, '.json'), domain: 'unknown', owner: null, rationale: '' });
    }
  });
  return rules;
}

function backfill(cwd, options) {
  const opts = options || {};
  const featureId = opts.feature ? normalizeFeatureId(opts.feature) : null;
  const id = timestampId();
  const artifact = 'docs/terrace/backfill/' + id + '-BACKFILL-SPEC.md';
  const changed = currentChangedFiles(cwd);
  const entry = {
    id,
    rule: opts.rule || null,
    since: opts.since || null,
    feature_id: featureId,
    artifact,
    created_at: nowIso(),
    affected_files: changed,
    mutates_code: false
  };
  writeMarkdown(cwd, artifact, [
    '# Standards Backfill Spec',
    '',
    '## Standard Or Decision',
    '- Rule: ' + (entry.rule || 'TODO'),
    '- Since: ' + (entry.since || 'not specified'),
    '',
    '## Scope',
    '- Feature: ' + (featureId || 'repository'),
    '',
    '## Affected Files',
    ...(changed.length > 0 ? changed.map((file) => '- ' + file) : ['- TODO: identify affected files.']),
    '',
    '## Current Violations',
    '- TODO: List concrete violations.',
    '',
    '## Migration Plan',
    '- TODO: Write staged remediation steps.',
    '',
    '## Test Impact',
    '- TODO: Name tests to add, update, delete, or consolidate.',
    '',
    '## Risk Level',
    '- TODO',
    '',
    '## Workstream Split',
    '- TODO',
    '',
    '## Verification Commands',
    '- terrace ship check',
    '',
    '## Cleanup Conditions',
    '- TODO'
  ]);
  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    backfills: [...backfillEntries(state), entry]
  });
  reportUpdate(cwd, { command: 'terrace backfill' });
  return entry;
}

function workstreamsPlan(cwd, feature) {
  const featureId = normalizeFeatureId(feature);
  const lanes = ['product/spec', 'tests', 'frontend', 'backend', 'data/migrations', 'observability', 'docs', 'cleanup'].map((lane) => ({
    lane,
    owned_files: [],
    dependencies: [],
    collision_risks: [],
    verification_commands: ['terrace ship check'],
    parallel: lane !== 'data/migrations'
  }));
  const coordination_points = ['shared exports', 'schemas', 'auth', 'billing', 'migrations'];
  const artifact = featureRef(featureId) + '/WORKSTREAMS.md';
  const jsonRef = '.terrace/workstreams/' + featureId + '.json';
  const entry = { feature_id: featureId, artifact, json_ref: jsonRef, lanes, coordination_points, created_at: nowIso() };
  writeJson(cwd, jsonRef, entry);
  writeMarkdown(cwd, artifact, [
    '# Workstreams: ' + featureId,
    '',
    '## Coordination Points',
    ...coordination_points.map((item) => '- ' + item),
    '',
    '## Lanes',
    ...lanes.flatMap((lane) => [
      '### ' + lane.lane,
      '- Parallel: ' + String(lane.parallel),
      '- Owned files: TODO',
      '- Dependencies: TODO',
      '- Collision risks: TODO',
      '- Verification: ' + lane.verification_commands.join(', ')
    ])
  ]);
  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    workstreams: {
      ...workstreamEntries(state),
      [featureId]: entry
    }
  });
  return entry;
}

function designSourceImport(cwd, source, feature, ref) {
  const featureId = normalizeFeatureId(feature);
  const normalizedSource = ['stitch', 'v0', 'figma', 'screenshot'].includes(source) ? source : 'stitch';
  const base = featureRef(featureId);
  const specRef = base + '/UI-SPEC.md';
  const assetsRef = base + '/UI-ASSETS.md';
  const verifyRef = base + '/UI-VERIFY.md';
  const entry = {
    feature_id: featureId,
    source: normalizedSource,
    ref: ref || null,
    artifacts: {
      spec: specRef,
      assets: assetsRef,
      verify: verifyRef
    },
    created_at: nowIso()
  };
  writeMarkdown(cwd, specRef, [
    '# UI Spec: ' + featureId,
    '',
    '## Source',
    '- Type: ' + normalizedSource,
    '- Ref: ' + (ref || 'missing'),
    '',
    '## Routes And Components',
    '- TODO',
    '',
    '## States',
    '- TODO: loading, empty, error, success, disabled, responsive.',
    '',
    '## Implementation Constraints',
    '- TODO'
  ]);
  writeMarkdown(cwd, assetsRef, [
    '# UI Assets: ' + featureId,
    '',
    '## Required Assets',
    '- TODO',
    '',
    '## Source References',
    '- ' + (ref || 'missing')
  ]);
  writeMarkdown(cwd, verifyRef, [
    '# UI Verification: ' + featureId,
    '',
    '## Browser Checks',
    '- TODO: Define viewport, route, screenshot, accessibility, and interaction checks.'
  ]);
  const state = loadState(cwd);
  saveState(cwd, {
    ...state,
    design_sources: {
      ...designSourceEntries(state),
      [featureId]: entry
    }
  });
  return entry;
}

function designSourceDiff(cwd, target, feature, routeOrPath) {
  const featureId = normalizeFeatureId(feature);
  const artifact = featureRef(featureId) + '/UI-DIFF.md';
  const entry = {
    feature_id: featureId,
    target: target || 'existing-ui',
    route_or_path: routeOrPath || null,
    artifact,
    created_at: nowIso()
  };
  writeMarkdown(cwd, artifact, [
    '# UI Diff: ' + featureId,
    '',
    '## Target',
    '- ' + entry.target,
    '',
    '## Route Or Path',
    '- ' + (entry.route_or_path || 'missing'),
    '',
    '## Differences',
    '- TODO: Record visual, interaction, content, accessibility, and responsive differences.',
    '',
    '## Verification Requirements',
    '- TODO: Name browser and screenshot checks.'
  ]);
  return entry;
}

function latestForFeature(entries, featureId) {
  return entries.slice().reverse().find((entry) => entry.feature_id === featureId) || null;
}

function documentationShipCheck(cwd) {
  try {
    const state = loadState(cwd);
    const feature = activeFeatureState(state);
    if (!feature) {
      return { category: 'documentation', command: 'terrace docu <feature>', passed: true, skipped: true, blocking: [], warnings: [] };
    }
    const docs = documentationEntries(state)[feature.feature_id] || null;
    const missing = !docs;
    const finding = {
      code: 'DOCUMENTATION_REQUIRED',
      message: 'Documentation is missing for active feature: ' + feature.feature_id,
      remediation: 'Run terrace docu ' + feature.feature_id
    };
    return {
      category: 'documentation',
      command: 'terrace docu ' + feature.feature_id,
      passed: !missing || feature.tier === 'small',
      documentation: docs,
      blocking: missing && feature.tier !== 'small' ? [finding] : [],
      warnings: missing && feature.tier === 'small' ? [finding] : []
    };
  } catch (error) {
    return unavailableCheck('documentation', 'terrace docu <feature>', error);
  }
}

function testEvalShipCheck(cwd) {
  try {
    const latest = testEvaluationEntries(loadState(cwd)).slice().reverse()[0] || null;
    const missing = !latest;
    const blockers = latest && latest.blockers ? latest.blockers : [];
    return {
      category: 'test_eval',
      command: 'terrace test eval',
      passed: blockers.length === 0,
      test_evaluation: latest,
      blocking: blockers,
      warnings: missing ? [{ code: 'TEST_EVAL_MISSING', message: 'No test-suite evaluation has been recorded.' }] : latest.recommendations || []
    };
  } catch (error) {
    return unavailableCheck('test_eval', 'terrace test eval', error);
  }
}

function aiReviewShipCheck(cwd) {
  try {
    const state = loadState(cwd);
    const feature = activeFeatureState(state);
    if (!feature) {
      return { category: 'ai_review', command: 'terrace review ai', passed: true, skipped: true, blocking: [], warnings: [] };
    }
    const latest = latestForFeature(aiReviewEntries(state), feature.feature_id);
    const missing = !latest;
    const finding = {
      code: 'AI_REVIEW_REQUIRED',
      message: 'AI review is missing for active feature: ' + feature.feature_id,
      remediation: 'Run terrace review ai --mode architecture --feature ' + feature.feature_id
    };
    return {
      category: 'ai_review',
      command: 'terrace review ai --feature ' + feature.feature_id,
      passed: !missing || feature.tier !== 'large',
      ai_review: latest,
      blocking: missing && feature.tier === 'large' ? [finding] : [],
      warnings: missing && feature.tier !== 'large' ? [finding] : []
    };
  } catch (error) {
    return unavailableCheck('ai_review', 'terrace review ai', error);
  }
}

function ruleAuditShipCheck(cwd) {
  try {
    const latest = ruleAuditEntries(loadState(cwd)).slice().reverse()[0] || null;
    return {
      category: 'rule_audit',
      command: 'terrace rule audit',
      passed: !latest || latest.blockers.length === 0,
      rule_audit: latest,
      blocking: latest ? latest.blockers : [],
      warnings: latest ? latest.warnings : [{ code: 'RULE_AUDIT_MISSING', message: 'No rule audit has been recorded.' }]
    };
  } catch (error) {
    return unavailableCheck('rule_audit', 'terrace rule audit', error);
  }
}

function unavailableCheck(category, command, error) {
  return {
    category,
    command,
    passed: false,
    blocking: [{ code: category.toUpperCase() + '_UNAVAILABLE', message: error && error.message ? error.message : String(error) }],
    warnings: []
  };
}

function preflightShipCheck(cwd) {
  try {
    const state = loadState(cwd);
    const feature = activeFeatureState(state);
    if (!feature) {
      return {
        category: 'production_preflight',
        command: 'terrace preflight <feature>',
        passed: true,
        skipped: true,
        blocking: [],
        warnings: []
      };
    }
    const preflight = preflightEntries(state)[feature.feature_id] || null;
    const tier = feature.tier;
    const missing = !preflight;
    const finding = {
      code: 'PREFLIGHT_REQUIRED',
      message: 'Production preflight is missing for active feature: ' + feature.feature_id,
      remediation: 'Run terrace preflight ' + feature.feature_id
    };
    return {
      category: 'production_preflight',
      command: 'terrace preflight ' + feature.feature_id,
      passed: !missing || tier === 'small',
      preflight,
      blocking: missing && tier !== 'small' ? [finding] : [],
      warnings: missing && tier === 'small' ? [finding] : []
    };
  } catch (error) {
    return {
      category: 'production_preflight',
      command: 'terrace preflight <feature>',
      passed: false,
      blocking: [{
        code: 'PREFLIGHT_CHECK_UNAVAILABLE',
        message: error && error.message ? error.message : String(error)
      }],
      warnings: []
    };
  }
}

function debtShipCheck(cwd) {
  try {
    const audit = auditDebtState(debtEntries(loadState(cwd)));
    return {
      category: 'debt',
      command: 'terrace debt audit',
      passed: audit.blockers.length === 0,
      blocking: audit.blockers,
      warnings: audit.warnings,
      audit
    };
  } catch (error) {
    return {
      category: 'debt',
      command: 'terrace debt audit',
      passed: false,
      blocking: [{
        code: 'DEBT_CHECK_UNAVAILABLE',
        message: error && error.message ? error.message : String(error)
      }],
      warnings: []
    };
  }
}

function reportShipCheck(cwd) {
  const card = reportRead(cwd).report_card;
  const blocking = card.score < 50 ? [{
    code: 'TIER_ONE_REPORT_WEAK',
    message: 'Tier One report score is below 50.',
    remediation: 'Run terrace report update and complete the top next actions.'
  }] : [];
  return {
    category: 'tier_one_report',
    command: 'terrace report update',
    passed: blocking.length === 0,
    blocking,
    warnings: card.score < 85 ? [{
      code: 'TIER_ONE_GAPS',
      message: 'Tier One report score is below strong readiness: ' + String(card.score) + '.',
      remediation: 'Follow the report next actions.'
    }] : [],
    report_card: {
      score: card.score,
      status_label: card.status_label
    }
  };
}

module.exports = {
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
  preflightShipCheck,
  debtShipCheck,
  reportShipCheck,
  documentationShipCheck,
  testEvalShipCheck,
  aiReviewShipCheck,
  ruleAuditShipCheck
};
