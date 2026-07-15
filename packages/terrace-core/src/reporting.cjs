'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');
const { blocker, warning } = require('./guidance.cjs');
const { preflightProjectArtifacts, readManagedJson, withManagedArtifactLock, writeManagedJson, writeProjectText } = require('./managed-artifacts.cjs');
const { auditDebtState } = require('./debt-assessment.cjs');

function nowIso() {
  return new Date().toISOString();
}

function timestampId() {
  return nowIso().replace(/[:.]/g, '-');
}

function safeResolve(cwd, relativeFilePath) {
  const root = path.resolve(cwd);
  const resolved = path.resolve(cwd, relativeFilePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('UNSAFE_PATH: generated artifact path is outside the project root');
  }
  return resolved;
}

function isManagedArtifactRef(relativeFilePath) {
  return relativeFilePath.startsWith('.terrace/');
}

function managedArtifactRef(relativeFilePath) {
  return relativeFilePath.slice('.terrace/'.length);
}

function writeText(cwd, relativeFilePath, content) {
  writeProjectText(cwd, relativeFilePath, content);
  return relativeFilePath;
}

function writeJson(cwd, relativeFilePath, data) {
  if (isManagedArtifactRef(relativeFilePath)) {
    writeManagedJson(cwd, managedArtifactRef(relativeFilePath), data);
    return relativeFilePath;
  }
  return writeText(cwd, relativeFilePath, JSON.stringify(data, null, 2) + '\n');
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  return writeText(cwd, relativeFilePath, lines.join('\n') + '\n');
}

function relativeExists(cwd, relativeFilePath) {
  return fs.existsSync(safeResolve(cwd, relativeFilePath));
}

function featureRef(featureId) {
  return 'docs/terrace/features/' + featureId;
}

function readJsonIfExists(cwd, relativeFilePath, fallback) {
  if (isManagedArtifactRef(relativeFilePath)) {
    return readManagedJson(cwd, managedArtifactRef(relativeFilePath), fallback);
  }
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

function waiverEntries(state) {
  return Array.isArray(state.waivers) ? state.waivers : [];
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
  const activeWaivers = waiverEntries(state).filter((entry) => entry.status !== 'resolved');
  const roadmapPhases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const completedOutcomeCount = inputs.completedPhases.length + inputs.completedQuickTasks.length;
  const claimScope = hasActiveFeature
    ? 'feature_readiness'
    : completedOutcomeCount > 0
      ? 'delivery_readiness'
      : roadmapPhases.length > 0
        ? 'roadmap_readiness'
        : 'baseline_readiness';
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
  const computedStatus = scoreStatus(score);
  const statusLabel = claimScope === 'baseline_readiness' && score >= 95
    ? 'baseline_ready'
    : claimScope === 'roadmap_readiness' && score >= 95
      ? 'roadmap_ready'
      : computedStatus;
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
    status_label: statusLabel,
    claim_scope: claimScope,
    claim_scope_note: claimScope === 'baseline_readiness'
      ? 'No active feature, roadmap phase, or completed Terrace outcome is present; this score proves baseline governance health, not completed delivery readiness.'
      : claimScope === 'roadmap_readiness'
        ? 'Roadmap state exists, but no active feature or completed Terrace outcome is present yet.'
        : 'Score is backed by active or completed Terrace workflow evidence.',
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
    active_waivers: activeWaivers,
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
    '- Claim scope: ' + (card.claim_scope || 'unknown'),
    '- Claim note: ' + (card.claim_scope_note || 'No claim-scope note recorded.'),
    '- Last updated: ' + card.updated_at,
    '- Last command: ' + card.last_updated_command,
    '',
    '## Score Evidence',
    ...card.checks.map((check) => '- ' + check.label + ': ' + String(check.earned) + '/' + String(check.points) + ' - ' + (check.passed ? 'passed' : check.remediation)),
    '',
    '## Blockers',
    ...(card.blockers.length > 0 ? card.blockers.map((item) => '- ' + item.code + ': ' + item.message) : ['- None.']),
    '',
    '## Warnings',
    ...(card.warnings.length > 0 ? card.warnings.map((item) => '- ' + item.code + ': ' + item.message) : ['- None.']),
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
  return withManagedArtifactLock(cwd, () => {
    const card = buildReportCard(cwd, command);
    const cardRef = '.terrace/report-card.json';
    const docsRef = 'docs/terrace/REPORT-CARD.md';
    const historyRef = 'docs/terrace/report-history/' + timestampId() + '.md';
    preflightProjectArtifacts(cwd, [docsRef, historyRef]);
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
  });
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
    command: 'terrace report update',
    open_command: relativeExists(cwd, 'docs/terrace/REPORT-CARD.md') ? 'cat docs/terrace/REPORT-CARD.md' : 'terrace report update'
  };
}

function reportHistory(cwd) {
  const dir = path.resolve(cwd, 'docs/terrace/report-history');
  const items = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((file) => file.endsWith('.md')).sort().map((file) => 'docs/terrace/report-history/' + file)
    : [];
  return { items };
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

function markdownFiles(cwd) {
  const roots = ['docs/terrace', 'docs/testing', 'docs/prd', 'docs/spec'];
  const files = [];
  for (const root of roots) {
    const absolute = path.resolve(cwd, root);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    walk(absolute, (filePath) => {
      if (filePath.endsWith('.md')) {
        files.push(path.relative(cwd, filePath));
      }
    });
  }
  return files.sort();
}

function reportCeremony(cwd) {
  const state = loadState(cwd);
  const feature = activeFeatureState(state);
  const files = markdownFiles(cwd);
  const artifactDetails = files.map((file) => {
    const text = fs.readFileSync(path.resolve(cwd, file), 'utf8');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const weakSignals = [];
    if (/TODO|TBD|fill in|not yet recorded/i.test(text)) {
      weakSignals.push('placeholder_language');
    }
    if (/##\s+[^\n]+\n\s*(##|$)/.test(text)) {
      weakSignals.push('empty_section');
    }
    return { file, words, weak_signals: weakSignals };
  });
  const tier = feature ? feature.tier : 'none';
  const budgets = {
    none: { max_artifacts: 8, max_words: 2500 },
    small: { max_artifacts: 4, max_words: 1200 },
    medium: { max_artifacts: 8, max_words: 3000 },
    large: { max_artifacts: 14, max_words: 6000 }
  };
  const budget = budgets[tier] || budgets.medium;
  const totalWords = artifactDetails.reduce((sum, item) => sum + item.words, 0);
  const warnings = [];
  if (artifactDetails.length > budget.max_artifacts) {
    warnings.push(warning({
      code: 'ARTIFACT_BUDGET_EXCEEDED',
      message: 'Artifact count exceeds the tier budget.',
      why_blocked: 'Too many artifacts makes handoff and review harder for agents and humans.',
      next_command: feature ? 'terrace cleanup ' + feature.feature_id : 'terrace report ceremony',
      remediation: 'Merge or trim low-value generated artifacts, then rerun `terrace report ceremony`.'
    }));
  }
  if (totalWords > budget.max_words) {
    warnings.push(warning({
      code: 'WORD_BUDGET_EXCEEDED',
      message: 'Generated markdown word count exceeds the tier budget.',
      why_blocked: 'Large generated reports are harder to audit and less useful as release evidence.',
      next_command: feature ? 'terrace cleanup ' + feature.feature_id : 'terrace report ceremony',
      remediation: 'Condense duplicated artifact text, then rerun `terrace report ceremony`.'
    }));
  }
  for (const item of artifactDetails.filter((artifact) => artifact.weak_signals.length > 0)) {
    warnings.push(warning({
      code: 'LOW_DENSITY_ARTIFACT',
      message: 'Artifact contains placeholder or low-density sections.',
      artifact: item.file,
      file: item.file,
      signals: item.weak_signals,
      why_blocked: 'Placeholder artifacts do not provide enough evidence for reliable handoff or release review.',
      next_command: feature ? 'terrace cleanup ' + feature.feature_id : 'terrace report ceremony',
      remediation: 'Replace placeholder sections in `' + item.file + '` or remove the stale artifact, then rerun `terrace report ceremony`.'
    }));
  }
  return {
    active_feature: feature ? feature.feature_id : null,
    tier,
    budget,
    artifact_count: artifactDetails.length,
    markdown_word_count: totalWords,
    artifacts: artifactDetails,
    warnings,
    passed: warnings.length === 0,
    top_blockers: warnings.slice(0, 3),
    next_command: warnings.length > 0 ? (warnings[0].next_command || 'terrace report ceremony') : 'terrace ship check'
  };
}

function reportShipCheck(cwd) {
  let card;
  try {
    card = buildReportCard(cwd, 'terrace ship check');
  } catch (error) {
    return {
      category: 'tier_one_report',
      command: 'terrace report update',
      passed: false,
      blocking: [blocker({
        code: 'TIER_ONE_REPORT_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        why_blocked: 'Terrace cannot build a current Tier One readiness report from the project state.',
        next_command: 'terrace report update',
        remediation: 'Repair the Terrace state or report inputs, then rerun terrace ship check.'
      })],
      warnings: []
    };
  }
  const blocking = card.score < 50 ? [blocker({
    code: 'TIER_ONE_REPORT_WEAK',
    message: 'Tier One report score is below 50.',
    why_blocked: 'Release readiness requires enough project evidence to make the Tier One report meaningful.',
    next_command: 'terrace report update',
    remediation: 'Run terrace report update and complete the top next actions.'
  })] : [];
  return {
    category: 'tier_one_report',
    command: 'terrace report update',
    passed: blocking.length === 0,
    blocking,
    warnings: card.score < 85 ? [warning({
      code: 'TIER_ONE_GAPS',
      message: 'Tier One report score is below strong readiness: ' + String(card.score) + '.',
      why_blocked: 'The report is not blocking release, but it still shows readiness gaps.',
      next_command: 'terrace report update',
      remediation: 'Follow the report next actions.'
    })] : [],
    report_card: {
      score: card.score,
      status_label: card.status_label,
      source: 'fresh'
    }
  };
}

module.exports = {
  reportRead,
  reportUpdate,
  reportOpen,
  reportHistory,
  reportCeremony,
  reportShipCheck
};
