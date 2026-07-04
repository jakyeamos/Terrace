'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { agentAssetStatus } = require('./agents.cjs');
const { runAudit } = require('./audit.cjs');
const { runDoctor } = require('./health.cjs');
const { readJson } = require('./json.cjs');
const { reportRead } = require('./lifecycle.cjs');
const { portGsdCompare } = require('./port-gsd.cjs');
const { loadState } = require('./state.cjs');
const { discoverProjectCommands } = require('./workflow.cjs');

function packageVersion() {
  const packagePath = path.resolve(__dirname, '..', '..', '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return pkg.version || null;
}

function installedTerraceVersion(cwd) {
  if (process.env.TERRACE_ADOPTION_INSTALLED_VERSION) {
    return process.env.TERRACE_ADOPTION_INSTALLED_VERSION;
  }
  try {
    return execFileSync('terrace', ['--version'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1500
    }).trim() || null;
  } catch (error) {
    return null;
  }
}

function latestCorpusSummary(cwd) {
  const latest = readJson(path.resolve(cwd, 'docs/terrace/corpus/latest-results.json'), null);
  if (!latest || !latest.summary || !latest.summary.totals) {
    return {
      present: false,
      totals: null,
      passed: true,
      warnings: [{
        code: 'CORPUS_RESULTS_MISSING',
        message: 'No local Terrace corpus summary was found.'
      }]
    };
  }
  const totals = latest.summary.totals;
  return {
    present: true,
    run_id: latest.summary.runId || latest.runId || null,
    totals,
    passed: Number(totals.productWeaknesses || 0) === 0 && Number(totals.harnessIssues || 0) === 0,
    warnings: Number(totals.productWeaknesses || 0) === 0 && Number(totals.harnessIssues || 0) === 0 ? [] : [{
      code: 'CORPUS_WEAKNESS_FOUND',
      message: 'The latest corpus run reports product weaknesses or harness issues.'
    }]
  };
}

function planningPhaseCoverage(cwd) {
  try {
    const comparison = portGsdCompare(cwd);
    return {
      present: comparison.source_files > 0,
      source_files: comparison.source_files,
      phase_count: comparison.concepts && Number.isFinite(Number(comparison.concepts.phases)) ? Number(comparison.concepts.phases) : 0,
      parity_passed: comparison.passed,
      missing: Array.isArray(comparison.missing) ? comparison.missing : []
    };
  } catch (error) {
    return {
      present: false,
      source_files: 0,
      phase_count: 0,
      parity_passed: false,
      missing: [],
      error: error && error.message ? error.message : String(error)
    };
  }
}

function migratedPhaseCoverage(cwd, state, corpus) {
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const planning = planningPhaseCoverage(cwd);
  const hasPhaseTarget = phases.length > 0;
  const warnings = [];
  if (!hasPhaseTarget && planning.phase_count > 0) {
    warnings.push({
      code: 'TERRACE_PHASE_TARGET_NOT_IMPORTED',
      message: 'Legacy planning has phase concepts, but Terrace state has no executable roadmap phases.'
    });
  } else if (!hasPhaseTarget && corpus.present) {
    warnings.push({
      code: 'MIGRATED_PHASE_TARGET_MISSING',
      message: 'No Terrace roadmap phase is available for migrated-GSD phase commands.'
    });
  }
  const totals = corpus.totals || {};
  return {
    phase_count: phases.length,
    state_phase_count: phases.length,
    planning_phase_count: planning.phase_count,
    planning_parity_passed: planning.parity_passed,
    planning_source_files: planning.source_files,
    planning_missing: planning.missing,
    has_phase_target: hasPhaseTarget,
    executable_phase_targets: hasPhaseTarget,
    corpus_skips: Number(totals.skipped || 0),
    passed: hasPhaseTarget || !corpus.present,
    warnings
  };
}

function check(name, passed, evidence, remediation) {
  return {
    name,
    passed,
    evidence,
    remediation: passed ? null : remediation
  };
}

function countItems(value) {
  return Array.isArray(value) ? value.length : 0;
}

function checkPassed(checks, name) {
  const found = checks.find((item) => item.name === name);
  return Boolean(found && found.passed);
}

function knownGsdCompatibleCommands() {
  return [
    'terrace next',
    'terrace resume',
    'terrace history',
    'terrace do "<intent>"',
    'terrace phase plan <id>',
    'terrace phase execute <id>',
    'terrace phase validate <id>',
    'terrace phase review <id>',
    'terrace phase complete <id>',
    'terrace execute-phase-complete <id>',
    'terrace quick plan "<title>"',
    'terrace quick execute <id>',
    'terrace quick complete <id>',
    'terrace backlog list',
    'terrace backlog add "<title>"',
    'terrace plan-phase <id>',
    'terrace execute-phase <id>',
    'terrace validate-phase <id>',
    'terrace review-phase <id>',
    'terrace complete-phase <id>',
    'terrace ship check',
    'terrace workbench status'
  ];
}

function projectCommandEvidence(commands) {
  const checks = Array.isArray(commands.checks) ? commands.checks : [];
  const available = checks.filter((item) => item.exists).map((item) => ({
    category: item.category,
    command: item.command
  }));
  const missingRequired = checks.filter((item) => item.required && !item.exists).map((item) => ({
    category: item.category,
    suggested: item.suggested
  }));
  return {
    package_manager: commands.package_manager,
    available_quality_commands: available,
    missing_required_quality_commands: missingRequired,
    dead_code_gate: commands.dead_code || null,
    passed: missingRequired.length === 0
  };
}

function workflowEvidence(state, commands, agents, corpus, report) {
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const quickTasks = Array.isArray(state.quick_tasks) ? state.quick_tasks : [];
  const backlogItems = state.backlog && Array.isArray(state.backlog.items) ? state.backlog.items : [];
  const blockedActions = Array.isArray(state.blocked_actions) ? state.blocked_actions : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  const knownCommands = knownGsdCompatibleCommands();
  return {
    migrated_context: {
      phase_count: phases.length,
      quick_task_count: quickTasks.length,
      backlog_item_count: backlogItems.length,
      blocked_action_count: blockedActions.length,
      session_count: sessions.length,
      handoff_status: state.handoff && state.handoff.status ? state.handoff.status : null,
      has_operational_history: phases.length > 0 || quickTasks.length > 0 || backlogItems.length > 0 || sessions.length > 0
    },
    command_surface: {
      gsd_compatible_commands: knownCommands,
      count: knownCommands.length,
      has_phase_aliases: true,
      has_quick_task_flow: true,
      has_resume_history_next: true,
      has_natural_language_router: true,
      has_ship_readiness: true
    },
    agent_readiness: {
      complete: agents.complete,
      present: agents.present,
      expected_total: agents.expected_total,
      next_command: agents.next_command
    },
    project_gates: projectCommandEvidence(commands),
    corpus_health: {
      present: corpus.present,
      run_id: corpus.run_id || null,
      passed: corpus.passed,
      totals: corpus.totals
    },
    report_card: {
      status_label: report.status_label || null,
      claim_scope: report.claim_scope || null
    }
  };
}

function nextCommandForCheck(name, evidence) {
  if (name === 'doctor') return 'terrace doctor';
  if (name === 'audit') return 'terrace audit';
  if (name === 'package_manager') return 'terrace commands discover';
  if (name === 'version_alignment') return 'terrace --version';
  if (name === 'corpus_health') return 'terrace corpus run';
  if (name === 'migrated_gsd_phase_coverage') {
    if (evidence && evidence.planning_phase_count > 0 && evidence.executable_phase_targets === false) {
      return 'terrace port gsd --import-roadmap';
    }
    return 'terrace port gsd --dry-run';
  }
  if (name === 'agent_assets') return 'terrace init';
  if (name === 'report_claim_scope') return 'terrace report update';
  return 'terrace adoption status';
}

function nextSteps(blockers, replacementReady, statusLabel) {
  if (replacementReady) {
    return [{
      command: 'terrace next',
      why: 'Start using Terrace as the default workflow entrypoint.',
      fixes: []
    }, {
      command: 'terrace ship check',
      why: 'Recheck release readiness before protected work ships.',
      fixes: []
    }];
  }
  const steps = blockers.slice(0, 5).map((item) => ({
    command: nextCommandForCheck(item.name, item.evidence),
    why: item.remediation,
    fixes: [item.name]
  }));
  if (statusLabel === 'pilot_ready_with_gaps') {
    steps.push({
      command: 'terrace next',
      why: 'Pilot Terrace for day-to-day workflow while resolving the remaining replacement blockers.',
      fixes: []
    });
  }
  return steps;
}

function replacementAnswer(replacementReady, score) {
  if (replacementReady) {
    return 'Yes. Terrace has the local workflow, agent, migration, corpus, and governance evidence needed to replace GSD as the default workflow.';
  }
  if (score >= 75) {
    return 'Not fully yet. Terrace is usable as the pilot workflow, but the listed blockers should be cleared before retiring GSD fallback paths.';
  }
  return 'No. Keep GSD available until Terrace clears the blocking readiness checks below.';
}

function readinessMode(replacementReady, score) {
  if (replacementReady) return 'replace_gsd';
  if (score >= 75) return 'pilot_with_gsd_fallback';
  return 'keep_gsd';
}

function adoptionStatus(cwd) {
  const doctor = runDoctor(cwd);
  const audit = runAudit(cwd);
  const commands = discoverProjectCommands(cwd);
  const localVersion = packageVersion();
  const installedVersion = installedTerraceVersion(cwd);
  const state = loadState(cwd);
  const report = reportRead(cwd).report_card;
  const agents = agentAssetStatus(cwd);
  const corpus = latestCorpusSummary(cwd);
  const migrated = migratedPhaseCoverage(cwd, state, corpus);
  const packageAligned = commands.package_manager === 'pnpm';
  const versionAligned = !installedVersion || installedVersion === localVersion;
  const reportScoped = report.claim_scope !== 'baseline_readiness' || report.status_label === 'baseline_ready';
  const checks = [
    check('doctor', doctor.healthy === true, doctor, 'Run terrace doctor and resolve blocking diagnostics.'),
    check('audit', audit.healthy === true, {
      blocking: audit.blocking || [],
      warnings: audit.warnings || []
    }, 'Run terrace audit and resolve blocking governance findings.'),
    check('package_manager', packageAligned, {
      package_manager: commands.package_manager,
      expected: 'pnpm'
    }, 'Use pnpm lockfiles and pnpm scripts for Terrace JavaScript workflows.'),
    check('version_alignment', versionAligned, {
      local_version: localVersion,
      installed_version: installedVersion
    }, 'Refresh the installed Terrace binary so terrace --version matches the local package.'),
    check('corpus_health', corpus.passed, corpus, 'Run terrace corpus run and address product weaknesses or harness issues.'),
    check('migrated_gsd_phase_coverage', migrated.passed, migrated, 'Import or author Terrace roadmap phases so migrated roadmap commands have executable phase targets.'),
    check('agent_assets', agents.complete, agents, 'Run terrace init or terrace agents install-global to repair generated agent command assets.'),
    check('report_claim_scope', reportScoped, {
      status_label: report.status_label,
      claim_scope: report.claim_scope || null
    }, 'Refresh the report card so baseline state is not reported as full Tier One delivery readiness.')
  ];
  const blockers = checks.filter((item) => !item.passed);
  const score = Math.round((checks.length - blockers.length) / checks.length * 100);
  const replacementReady = blockers.length === 0;
  const statusLabel = replacementReady ? 'replacement_ready' : score >= 75 ? 'pilot_ready_with_gaps' : 'not_ready';
  const evidence = workflowEvidence(state, commands, agents, corpus, report);
  const steps = nextSteps(blockers, replacementReady, statusLabel);
  return {
    command: 'terrace adoption status',
    replacement: 'gsd',
    question: 'Can Terrace replace GSD for me yet?',
    answer: replacementAnswer(replacementReady, score),
    ready: replacementReady,
    score,
    status_label: statusLabel,
    recommended_mode: readinessMode(replacementReady, score),
    evidence,
    readiness_summary: {
      workflow_continuity: evidence.migrated_context.has_operational_history,
      gsd_command_surface: evidence.command_surface.count,
      project_gates_detected: countItems(evidence.project_gates.available_quality_commands),
      agent_assets_complete: agents.complete,
      corpus_passed: corpus.passed,
      doctor_passed: checkPassed(checks, 'doctor'),
      audit_passed: checkPassed(checks, 'audit')
    },
    checks,
    blockers,
    next_steps: steps,
    next_commands: steps.map((item) => item.command)
  };
}

module.exports = {
  adoptionStatus
};
