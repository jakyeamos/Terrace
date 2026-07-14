'use strict';

const { execFileSync } = require('child_process');
const { loadState } = require('./state.cjs');
const { runAudit } = require('./audit.cjs');
const { blocker, topBlockers, warning } = require('./guidance.cjs');
const { runDoctor } = require('./health.cjs');
const { securityShipCheck } = require('./security-check.cjs');
const { runCommandFor, setScriptCommand } = require('./package-manager.cjs');
const { discoverProjectCommands } = require('./project-command-discovery.cjs');
const { SHIP_CHECK_MODES } = require('./ship-check-modes.cjs');
const { writeProjectText } = require('./managed-artifacts.cjs');
const {
  reportShipCheck,
  preflightShipCheck,
  debtShipCheck,
  documentationShipCheck,
  testEvalShipCheck,
  aiReviewShipCheck,
  ruleAuditShipCheck,
  waiverShipCheck
} = require('./lifecycle.cjs');

function staticCheck(result, category, command) {
  return {
    category,
    command,
    passed: result.blocking.length === 0,
    blocking: result.blocking || [],
    warnings: result.warnings || []
  };
}

function migrationReadinessCheck(cwd) {
  try {
    const state = loadState(cwd);
    const readiness = state.migration && state.migration.readiness ? state.migration.readiness : null;
    const blockers = (state.blocked_actions || []).filter((item) => item.blocking).map((item) => blocker({
      code: 'MIGRATION_BLOCKED_ACTION',
      message: item.description,
      why_blocked: 'Migrated GSD state recorded a human action as blocking release readiness.',
      next_command: 'terrace next',
      remediation: 'Resolve or clear the migrated blocked action.'
    }));
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: blockers.length === 0,
      readiness,
      blocking: blockers,
      warnings: []
    };
  } catch (error) {
    return {
      category: 'migration_readiness',
      command: 'terrace migration readiness',
      passed: false,
      blocking: [blocker({
        code: 'MIGRATION_READINESS_UNAVAILABLE',
        message: error && error.message ? error.message : String(error),
        why_blocked: 'Terrace cannot inspect migration readiness until the repo has Terrace state.',
        next_command: 'terrace init',
        remediation: 'Run terrace init or terrace port gsd before checking migration readiness.'
      })],
      warnings: []
    };
  }
}

function commandCheck(cwd, command, category, options) {
  const opts = options || {};
  try {
    if (process.platform === 'win32' && command[0] === 'npm') {
      execFileSync(command.join(' '), { cwd, stdio: 'ignore', shell: true });
    } else {
      execFileSync(command[0], command.slice(1), { cwd, stdio: 'ignore' });
    }
    return { category, command: command.join(' '), passed: true, blocking: [] };
  } catch (error) {
    return {
      category,
      command: command.join(' '),
      passed: false,
      blocking: [blocker({
        code: opts.failure_code || 'QUALITY_GATE_FAILED',
        message: opts.failure_message || command.join(' ') + ' failed.',
        why_blocked: opts.why_blocked || 'Release readiness requires the project quality gate to pass.',
        next_command: command.join(' '),
        remediation: opts.remediation || 'Run the command locally and fix the reported failures.'
      })]
    };
  }
}

function dirtyTreeCheck(cwd) {
  const command = 'git status --porcelain=v1 --untracked-files=all';
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (!output.trim()) {
      return { category: 'dirty_tree', command, passed: true, blocking: [] };
    }
    return {
      category: 'dirty_tree',
      command,
      passed: false,
      blocking: [blocker({
        code: 'DIRTY_TREE',
        message: 'Git status reports staged, unstaged, or untracked files.',
        why_blocked: 'Release readiness must be evaluated against a known repository snapshot.',
        next_command: 'git status --short',
        remediation: 'Commit, discard, or intentionally exclude every reported file before rerunning the local or full ship check.'
      })]
    };
  } catch (error) {
    return {
      category: 'dirty_tree',
      command,
      passed: false,
      blocking: [blocker({
        code: 'DIRTY_TREE_CHECK_UNAVAILABLE',
        message: error && error.message ? error.message : 'Git status could not inspect the working tree.',
        why_blocked: 'Terrace cannot verify repository cleanliness without Git status evidence.',
        next_command: 'git status --short',
        remediation: 'Run the ship check from a Git working tree or resolve the Git status error.'
      })]
    };
  }
}

function missingScriptCheck(discovered, check) {
  return {
    category: check.category,
    command: check.script ? runCommandFor(discovered.package_manager, check.script).join(' ') : null,
    passed: true,
    skipped: true,
    blocking: [],
    warnings: [warning({
      code: 'QUALITY_SCRIPT_MISSING',
      message: 'No package script was found for ' + check.category + '.',
      why_blocked: 'Terrace could not enforce this optional quality signal because the script is missing.',
      next_command: setScriptCommand(discovered.package_manager, check.script, check.suggested),
      remediation: 'Add a `' + check.script + '` script such as `' + check.suggested + '` if this gate should be enforced.'
    })]
  };
}

function scriptCheck(cwd, discovered, check) {
  if (!check.exists) {
    return missingScriptCheck(discovered, check);
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), check.category);
}

function deadCodeCheck(cwd, discovered) {
  const check = discovered.dead_code;
  if (!check.enabled) {
    return {
      category: 'dead_code',
      command: null,
      passed: true,
      skipped: true,
      blocking: [],
      warnings: [warning({
        code: 'DEAD_CODE_GATE_SKIPPED',
        message: 'Dead-code readiness gate is intentionally skipped.',
        why_blocked: 'Terrace did not enforce the dead-code signal because this repo disabled it in .terrace/config.json.',
        next_command: 'terrace ship check --full',
        remediation: 'Remove `ship_gates.dead_code.enabled: false` when the repo has a dead-code script to enforce.',
        reason: check.reason
      })]
    };
  }
  if (!check.exists) {
    const item = {
      code: 'DEAD_CODE_SCRIPT_MISSING',
      message: check.configured
        ? 'Configured dead-code package script was not found: ' + check.script + '.'
        : 'No package script was found for the dead-code readiness gate.',
      why_blocked: check.configured
        ? 'Terrace cannot enforce the configured dead-code gate until the package script exists.'
        : 'Terrace could not enforce this optional dead-code signal because the script is missing.',
      next_command: setScriptCommand(discovered.package_manager, check.script, 'knip or project dead-code command'),
      remediation: check.configured
        ? 'Add the configured `' + check.script + '` package script or update `ship_gates.dead_code.scripts` in `.terrace/config.json`.'
        : 'Add a package script such as `dead-code`, `knip`, or configure `ship_gates.dead_code.scripts`; set `ship_gates.dead_code.enabled` to false with a reason to skip intentionally.',
      scripts: check.scripts
    };
    return {
      category: 'dead_code',
      command: null,
      passed: !check.configured,
      skipped: !check.configured,
      blocking: check.configured ? [blocker(item)] : [],
      warnings: check.configured ? [] : [warning(item)]
    };
  }
  return commandCheck(cwd, runCommandFor(discovered.package_manager, check.script), 'dead_code', {
    failure_code: 'DEAD_CODE_GATE_FAILED',
    failure_message: 'Dead-code readiness script failed: ' + check.command + '.',
    why_blocked: 'Release readiness requires the configured dead-code gate to pass.',
    remediation: 'Run the dead-code script locally and remove, justify, or configure the reported unused code.'
  });
}

function timedCategory(factory) {
  const started = Date.now();
  const category = factory();
  const elapsed = Date.now() - started;
  return {
    category: {
      ...category,
      elapsed_ms: elapsed
    },
    timing: {
      category: category.category,
      elapsed_ms: elapsed
    }
  };
}

function invalidShipModeResult(mode) {
  const invalidMode = typeof mode === 'string' && mode.trim() ? mode : String(mode);
  const invalid = blocker({
    code: 'SHIP_CHECK_MODE_INVALID',
    message: 'Unsupported ship-check mode: ' + invalidMode + '.',
    why_blocked: 'Terrace only accepts fast, local, or full ship-check modes and must not silently choose an execution-capable fallback.',
    next_command: 'terrace ship check --fast',
    remediation: 'Use `--fast` for the read-only default, `--local` to include the Git dirty-tree check, or `--full` only when you intend to execute project scripts.'
  });
  return {
    mode: invalidMode,
    passed: false,
    project_commands: null,
    categories: [],
    timings: [],
    blockers: [invalid],
    warnings: [],
    top_blockers: [invalid],
    next_command: invalid.next_command,
    recheck_command: 'terrace ship check --fast'
  };
}

function createShipReadiness(dependencies) {
  const {
    seniorCycleShipCheck,
    terracePackageReleaseTarget,
    trustedPublishingShipCheck
  } = dependencies;

  function shipCheck(cwd, options) {
    const opts = options || {};
    if (opts.mode !== undefined && !SHIP_CHECK_MODES.includes(opts.mode)) {
      return invalidShipModeResult(opts.mode);
    }
    const mode = opts.mode || 'fast';
    const discovered = discoverProjectCommands(cwd);
    const dirtyTree = mode === 'local' || mode === 'full' ? dirtyTreeCheck(cwd) : null;
    const factories = [
      ...(dirtyTree ? [() => dirtyTree] : []),
      () => staticCheck(runDoctor(cwd), 'doctor', 'terrace doctor'),
      () => staticCheck(runAudit(cwd), 'audit', 'terrace audit'),
      () => securityShipCheck(cwd),
      () => reportShipCheck(cwd),
      () => migrationReadinessCheck(cwd),
      () => seniorCycleShipCheck(cwd),
      ...(opts.includeTrustedPublishing !== false && terracePackageReleaseTarget(cwd) ? [() => trustedPublishingShipCheck(cwd)] : []),
      () => preflightShipCheck(cwd),
      () => aiReviewShipCheck(cwd),
      () => debtShipCheck(cwd),
      () => waiverShipCheck(cwd),
      () => documentationShipCheck(cwd),
      () => testEvalShipCheck(cwd),
      () => ruleAuditShipCheck(cwd)
    ];
    if (mode === 'full' && (!dirtyTree || dirtyTree.passed)) {
      for (const check of discovered.checks) {
        factories.push(() => scriptCheck(cwd, discovered, check));
      }
      factories.push(() => deadCodeCheck(cwd, discovered));
    }
    const timed = factories.map((factory) => timedCategory(factory));
    const categories = timed.map((item) => item.category);
    const timings = timed.map((item) => item.timing);
    const blockers = categories.flatMap((category) => category.blocking || []);
    const warnings = categories.flatMap((category) => category.warnings || []);
    return {
      mode,
      passed: blockers.length === 0,
      project_commands: discovered,
      categories,
      timings,
      blockers,
      warnings,
      top_blockers: topBlockers(blockers, 3),
      next_command: blockers.length > 0 ? (blockers[0].next_command || 'terrace ship check --fast') : 'terrace ship prepare',
      recheck_command: 'terrace ship check --fast'
    };
  }

  function shipPrepare(cwd, options) {
    const opts = options || {};
    const mode = opts.mode === undefined ? 'full' : opts.mode;
    const result = shipCheck(cwd, { mode });
    if (!SHIP_CHECK_MODES.includes(mode)) {
      return {
        ...result,
        ship_ref: null,
        next_command: 'terrace ship check --fast',
        recheck_command: 'terrace ship check --fast'
      };
    }
    const shipRef = 'docs/terrace/ship/SHIP.md';
    writeProjectText(cwd, shipRef, [
      '# Release Readiness',
      '',
      '## Status',
      '- Mode: ' + result.mode,
      '- Passed: ' + String(result.passed),
      '- Blocking issue count: ' + String(result.blockers.length),
      '- Warning count: ' + String(result.warnings.length),
      '',
      '## Categories',
      ...result.categories.map((category) => '- ' + category.category + ': ' + (category.passed ? 'passed' : 'failed') + ' (`' + category.command + '`)'),
      '',
      '## Blockers',
      ...(result.blockers.length > 0 ? result.blockers.map((item) => '- ' + item.code + ': ' + item.message + (item.next_command ? ' Next: `' + item.next_command + '`.' : '')) : ['- None.']),
      '',
      '## Next Command',
      '- terrace ship check --' + result.mode
    ].join('\n') + '\n');
    return {
      ...result,
      ship_ref: shipRef,
      next_command: 'terrace ship check --' + result.mode,
      recheck_command: 'terrace ship check --fast'
    };
  }

  return {
    dirtyTreeCheck,
    shipCheck,
    shipPrepare
  };
}

module.exports = {
  createShipReadiness
};
