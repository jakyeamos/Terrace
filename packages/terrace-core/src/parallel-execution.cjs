'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { appendEvent } = require('./events.cjs');
const { loadState, saveState } = require('./state.cjs');
const { phaseExecute } = require('./workflow.cjs');

const ACTIVE_RUN_STATUSES = new Set(['preparing', 'running', 'merge_blocked', 'interrupted', 'failed']);
const MERGEABLE_RUN_STATUSES = new Set(['running', 'merge_blocked', 'interrupted']);
const INTERNAL_CANONICAL_FILES = new Set([
  '.terrace/state.json',
  '.terrace/events.jsonl',
  '.terrace/parallel-writer.lock'
]);

function nowIso() {
  return new Date().toISOString();
}

function safeToken(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new Error('Parallel execution identifiers must contain letters or numbers.');
  }
  return normalized;
}

function normalizeRepoPath(filePath) {
  const value = String(filePath || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+/g, '/');
  if (!value || value === '.' || value === '..' || value.startsWith('../') || value.startsWith('/') || /^[A-Za-z]:\//.test(value) || value.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Unsafe parallel plan file path: ' + String(filePath));
  }
  return value.replace(/\/$/, '');
}

function unique(values) {
  return Array.from(new Set(values));
}

function normalizeFileList(value) {
  const candidates = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.keys(value)
      : [];
  return unique(candidates.map((item) => normalizeRepoPath(item)));
}

function git(cwd, args, options) {
  const opts = options || {};
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: opts.stdio || ['ignore', 'pipe', 'pipe']
  }).trim();
}

function gitTry(cwd, args) {
  try {
    return { ok: true, value: git(cwd, args) };
  } catch (error) {
    return {
      ok: false,
      value: '',
      error: error && error.message ? error.message : String(error)
    };
  }
}

function gitRoot(cwd) {
  const result = gitTry(cwd, ['rev-parse', '--show-toplevel']);
  if (!result.ok) {
    throw new Error('Parallel execution requires a Git repository with a valid HEAD.');
  }
  return path.resolve(result.value);
}

function gitStatusFiles(cwd) {
  let output;
  try {
    output = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd,
      encoding: 'utf8'
    });
  } catch (error) {
    return [error && error.message ? error.message : String(error)];
  }
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replace(/^"|"$/g, ''));
}

function currentCommit(cwd) {
  return git(cwd, ['rev-parse', 'HEAD']);
}

function currentBranch(cwd) {
  return git(cwd, ['branch', '--show-current']) || null;
}

function relativePath(cwd, filePath) {
  return path.relative(cwd, filePath).split(path.sep).join('/');
}

function sourceText(cwd, sourceRef) {
  if (!sourceRef || typeof sourceRef !== 'string') {
    return '';
  }
  const resolved = path.resolve(cwd, sourceRef);
  if (!resolved.startsWith(path.resolve(cwd) + path.sep) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return '';
  }
  return fs.readFileSync(resolved, 'utf8');
}

function inferFileReferences(text) {
  const matches = String(text || '').match(/[A-Za-z0-9_./()[\]-]+\.(?:ts|tsx|js|jsx|cjs|mjs|json|md|sql|css|scss|yml|yaml|sh)/g) || [];
  return unique(matches.map((item) => item.replace(/^\(|\)$/g, '')));
}

function phaseFor(state, phaseId) {
  const phases = state.roadmap && Array.isArray(state.roadmap.phases) ? state.roadmap.phases : [];
  const phase = phases.find((item) => item.id === phaseId);
  if (!phase) {
    throw new Error('Unknown phase: ' + phaseId);
  }
  return phase;
}

function overrideFor(phase, planId) {
  const parallel = phase.parallel_execution || phase.parallel || {};
  const entries = parallel && parallel.plans;
  if (Array.isArray(entries)) {
    return entries.find((entry) => entry && entry.id === planId) || {};
  }
  if (entries && typeof entries === 'object') {
    return entries[planId] || {};
  }
  return {};
}

function planDependencies(plan) {
  const dependencies = plan.depends_on || plan.dependencies || [];
  if (!Array.isArray(dependencies)) {
    throw new Error('Parallel plan dependencies must be an array: ' + String(plan.id));
  }
  return unique(dependencies.map((item) => String(item).trim()).filter(Boolean));
}

function planFiles(plan) {
  const fields = [plan.owned_files, plan.files, plan.file_ownership];
  for (const field of fields) {
    if (Array.isArray(field) || (field && typeof field === 'object')) {
      const normalized = normalizeFileList(field);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }
  return [];
}

function pathOverlaps(left, right) {
  const a = left.replace(/\/$/, '');
  const b = right.replace(/\/$/, '');
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function isSummaryPath(filePath, phaseId, planId) {
  return filePath === summaryRefFor(phaseId, planId);
}

function isReservedWorkerPath(filePath, phaseId, planId) {
  if (filePath === '.terrace' || filePath.startsWith('.terrace/')) {
    return true;
  }
  if (filePath === '.planning' || filePath.startsWith('.planning/')) {
    return true;
  }
  const phaseRoot = 'docs/terrace/phases/' + safeToken(phaseId) + '/';
  if (filePath.startsWith(phaseRoot) && !isSummaryPath(filePath, phaseId, planId)) {
    return true;
  }
  return false;
}

function summaryRefFor(phaseId, planId) {
  return 'docs/terrace/phases/' + safeToken(phaseId) + '/plans/' + safeToken(planId) + '/SUMMARY.md';
}

function blocker(code, message, nextCommand, remediation, extra) {
  return {
    code,
    message,
    why_blocked: message,
    next_command: nextCommand || null,
    remediation: remediation || null,
    ...(extra || {})
  };
}

function buildPlanSpecs(cwd, phase) {
  const rawPlans = Array.isArray(phase.plans) ? phase.plans : [];
  const plans = [];
  const blockers = [];
  const seen = new Set();
  const seenTokens = new Map();
  let explicitWaveCount = 0;

  for (const rawPlan of rawPlans) {
    const plan = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
    const id = String(plan.id || '').trim();
    if (!id) {
      blockers.push(blocker(
        'PARALLEL_PLAN_ID_REQUIRED',
        'Every plan needs a stable id before it can be isolated.',
        'terrace phase plan ' + phase.id,
        'Add an id to each phase plan.'
      ));
      continue;
    }
    if (seen.has(id)) {
      blockers.push(blocker(
        'PARALLEL_PLAN_ID_DUPLICATE',
        'Parallel plan ids must be unique: ' + id,
        'terrace phase plan ' + phase.id,
        'Rename the duplicate plan id before starting worktrees.'
      ));
      continue;
    }
    seen.add(id);
    let idToken;
    try {
      idToken = safeToken(id);
    } catch (error) {
      blockers.push(blocker(
        'PARALLEL_PLAN_ID_INVALID',
        'Plan ' + id + ' cannot be used as a safe branch/worktree identifier.',
        'terrace phase plan ' + phase.id,
        'Use letters, numbers, dots, dashes, or underscores in plan ids.'
      ));
      continue;
    }
    const tokenOwner = seenTokens.get(idToken);
    if (tokenOwner) {
      blockers.push(blocker(
        'PARALLEL_PLAN_ID_COLLISION',
        'Plan ids ' + tokenOwner + ' and ' + id + ' map to the same isolated branch token: ' + idToken,
        'terrace parallel plan ' + phase.id,
        'Rename one plan so its normalized branch/worktree identifier is unique.'
      ));
      continue;
    }
    seenTokens.set(idToken, id);
    const override = overrideFor(phase, id);
    const combined = { ...plan, ...override, id };
    let ownedFiles = [];
    try {
      ownedFiles = planFiles(combined);
    } catch (error) {
      blockers.push(blocker(
        'PARALLEL_PLAN_FILE_PATH_INVALID',
        error && error.message ? error.message : String(error),
        'terrace parallel plan ' + phase.id,
        'Use repository-relative file paths in the plan files/owned_files list.'
      ));
    }
    const inferredFiles = inferFileReferences(sourceText(cwd, combined.source_ref));
    let dependencies = [];
    try {
      dependencies = planDependencies(combined);
    } catch (error) {
      blockers.push(blocker(
        'PARALLEL_DEPENDENCIES_INVALID',
        error && error.message ? error.message : String(error),
        'terrace parallel plan ' + phase.id,
        'Use a list of plan ids in depends_on.'
      ));
    }
    const hasWave = combined.wave !== undefined && combined.wave !== null && String(combined.wave).trim() !== '';
    const wave = hasWave ? Number(combined.wave) : null;
    if (hasWave) {
      explicitWaveCount += 1;
      if (!Number.isInteger(wave) || wave < 1) {
        blockers.push(blocker(
          'PARALLEL_WAVE_INVALID',
          'Plan ' + id + ' must use a positive integer wave.',
          'terrace parallel plan ' + phase.id,
          'Set wave to a positive integer or remove wave and use depends_on.'
        ));
      }
    }
    if (ownedFiles.length === 0) {
      blockers.push(blocker(
        'PARALLEL_FILE_OWNERSHIP_REQUIRED',
        'Plan ' + id + ' does not declare owned files; inferred references are advisory only.',
        'terrace parallel plan ' + phase.id,
        'Add a files or owned_files array to the phase plan. Inferred files: ' + (inferredFiles.join(', ') || 'none')
      ));
    }
    for (const filePath of ownedFiles) {
      if (isReservedWorkerPath(filePath, phase.id, id)) {
        blockers.push(blocker(
          'PARALLEL_SINGLE_WRITER_PATH',
          'Plan ' + id + ' claims a Terrace-owned state or roadmap path: ' + filePath,
          'terrace phase execute ' + phase.id,
          'Keep .terrace, .planning, and canonical phase artifacts under the central writer.'
        ));
      }
    }
    plans.push({
      id,
      title: String(combined.title || id),
      source_ref: combined.source_ref || null,
      owned_files: ownedFiles,
      inferred_files: inferredFiles,
      ownership_source: ownedFiles.length > 0 ? 'plan' : null,
      depends_on: dependencies,
      declared_wave: wave,
      wave: null,
      summary_ref: summaryRefFor(phase.id, id),
      status: 'pending',
      branch: null,
      worktree: null,
      base_commit: null,
      commit: null,
      failure: null
    });
  }

  if (plans.length === 0) {
    blockers.push(blocker(
      'PARALLEL_PLANS_REQUIRED',
      'The phase has no plans to isolate.',
      'terrace phase execute ' + phase.id,
      'Use the existing sequential phase path or attach plans before opting into worktrees.'
    ));
    return { plans, waves: [], blockers };
  }
  if (explicitWaveCount > 0 && explicitWaveCount !== plans.length) {
    blockers.push(blocker(
      'PARALLEL_WAVE_REQUIRED',
      'Either every plan must declare wave or none may declare wave.',
      'terrace parallel plan ' + phase.id,
      'Declare waves for every plan or remove wave and use depends_on for topological ordering.'
    ));
  }

  const planIds = new Set(plans.map((plan) => plan.id));
  for (const plan of plans) {
    if (plan.depends_on.includes(plan.id)) {
      blockers.push(blocker(
        'PARALLEL_DEPENDENCY_SELF_REFERENCE',
        'Plan ' + plan.id + ' cannot depend on itself.',
        'terrace parallel plan ' + phase.id,
        'Remove the self-reference from depends_on.'
      ));
    }
    for (const dependency of plan.depends_on) {
      if (!planIds.has(dependency)) {
        blockers.push(blocker(
          'PARALLEL_DEPENDENCY_UNKNOWN',
          'Plan ' + plan.id + ' depends on unknown plan ' + dependency + '.',
          'terrace parallel plan ' + phase.id,
          'Use an existing plan id or remove the dependency.'
        ));
      }
    }
  }

  for (let leftIndex = 0; leftIndex < plans.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < plans.length; rightIndex += 1) {
      const left = plans[leftIndex];
      const right = plans[rightIndex];
      const overlaps = left.owned_files.flatMap((leftFile) => right.owned_files.filter((rightFile) => pathOverlaps(leftFile, rightFile)));
      if (overlaps.length > 0) {
        blockers.push(blocker(
          'PARALLEL_FILE_OVERLAP',
          'Plans ' + left.id + ' and ' + right.id + ' claim overlapping files: ' + unique(overlaps).join(', '),
          'terrace phase execute ' + phase.id,
          'Split ownership, add a dependency and keep the shared-file work on the sequential path, or run the phase sequentially.'
        ));
      }
    }
  }

  if (explicitWaveCount === plans.length) {
    for (const plan of plans) {
      plan.wave = plan.declared_wave;
    }
    const waveNumbers = unique(plans.map((plan) => plan.wave)).sort((left, right) => left - right);
    waveNumbers.forEach((waveNumber, index) => {
      if (waveNumber !== index + 1) {
        blockers.push(blocker(
          'PARALLEL_WAVE_GAP',
          'Parallel waves must be contiguous starting at wave 1.',
          'terrace parallel plan ' + phase.id,
          'Renumber the explicit wave values.'
        ));
      }
    });
    for (const plan of plans) {
      for (const dependency of plan.depends_on) {
        const dependencyPlan = plans.find((candidate) => candidate.id === dependency);
        if (dependencyPlan && dependencyPlan.wave >= plan.wave) {
          blockers.push(blocker(
            'PARALLEL_WAVE_ORDER_INVALID',
            'Plan ' + plan.id + ' must be in a later wave than ' + dependency + '.',
            'terrace parallel plan ' + phase.id,
            'Move the dependent plan to a later wave.'
          ));
        }
      }
    }
  } else {
    const assigned = new Map();
    let remaining = new Set(plans.map((plan) => plan.id));
    while (remaining.size > 0) {
      const ready = plans
        .filter((plan) => remaining.has(plan.id) && plan.depends_on.every((dependency) => assigned.has(dependency)))
        .sort((left, right) => left.id.localeCompare(right.id));
      if (ready.length === 0) {
        blockers.push(blocker(
          'PARALLEL_DEPENDENCY_CYCLE',
          'Parallel plan dependencies contain a cycle.',
          'terrace parallel plan ' + phase.id,
          'Break the cycle or use the sequential phase path.'
        ));
        break;
      }
      for (const plan of ready) {
        const dependencyWaves = plan.depends_on.map((dependency) => assigned.get(dependency) || 1);
        plan.wave = dependencyWaves.length > 0 ? Math.max(...dependencyWaves) + 1 : 1;
        assigned.set(plan.id, plan.wave);
        remaining.delete(plan.id);
      }
    }
  }

  const waves = unique(plans.map((plan) => plan.wave).filter((wave) => Number.isInteger(wave)))
    .sort((left, right) => left - right)
    .map((wave) => ({
      wave,
      plan_ids: plans.filter((plan) => plan.wave === wave).map((plan) => plan.id).sort()
    }));
  return { plans, waves, blockers };
}

function canonicalDirtyBlockers(cwd, phase) {
  const dirtyFiles = gitStatusFiles(cwd);
  if (dirtyFiles.length === 0) {
    return [];
  }
  return [blocker(
    'PARALLEL_CANONICAL_DIRTY',
    'The canonical worktree must be clean before starting isolated plan work.',
    'terrace phase execute ' + phase.id + ' --parallel',
    'Commit or otherwise resolve current canonical changes before creating worker worktrees.',
    { files: dirtyFiles }
  )];
}

function planPreview(cwd, phaseId) {
  const state = loadState(cwd);
  const phase = phaseFor(state, phaseId);
  const root = gitRoot(cwd);
  const built = buildPlanSpecs(cwd, phase);
  const dirtyBlockers = canonicalDirtyBlockers(cwd, phase);
  const blockers = [...built.blockers, ...dirtyBlockers];
  return {
    mode: 'worktree',
    phase_id: phase.id,
    base_commit: currentCommit(cwd),
    base_branch: currentBranch(cwd),
    canonical_root: root,
    canonical_clean: dirtyBlockers.length === 0,
    allowed: blockers.length === 0,
    plans: built.plans,
    waves: built.waves,
    blockers,
    next_command: blockers.length === 0
      ? 'terrace phase execute ' + phase.id + ' --parallel'
      : 'terrace phase execute ' + phase.id,
    sequential_fallback: 'terrace phase execute ' + phase.id
  };
}

function parallelRuns(state) {
  return Array.isArray(state.parallel_runs) ? state.parallel_runs : [];
}

function activeRunForPhase(state, phaseId) {
  return parallelRuns(state)
    .filter((run) => run.phase_id === phaseId && ACTIVE_RUN_STATUSES.has(run.status))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0] || null;
}

function findRun(state, target) {
  const runs = parallelRuns(state);
  const byId = runs.find((run) => run.id === target);
  if (byId) {
    return byId;
  }
  const matchingPhase = runs.filter((run) => run.phase_id === target).sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  if (matchingPhase.length > 0) {
    return matchingPhase[0];
  }
  throw new Error('Unknown parallel execution: ' + target);
}

function replaceRun(state, nextRun) {
  return {
    ...state,
    parallel_runs: parallelRuns(state).map((run) => run.id === nextRun.id ? nextRun : run)
  };
}

function stateWriterLockPath(cwd) {
  return path.resolve(cwd, '.terrace', 'parallel-writer.lock');
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function acquireStateWriter(cwd) {
  const lockPath = stateWriterLockPath(cwd);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx');
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, created_at: nowIso() }) + '\n');
    return { fd, lockPath };
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      let lock = null;
      try {
        lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
      } catch (readError) {
        lock = null;
      }
      if (!lock || !processIsAlive(Number(lock.pid))) {
        fs.rmSync(lockPath, { force: true });
        fd = fs.openSync(lockPath, 'wx');
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, created_at: nowIso() }) + '\n');
        return { fd, lockPath };
      }
      throw new Error('Parallel state writer is already active (pid ' + String(lock.pid) + ').');
    }
    throw error;
  }
}

function withStateWriter(cwd, action) {
  const lock = acquireStateWriter(cwd);
  try {
    return action();
  } finally {
    try {
      fs.closeSync(lock.fd);
    } finally {
      fs.rmSync(lock.lockPath, { force: true });
    }
  }
}

function appendParallelEvent(cwd, command, run, fromState, toState) {
  appendEvent(cwd, {
    command,
    from_state: fromState,
    to_state: toState,
    evidence_refs: ['.terrace/state.json'],
    parallel_run_id: run.id,
    phase_id: run.phase_id
  });
}

function runRootFor(cwd, runId) {
  const root = gitRoot(cwd);
  return path.resolve(root, '..', '.terrace-worktrees', safeToken(path.basename(root)), safeToken(runId));
}

function branchFor(run, plan) {
  return 'terrace/parallel/' + safeToken(run.phase_id) + '/' + safeToken(run.id) + '/' + safeToken(plan.id);
}

function worktreeFor(run, plan) {
  return path.resolve(run.worktree_root, safeToken(plan.id));
}

function createWorktree(cwd, run, plan, baseCommit) {
  const branch = branchFor(run, plan);
  const worktree = worktreeFor(run, plan);
  fs.mkdirSync(run.worktree_root, { recursive: true });
  if (fs.existsSync(worktree)) {
    throw new Error('Parallel worktree path already exists: ' + worktree);
  }
  git(cwd, ['worktree', 'add', '-b', branch, worktree, baseCommit]);
  return {
    ...plan,
    status: 'ready',
    branch,
    worktree,
    base_commit: baseCommit,
    started_at: nowIso()
  };
}

function prepareWave(cwd, run, plans, wave) {
  const baseCommit = currentCommit(cwd);
  const nextPlans = plans.map((plan) => ({ ...plan }));
  try {
    for (const plan of nextPlans) {
      if (plan.wave === wave && plan.status === 'pending') {
        const prepared = createWorktree(cwd, run, plan, baseCommit);
        Object.assign(plan, prepared);
      }
    }
    return { plans: nextPlans, baseCommit };
  } catch (error) {
    error.createdPlans = nextPlans.filter((plan) => plan.wave === wave && plan.status === 'ready');
    throw error;
  }
}

function updatePhaseExecution(state, run, status) {
  const phase = phaseFor(state, run.phase_id);
  const nextPhase = {
    ...phase,
    execution: {
      ...(phase.execution || {}),
      mode: 'parallel_worktree',
      parallel_run_id: run.id,
      parallel_status: status,
      waves: run.waves,
      queue: run.plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        wave: plan.wave,
        owned_files: plan.owned_files,
        depends_on: plan.depends_on,
        summary_ref: plan.summary_ref,
        worktree: plan.worktree,
        branch: plan.branch,
        status: plan.status
      }))
    },
    next_command: status === 'merged'
      ? 'terrace phase validate ' + run.phase_id
      : 'terrace parallel status ' + run.id
  };
  return {
    ...state,
    roadmap: {
      ...state.roadmap,
      phases: state.roadmap.phases.map((candidate) => candidate.id === run.phase_id ? nextPhase : candidate)
    }
  };
}

function persistRun(cwd, state, run, command, fromState, toState) {
  // A caller may have written the run immediately before reaching this
  // helper (parallel start does that while transitioning red_required to
  // preparing). Whole-file state writes require the current fingerprint, so
  // refresh the snapshot inside the writer boundary before persisting the
  // next transition.
  const currentState = loadState(cwd);
  const withRun = replaceRun(currentState, run);
  const nextState = updatePhaseExecution(withRun, run, toState || run.status);
  saveState(cwd, nextState);
  appendParallelEvent(cwd, command, run, fromState, toState || run.status);
  return nextState;
}

function parallelStart(cwd, phaseId) {
  const preview = planPreview(cwd, phaseId);
  const stateBefore = loadState(cwd);
  const existing = activeRunForPhase(stateBefore, phaseId);
  if (existing) {
    return {
      allowed: false,
      mode: 'worktree',
      phase_id: phaseId,
      run_id: existing.id,
      status: existing.status,
      blockers: [blocker(
        'PARALLEL_RUN_ALREADY_ACTIVE',
        'Phase ' + phaseId + ' already has parallel run ' + existing.id + '.',
        'terrace parallel status ' + existing.id,
        'Resume, merge, fail, or clean up the existing run before starting another one.'
      )],
      next_command: 'terrace parallel status ' + existing.id
    };
  }
  if (!preview.allowed) {
    return {
      ...preview,
      status: 'blocked',
      allowed: false
    };
  }

  const sequential = phaseExecute(cwd, phaseId);
  if (!sequential.allowed) {
    return {
      ...preview,
      allowed: false,
      status: 'blocked',
      blockers: sequential.blockers || [],
      required_action: sequential.required_action || 'Resolve Terrace phase gates before starting parallel worktrees.'
    };
  }

  const stateAfter = loadState(cwd);
  const phase = phaseFor(stateAfter, phaseId);
  const runId = 'parallel-' + safeToken(phaseId) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const worktreeRoot = runRootFor(cwd, runId);
  const baseCommit = currentCommit(cwd);
  const run = {
    id: runId,
    phase_id: phase.id,
    mode: 'worktree',
    status: 'preparing',
    canonical_root: gitRoot(cwd),
    base_commit: baseCommit,
    base_branch: currentBranch(cwd),
    worktree_root: worktreeRoot,
    created_at: nowIso(),
    updated_at: nowIso(),
    current_wave: 1,
    waves: preview.waves,
    plans: preview.plans,
    merged_plan_ids: [],
    failure: null,
    cleanup: null
  };

  return withStateWriter(cwd, () => {
    let workingRun = run;
    let workingState = {
      ...stateAfter,
      parallel_runs: [...parallelRuns(stateAfter), workingRun]
    };
    saveState(cwd, updatePhaseExecution(workingState, workingRun, 'preparing'));
    appendParallelEvent(cwd, 'terrace phase execute ' + phaseId + ' --parallel', workingRun, 'red_required', 'preparing');
    try {
      const prepared = prepareWave(cwd, workingRun, workingRun.plans, 1);
      workingRun = {
        ...workingRun,
        plans: prepared.plans,
        status: 'running',
        updated_at: nowIso()
      };
      workingState = persistRun(cwd, workingState, workingRun, 'terrace phase execute ' + phaseId + ' --parallel', 'preparing', 'running');
      return {
        allowed: true,
        mode: 'worktree',
        status: 'running',
        phase_id: phaseId,
        run_id: workingRun.id,
        base_commit: workingRun.base_commit,
        waves: workingRun.waves,
        plans: workingRun.plans,
        worktree_root: workingRun.worktree_root,
        next_command: 'terrace parallel status ' + workingRun.id,
        instructions: 'Run each ready plan in its worktree, commit the implementation and its SUMMARY.md, then run terrace parallel merge ' + workingRun.id + '.'
      };
    } catch (error) {
      const failure = blocker(
        'PARALLEL_WORKTREE_CREATE_FAILED',
        error && error.message ? error.message : String(error),
        'terrace parallel resume ' + workingRun.id,
        'Inspect the recorded worktree paths, then resume or clean up the run explicitly.'
      );
      const createdPlans = Array.isArray(error.createdPlans) ? error.createdPlans : workingRun.plans;
      for (const plan of createdPlans) {
        if (plan.worktree || plan.branch) {
          try {
            removePlanWorktree(cwd, plan, { force: false, preserveBranch: false });
          } catch (cleanupError) {
            failure.cleanup_error = cleanupError && cleanupError.message ? cleanupError.message : String(cleanupError);
          }
        }
      }
      workingRun = {
        ...workingRun,
        plans: workingRun.plans.map((plan) => createdPlans.find((created) => created.id === plan.id) || plan),
        status: 'failed',
        failure,
        updated_at: nowIso()
      };
      persistRun(cwd, workingState, workingRun, 'terrace phase execute ' + phaseId + ' --parallel', 'preparing', 'failed');
      return {
        allowed: false,
        mode: 'worktree',
        status: 'failed',
        phase_id: phaseId,
        run_id: workingRun.id,
        blockers: [failure],
        next_command: 'terrace parallel cleanup ' + workingRun.id
      };
    }
  });
}

function branchExists(cwd, branch) {
  return gitTry(cwd, ['show-ref', '--verify', '--quiet', 'refs/heads/' + branch]).ok;
}

function worktreeEntries(cwd) {
  const output = gitTry(cwd, ['worktree', 'list', '--porcelain']);
  if (!output.ok || !output.value) {
    return [];
  }
  const entries = [];
  let current = null;
  for (const line of output.value.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) {
        entries.push(current);
      }
      current = { path: line.slice('worktree '.length), branch: null };
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    }
  }
  if (current) {
    entries.push(current);
  }
  return entries;
}

function inspectPlan(cwd, run, plan) {
  if (plan.status === 'pending') {
    return { plan_id: plan.id, status: 'pending', ready: false, blockers: [] };
  }
  if (plan.status === 'merged' || plan.status === 'cleaned') {
    return { plan_id: plan.id, status: plan.status, ready: plan.status === 'merged', blockers: [], commit: plan.commit };
  }
  const blockers = [];
  const worktree = plan.worktree;
  const branch = plan.branch;
  if (!branch || !branchExists(cwd, branch)) {
    blockers.push(blocker(
      'PARALLEL_BRANCH_MISSING',
      'Plan ' + plan.id + ' has no recorded worker branch.',
      'terrace parallel resume ' + run.id,
      'Resume the run to reattach a recoverable worktree or mark the plan failed.'
    ));
  }
  if (!worktree || !fs.existsSync(worktree)) {
    blockers.push(blocker(
      'PARALLEL_WORKTREE_MISSING',
      'Plan ' + plan.id + ' worktree is missing: ' + String(worktree),
      'terrace parallel resume ' + run.id,
      'Restore the worktree from its branch or clean up the interrupted run.'
    ));
  }
  if (blockers.length > 0) {
    return { plan_id: plan.id, status: 'interrupted', ready: false, blockers };
  }
  const cleanFiles = gitStatusFiles(worktree);
  if (cleanFiles.length > 0) {
    blockers.push(blocker(
      'PARALLEL_UNCOMMITTED_WORK',
      'Plan ' + plan.id + ' has uncommitted work in its isolated worktree.',
      'terrace parallel status ' + run.id,
      'Commit the implementation and SUMMARY.md in the worker worktree before merging.',
      { files: cleanFiles }
    ));
  }
  const tipResult = gitTry(cwd, ['rev-parse', branch]);
  const tip = tipResult.ok ? tipResult.value : null;
  const workerHeadResult = gitTry(worktree, ['rev-parse', 'HEAD']);
  const workerHead = workerHeadResult.ok ? workerHeadResult.value : null;
  if (!workerHead) {
    blockers.push(blocker(
      'PARALLEL_WORKTREE_HEAD_MISSING',
      'Plan ' + plan.id + ' worktree has no readable HEAD.',
      'terrace parallel resume ' + run.id,
      'Reattach the worktree from its recorded branch before merging.'
    ));
  } else if (tip && workerHead !== tip) {
    blockers.push(blocker(
      'PARALLEL_WORKTREE_HEAD_MISMATCH',
      'Plan ' + plan.id + ' worktree HEAD does not match its recorded branch tip.',
      'terrace parallel resume ' + run.id,
      'Reattach the recorded branch and inspect the worker worktree before merging.',
      { branch_tip: tip, worktree_head: workerHead }
    ));
  }
  const baseCommit = plan.base_commit || run.base_commit;
  if (!tip) {
    blockers.push(blocker(
      'PARALLEL_COMMIT_MISSING',
      'Plan ' + plan.id + ' has no readable branch tip.',
      'terrace parallel resume ' + run.id,
      'Commit the plan in its worktree and retry status.'
    ));
  }
  if (tip && !gitTry(cwd, ['merge-base', '--is-ancestor', baseCommit, tip]).ok) {
    blockers.push(blocker(
      'PARALLEL_BRANCH_BASE_CHANGED',
      'Plan ' + plan.id + ' is no longer based on its recorded wave base commit.',
      'terrace parallel resume ' + run.id,
      'Recreate or rebase the plan worktree through Terrace so wave ordering remains explicit.'
    ));
  }
  const countResult = gitTry(cwd, ['rev-list', '--count', baseCommit + '..' + branch]);
  const commitCount = countResult.ok ? Number(countResult.value) : 0;
  if (commitCount < 1) {
    blockers.push(blocker(
      'PARALLEL_COMMIT_REQUIRED',
      'Plan ' + plan.id + ' has no commit after its wave base.',
      'terrace parallel status ' + run.id,
      'Commit the implementation and plan summary before requesting a merge.'
    ));
  }
  const changedFilesResult = gitTry(cwd, ['diff', '--name-only', baseCommit + '..' + branch]);
  const changedFiles = changedFilesResult.ok && changedFilesResult.value
    ? changedFilesResult.value.split(/\r?\n/).filter(Boolean).map((filePath) => filePath.split(path.sep).join('/'))
    : [];
  const summaryChanged = changedFiles.includes(plan.summary_ref);
  let summaryContent = '';
  if (tip) {
    const summaryResult = gitTry(cwd, ['show', branch + ':' + plan.summary_ref]);
    summaryContent = summaryResult.ok ? summaryResult.value : '';
  }
  if (!summaryChanged || !summaryContent.trim()) {
    blockers.push(blocker(
      'PARALLEL_SUMMARY_REQUIRED',
      'Plan ' + plan.id + ' must commit a non-empty ' + plan.summary_ref + '.',
      'terrace parallel status ' + run.id,
      'Add a plan-specific SUMMARY.md in the worker worktree and commit it with the implementation.'
    ));
  }
  const reservedFiles = changedFiles.filter((filePath) => isReservedWorkerPath(filePath, run.phase_id, plan.id));
  if (reservedFiles.length > 0) {
    blockers.push(blocker(
      'PARALLEL_SINGLE_WRITER_VIOLATION',
      'Plan ' + plan.id + ' changed canonical state or roadmap files.',
      'terrace parallel status ' + run.id,
      'Revert state/roadmap changes from the worker branch; the canonical Terrace worktree is the only state writer.',
      { files: reservedFiles }
    ));
  }
  const expectedFiles = [...plan.owned_files, plan.summary_ref];
  const unownedFiles = changedFiles.filter((filePath) => !expectedFiles.some((expected) => pathOverlaps(filePath, expected)));
  if (unownedFiles.length > 0) {
    blockers.push(blocker(
      'PARALLEL_UNOWNED_CHANGE',
      'Plan ' + plan.id + ' changed files outside its declared ownership.',
      'terrace parallel status ' + run.id,
      'Update plan ownership and restart the parallel run, or use the sequential phase path.',
      { files: unownedFiles }
    ));
  }
  return {
    plan_id: plan.id,
    status: blockers.length === 0 ? 'ready_to_merge' : 'blocked',
    ready: blockers.length === 0,
    blockers,
    branch,
    worktree,
    base_commit: baseCommit,
    commit: tip,
    commit_count: commitCount,
    changed_files: changedFiles,
    summary_ref: plan.summary_ref,
    summary_present: Boolean(summaryContent.trim()),
    uncommitted_files: cleanFiles
  };
}

function currentWavePlans(run) {
  return run.plans.filter((plan) => plan.wave === run.current_wave && plan.status !== 'merged' && plan.status !== 'cleaned');
}

function canonicalMergeBlockers(cwd, run) {
  const dirtyFiles = gitStatusFiles(cwd);
  const allowed = new Set(INTERNAL_CANONICAL_FILES);
  const phase = run.plans.length > 0 ? 'docs/terrace/phases/' + safeToken(run.phase_id) + '/' : '';
  if (phase) {
    allowed.add(phase + 'PLAN.md');
    allowed.add(phase + 'EXECUTION.md');
  }
  const unexpected = dirtyFiles.filter((filePath) => !allowed.has(filePath));
  if (unexpected.length === 0) {
    return [];
  }
  return [blocker(
    'PARALLEL_CANONICAL_DIRTY',
    'The canonical worktree has changes outside Terrace-managed run metadata.',
    'terrace parallel merge ' + run.id,
    'Commit or resolve unrelated canonical changes before merging worker branches.',
    { files: unexpected }
  )];
}

function parallelStatus(cwd, target) {
  const state = loadState(cwd);
  const run = findRun(state, target);
  const inspections = currentWavePlans(run).map((plan) => ({ ...inspectPlan(cwd, run, plan), run_id: run.id }));
  const blockers = inspections.flatMap((inspection) => inspection.blockers || []);
  const allReady = inspections.length > 0 && inspections.every((inspection) => inspection.ready);
  return {
    mode: 'worktree',
    phase_id: run.phase_id,
    run_id: run.id,
    status: run.status,
    current_wave: run.current_wave,
    waves: run.waves,
    plans: run.plans,
    inspections,
    blockers,
    ready_to_merge: allReady,
    recoverable: run.status === 'interrupted' || blockers.some((item) => item.code === 'PARALLEL_WORKTREE_MISSING'),
    next_command: allReady
      ? 'terrace parallel merge ' + run.id
      : run.status === 'merged'
        ? 'terrace phase validate ' + run.phase_id
        : 'terrace parallel resume ' + run.id
  };
}

function parallelResume(cwd, target) {
  return withStateWriter(cwd, () => {
    const state = loadState(cwd);
    const run = findRun(state, target);
    if (run.status === 'merged' || run.status === 'cleaned') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: run.status,
        allowed: false,
        blockers: [blocker(
          'PARALLEL_RUN_NOT_RECOVERABLE',
          'Parallel run ' + run.id + ' is already ' + run.status + '.',
          run.status === 'merged' ? 'terrace phase validate ' + run.phase_id : 'terrace phase execute ' + run.phase_id,
          'Start a new run only after the existing run has reached its terminal state.'
        )],
        next_command: run.status === 'merged' ? 'terrace phase validate ' + run.phase_id : 'terrace phase execute ' + run.phase_id
      };
    }
    if (run.status === 'failed' || run.plans.some((plan) => plan.status === 'failed')) {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: 'failed',
        allowed: false,
        blockers: [blocker(
          'PARALLEL_FAILED_RUN',
          'Parallel run ' + run.id + ' has an explicitly failed plan and cannot be revived by resume.',
          'terrace parallel cleanup ' + run.id,
          'Inspect the preserved worker branch, clean up the run, then use the sequential phase fallback.'
        )],
        next_command: 'terrace parallel cleanup ' + run.id
      };
    }
    const entries = worktreeEntries(cwd);
    const byBranch = new Map(entries.filter((entry) => entry.branch).map((entry) => [entry.branch, entry.path]));
    let nextRun = { ...run, plans: run.plans.map((plan) => ({ ...plan })) };
    const blockers = [];
    for (const plan of nextRun.plans) {
      if (plan.status === 'merged' || plan.status === 'cleaned' || plan.status === 'pending') {
        continue;
      }
      const branch = plan.branch || branchFor(nextRun, plan);
      const registeredPath = byBranch.get(branch);
      if (!plan.worktree && registeredPath) {
        plan.branch = branch;
        plan.worktree = registeredPath;
      } else if (plan.branch && branchExists(cwd, plan.branch) && (!plan.worktree || !fs.existsSync(plan.worktree))) {
        const restoredPath = worktreeFor(nextRun, plan);
        try {
          fs.mkdirSync(nextRun.worktree_root, { recursive: true });
          git(cwd, ['worktree', 'add', restoredPath, plan.branch]);
          plan.worktree = restoredPath;
        } catch (error) {
          blockers.push(blocker(
            'PARALLEL_WORKTREE_REATTACH_FAILED',
            error && error.message ? error.message : String(error),
            'terrace parallel cleanup ' + nextRun.id,
            'Inspect the branch and worktree list before retrying recovery.'
          ));
        }
      }
      if (!plan.branch || !branchExists(cwd, plan.branch) || !plan.worktree || !fs.existsSync(plan.worktree)) {
        blockers.push(blocker(
          'PARALLEL_RECOVERY_INCOMPLETE',
          'Plan ' + plan.id + ' cannot be reattached to a worker worktree.',
          'terrace parallel cleanup ' + nextRun.id,
          'Preserve or remove the incomplete run explicitly before using the sequential fallback.'
        ));
      }
      if (plan.worktree && fs.existsSync(plan.worktree)) {
        plan.status = 'ready';
      }
    }
    nextRun.status = blockers.length === 0
      ? (nextRun.status === 'merge_blocked' ? 'merge_blocked' : 'running')
      : 'interrupted';
    nextRun.failure = blockers.length > 0 ? { code: 'PARALLEL_RECOVERY_INCOMPLETE', blockers } : nextRun.failure;
    nextRun.updated_at = nowIso();
    const nextState = persistRun(cwd, state, nextRun, 'terrace parallel resume ' + nextRun.id, run.status, nextRun.status);
    return {
      mode: 'worktree',
      phase_id: nextRun.phase_id,
      run_id: nextRun.id,
      status: nextRun.status,
      allowed: blockers.length === 0,
      blockers,
      plans: nextRun.plans,
      next_command: blockers.length === 0 ? 'terrace parallel status ' + nextRun.id : 'terrace parallel cleanup ' + nextRun.id,
      state_path: relativePath(cwd, path.resolve(cwd, '.terrace', 'state.json')),
      persisted: Boolean(nextState)
    };
  });
}

function mergeOnePlan(cwd, run, plan) {
  const message = 'Terrace parallel merge: ' + plan.id + ' (' + run.id + ')';
  git(cwd, ['merge', '--no-ff', '--no-edit', '-m', message, plan.branch]);
  return currentCommit(cwd);
}

function mergeConflictBlocker(cwd, run, plan, error) {
  const conflictsResult = gitTry(cwd, ['diff', '--name-only', '--diff-filter=U']);
  const conflicts = conflictsResult.ok && conflictsResult.value ? conflictsResult.value.split(/\r?\n/).filter(Boolean) : [];
  gitTry(cwd, ['merge', '--abort']);
  return blocker(
    'PARALLEL_MERGE_CONFLICT',
    'Deterministic merge of plan ' + plan.id + ' failed: ' + (error && error.message ? error.message : String(error)),
    'terrace parallel resume ' + run.id,
    'Resolve the worker ownership conflict or use the sequential phase path; worker worktrees remain available for inspection.',
    { files: conflicts }
  );
}

function parallelMerge(cwd, target) {
  return withStateWriter(cwd, () => {
    const state = loadState(cwd);
    const run = findRun(state, target);
    if (run.status === 'merged') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: 'merged',
        allowed: true,
        next_command: 'terrace phase validate ' + run.phase_id,
        plans: run.plans
      };
    }
    if (!MERGEABLE_RUN_STATUSES.has(run.status) && run.status !== 'preparing') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: run.status,
        allowed: false,
        blockers: [blocker(
          'PARALLEL_RUN_NOT_MERGEABLE',
          'Parallel run ' + run.id + ' is not ready for merge.',
          'terrace parallel status ' + run.id,
          'Resume the run or clean it up before choosing another execution path.'
        )],
        next_command: 'terrace parallel status ' + run.id
      };
    }
    const canonicalBlockers = canonicalMergeBlockers(cwd, run);
    const currentPlans = currentWavePlans(run);
    const inspections = currentPlans.map((plan) => inspectPlan(cwd, run, plan));
    const blockers = [...canonicalBlockers, ...inspections.flatMap((inspection) => inspection.blockers || [])];
    if (blockers.length === 0) {
      for (let leftIndex = 0; leftIndex < inspections.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < inspections.length; rightIndex += 1) {
          const leftFiles = (inspections[leftIndex].changed_files || []).filter((filePath) => filePath !== inspections[leftIndex].summary_ref);
          const rightFiles = (inspections[rightIndex].changed_files || []).filter((filePath) => filePath !== inspections[rightIndex].summary_ref);
          const overlap = leftFiles.flatMap((leftFile) => rightFiles.filter((rightFile) => pathOverlaps(leftFile, rightFile)));
          if (overlap.length > 0) {
            blockers.push(blocker(
              'PARALLEL_ACTUAL_FILE_OVERLAP',
              'Worker commits for ' + inspections[leftIndex].plan_id + ' and ' + inspections[rightIndex].plan_id + ' overlap: ' + unique(overlap).join(', '),
              'terrace parallel status ' + run.id,
              'Keep overlapping work on the sequential path; no worker commit was merged.',
              { files: unique(overlap) }
            ));
          }
        }
      }
    }
    if (blockers.length > 0) {
      const nextRun = {
        ...run,
        status: blockers.some((item) => item.code === 'PARALLEL_MERGE_CONFLICT') ? 'merge_blocked' : run.status,
        failure: blockers.some((item) => item.code === 'PARALLEL_ACTUAL_FILE_OVERLAP') ? { code: 'PARALLEL_ACTUAL_FILE_OVERLAP', blockers } : run.failure,
        updated_at: nowIso()
      };
      if (nextRun.status !== run.status || nextRun.failure) {
        persistRun(cwd, state, nextRun, 'terrace parallel merge ' + run.id, run.status, nextRun.status);
      }
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: nextRun.status,
        allowed: false,
        blockers,
        inspections,
        next_command: 'terrace parallel status ' + run.id
      };
    }

    let workingRun = {
      ...run,
      plans: run.plans.map((plan) => ({ ...plan })),
      merged_plan_ids: [...(run.merged_plan_ids || [])],
      status: 'merging',
      updated_at: nowIso()
    };
    let workingState = state;
    for (const plan of currentPlans.sort((left, right) => left.id.localeCompare(right.id))) {
      const currentPlan = workingRun.plans.find((candidate) => candidate.id === plan.id);
      try {
        const mergeCommit = mergeOnePlan(cwd, workingRun, currentPlan);
        currentPlan.status = 'merged';
        currentPlan.commit = mergeCommit;
        currentPlan.merged_at = nowIso();
        workingRun.merged_plan_ids.push(currentPlan.id);
        workingState = persistRun(cwd, workingState, workingRun, 'terrace parallel merge ' + workingRun.id, 'merging', 'merging');
      } catch (error) {
        const failure = mergeConflictBlocker(cwd, workingRun, currentPlan, error);
        workingRun = {
          ...workingRun,
          status: 'merge_blocked',
          failure,
          updated_at: nowIso()
        };
        persistRun(cwd, workingState, workingRun, 'terrace parallel merge ' + workingRun.id, 'merging', 'merge_blocked');
        return {
          mode: 'worktree',
          phase_id: workingRun.phase_id,
          run_id: workingRun.id,
          status: 'merge_blocked',
          allowed: false,
          blockers: [failure],
          merged_plan_ids: workingRun.merged_plan_ids,
          next_command: 'terrace parallel resume ' + workingRun.id
        };
      }
    }

    const nextWave = workingRun.waves.find((entry) => entry.wave > workingRun.current_wave);
    if (nextWave) {
      try {
        const prepared = prepareWave(cwd, workingRun, workingRun.plans, nextWave.wave);
        workingRun = {
          ...workingRun,
          plans: prepared.plans,
          current_wave: nextWave.wave,
          status: 'running',
          updated_at: nowIso()
        };
        persistRun(cwd, workingState, workingRun, 'terrace parallel merge ' + workingRun.id, 'merging', 'running');
        return {
          mode: 'worktree',
          phase_id: workingRun.phase_id,
          run_id: workingRun.id,
          status: 'running',
          allowed: true,
          merged_plan_ids: workingRun.merged_plan_ids,
          current_wave: workingRun.current_wave,
          waves: workingRun.waves,
          plans: workingRun.plans,
          next_command: 'terrace parallel status ' + workingRun.id
        };
      } catch (error) {
        const failure = blocker(
          'PARALLEL_NEXT_WAVE_FAILED',
          error && error.message ? error.message : String(error),
          'terrace parallel resume ' + workingRun.id,
          'Inspect the merged wave and restore the next wave worktree before continuing.'
        );
        workingRun = { ...workingRun, status: 'interrupted', failure, updated_at: nowIso() };
        persistRun(cwd, workingState, workingRun, 'terrace parallel merge ' + workingRun.id, 'merging', 'interrupted');
        return {
          mode: 'worktree',
          phase_id: workingRun.phase_id,
          run_id: workingRun.id,
          status: 'interrupted',
          allowed: false,
          blockers: [failure],
          next_command: 'terrace parallel resume ' + workingRun.id
        };
      }
    }

    workingRun = {
      ...workingRun,
      status: 'merged',
      merged_at: nowIso(),
      updated_at: nowIso(),
      failure: null
    };
    persistRun(cwd, workingState, workingRun, 'terrace parallel merge ' + workingRun.id, 'merging', 'merged');
    return {
      mode: 'worktree',
      phase_id: workingRun.phase_id,
      run_id: workingRun.id,
      status: 'merged',
      allowed: true,
      merged_plan_ids: workingRun.merged_plan_ids,
      plans: workingRun.plans,
      next_command: 'terrace phase validate ' + workingRun.phase_id
    };
  });
}

function removePlanWorktree(cwd, plan, options) {
  const opts = options || {};
  if (plan.worktree && fs.existsSync(plan.worktree)) {
    const args = ['worktree', 'remove'];
    if (opts.force) {
      args.push('--force');
    }
    args.push(plan.worktree);
    git(cwd, args);
  }
  if (plan.branch && branchExists(cwd, plan.branch) && !opts.preserveBranch) {
    const branchArgs = ['branch', opts.force ? '-D' : '-d', plan.branch];
    git(cwd, branchArgs);
  }
  return true;
}

function parallelCleanup(cwd, target, options) {
  const opts = options || {};
  return withStateWriter(cwd, () => {
    const state = loadState(cwd);
    const run = findRun(state, target);
    if (run.status === 'running' || run.status === 'preparing' || run.status === 'merging') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: run.status,
        allowed: false,
        blockers: [blocker(
          'PARALLEL_CLEANUP_REQUIRES_STOP',
          'Run ' + run.id + ' is still active.',
          'terrace parallel status ' + run.id,
          'Merge the ready wave or mark the failed plan before removing worker worktrees.'
        )],
        next_command: 'terrace parallel status ' + run.id
      };
    }
    const failures = [];
    const preservedBranches = [];
    const nextPlans = run.plans.map((plan) => {
      if (!plan.worktree && !plan.branch) {
        return { ...plan, status: 'cleaned' };
      }
      try {
        const preserveBranch = run.status !== 'merged' && !opts.force;
        removePlanWorktree(cwd, plan, { force: Boolean(opts.force), preserveBranch });
        if (preserveBranch && plan.branch && branchExists(cwd, plan.branch)) {
          preservedBranches.push(plan.branch);
        }
        return { ...plan, status: 'cleaned', worktree: null };
      } catch (error) {
        failures.push(blocker(
          'PARALLEL_CLEANUP_FAILED',
          'Could not clean plan ' + plan.id + ': ' + (error && error.message ? error.message : String(error)),
          'terrace parallel cleanup ' + run.id + ' --force',
          'Commit or inspect uncommitted worker changes before retrying cleanup.'
        ));
        return plan;
      }
    });
    const nextRun = {
      ...run,
      plans: nextPlans,
      status: failures.length === 0 ? 'cleaned' : 'cleanup_blocked',
      cleanup: {
        forced: Boolean(opts.force),
        preserved_branches: preservedBranches,
        failures,
        completed_at: failures.length === 0 ? nowIso() : null
      },
      updated_at: nowIso()
    };
    const nextState = persistRun(cwd, state, nextRun, 'terrace parallel cleanup ' + run.id, run.status, nextRun.status);
    if (nextRun.status === 'cleaned' && fs.existsSync(run.worktree_root)) {
      try {
        fs.rmdirSync(run.worktree_root);
      } catch (error) {
        return {
          mode: 'worktree',
          phase_id: run.phase_id,
          run_id: run.id,
          status: 'cleaned',
          allowed: true,
          cleanup: nextRun.cleanup,
          warning: 'Worktree root was retained because it is not empty: ' + run.worktree_root,
          next_command: run.failure ? 'terrace phase execute ' + run.phase_id : 'terrace phase validate ' + run.phase_id,
          persisted: Boolean(nextState)
        };
      }
    }
    return {
      mode: 'worktree',
      phase_id: run.phase_id,
      run_id: run.id,
      status: nextRun.status,
      allowed: failures.length === 0,
      cleanup: nextRun.cleanup,
      blockers: failures,
      next_command: failures.length > 0
        ? 'terrace parallel cleanup ' + run.id + ' --force'
        : run.failure
          ? 'terrace phase execute ' + run.phase_id
          : 'terrace phase validate ' + run.phase_id
    };
  });
}

function parallelFail(cwd, target, planId, reason) {
  return withStateWriter(cwd, () => {
    const state = loadState(cwd);
    const run = findRun(state, target);
    if (run.status === 'merged' || run.status === 'cleaned') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: run.status,
        allowed: false,
        blockers: [blocker(
          'PARALLEL_RUN_TERMINAL',
          'Parallel run ' + run.id + ' is already ' + run.status + ' and cannot accept a failed plan.',
          run.status === 'merged' ? 'terrace phase validate ' + run.phase_id : 'terrace phase execute ' + run.phase_id,
          'Use the terminal run evidence instead of changing its plan status.'
        )],
        next_command: run.status === 'merged' ? 'terrace phase validate ' + run.phase_id : 'terrace phase execute ' + run.phase_id
      };
    }
    const plan = run.plans.find((candidate) => candidate.id === planId);
    if (!plan) {
      throw new Error('Unknown plan in parallel execution: ' + planId);
    }
    if (plan.status === 'merged' || plan.status === 'cleaned') {
      return {
        mode: 'worktree',
        phase_id: run.phase_id,
        run_id: run.id,
        status: run.status,
        allowed: false,
        blockers: [blocker(
          'PARALLEL_PLAN_TERMINAL',
          'Plan ' + planId + ' is already ' + plan.status + ' and cannot be marked failed.',
          'terrace parallel status ' + run.id,
          'Use the recorded plan evidence instead of changing its terminal status.'
        )],
        next_command: 'terrace parallel status ' + run.id
      };
    }
    const failure = blocker(
      'PARALLEL_PLAN_FAILED',
      'Plan ' + planId + ' was marked failed: ' + (reason || 'No reason supplied.'),
      'terrace parallel cleanup ' + run.id,
      'Inspect the preserved worker branch, then clean up or choose the sequential phase fallback.'
    );
    const nextRun = {
      ...run,
      status: 'failed',
      failure,
      plans: run.plans.map((candidate) => candidate.id === planId ? { ...candidate, status: 'failed', failure } : candidate),
      updated_at: nowIso()
    };
    persistRun(cwd, state, nextRun, 'terrace parallel fail ' + run.id + ' ' + planId, run.status, 'failed');
    return {
      mode: 'worktree',
      phase_id: run.phase_id,
      run_id: run.id,
      status: 'failed',
      allowed: false,
      blockers: [failure],
      next_command: 'terrace parallel cleanup ' + run.id,
      sequential_fallback: 'terrace phase execute ' + run.phase_id
    };
  });
}

function parallelRunGate(state, phaseId) {
  const run = parallelRuns(state)
    .filter((candidate) => candidate.phase_id === phaseId)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
  if (!run || run.status === 'cleaned' || run.status === 'merged') {
    return null;
  }
  return blocker(
    run.status === 'failed' ? 'PARALLEL_RUN_FAILED' : 'PARALLEL_MERGE_REQUIRED',
    run.status === 'failed'
      ? 'Parallel run ' + run.id + ' failed and must be cleaned up before continuing.'
      : 'Parallel run ' + run.id + ' must be recovered and merged before phase workflow can continue.',
    run.status === 'failed' ? 'terrace parallel cleanup ' + run.id : 'terrace parallel status ' + run.id,
    run.status === 'failed'
      ? 'Use the preserved branch for inspection, clean up the run, then continue with the sequential phase path.'
      : 'Commit each worker SUMMARY.md, recover interrupted worktrees, and run the deterministic merge command.'
  );
}

module.exports = {
  parallelPlan: planPreview,
  parallelStart,
  parallelStatus,
  parallelResume,
  parallelMerge,
  parallelFail,
  parallelCleanup,
  parallelRunGate
};
