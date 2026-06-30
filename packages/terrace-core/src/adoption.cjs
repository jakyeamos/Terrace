'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { agentAssetStatus } = require('./agents.cjs');
const { runAudit } = require('./audit.cjs');
const { runDoctor } = require('./health.cjs');
const { readJson } = require('./json.cjs');
const { reportRead } = require('./lifecycle.cjs');
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

function migratedPhaseCoverage(state, corpus) {
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const totals = corpus.totals || {};
  return {
    phase_count: phases.length,
    has_phase_target: phases.length > 0,
    corpus_skips: Number(totals.skipped || 0),
    passed: phases.length > 0 || !corpus.present,
    warnings: phases.length > 0 || !corpus.present ? [] : [{
      code: 'MIGRATED_PHASE_TARGET_MISSING',
      message: 'No Terrace roadmap phase is available for migrated-GSD phase commands.'
    }]
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
  const migrated = migratedPhaseCoverage(state, corpus);
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
    check('migrated_gsd_phase_coverage', migrated.passed, migrated, 'Run terrace port gsd or planning refresh so migrated roadmap commands have a phase target.'),
    check('agent_assets', agents.complete, agents, 'Run terrace init or terrace agents install-global to repair generated agent command assets.'),
    check('report_claim_scope', reportScoped, {
      status_label: report.status_label,
      claim_scope: report.claim_scope || null
    }, 'Refresh the report card so baseline state is not reported as full Tier One delivery readiness.')
  ];
  const blockers = checks.filter((item) => !item.passed);
  const score = Math.round((checks.length - blockers.length) / checks.length * 100);
  const replacementReady = blockers.length === 0;
  return {
    command: 'terrace adoption status',
    replacement: 'gsd',
    ready: replacementReady,
    score,
    status_label: replacementReady ? 'replacement_ready' : score >= 75 ? 'pilot_ready_with_gaps' : 'not_ready',
    checks,
    blockers,
    next_commands: blockers.length > 0
      ? blockers.slice(0, 3).map((item) => item.remediation)
      : ['Use Terrace as the default workflow entrypoint for explicit phase, quick, ship, and workbench commands.']
  };
}

module.exports = {
  adoptionStatus
};
