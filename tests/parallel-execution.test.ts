import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  saveState,
  parallelPlan,
  parallelStart,
  parallelStatus,
  parallelResume,
  parallelMerge,
  parallelFail,
  parallelCleanup,
  phaseValidate
} = require('../packages/terrace-core/src/index.cjs');
const CLI_PATH = path.resolve(__dirname, '../src/terrace-tools.cjs');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

function commit(cwd: string, message: string): void {
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-m', message]);
}

function phaseState(plans: Array<Record<string, unknown>>): ReturnType<typeof createDefaultState> {
  const state = createDefaultState({ projectName: 'parallel-test' });
  state.roadmap.phases = [{
    id: 'phase-parallel',
    title: 'Phase Parallel: Isolated Plans',
    status: 'planned',
    source_ref: 'roadmap.md',
    plans
  }];
  return state;
}

function prepareRepo(plans: Array<Record<string, unknown>>): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-parallel-'));
  git(tmpDir, ['init', '-q']);
  git(tmpDir, ['config', 'core.hooksPath', '/dev/null']);
  git(tmpDir, ['config', 'user.email', 'terrace-tests@example.com']);
  git(tmpDir, ['config', 'user.name', 'Terrace Tests']);
  fs.writeFileSync(path.join(tmpDir, '.pre-cr.json'), JSON.stringify({ version: 1, testCommand: 'node scripts/test.js', coveragePaths: ['coverage/lcov.info'], coverageFormat: 'lcov', threshold: 0, checks: { coverage: true, security: false, checklist: false } }) + '\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'parallel-fixture', scripts: { test: 'node scripts/test.js' } }) + '\n', 'utf8');
  fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'scripts', 'test.js'), [
    "const fs = require('fs');",
    "fs.mkdirSync('coverage', { recursive: true });",
    "fs.writeFileSync('coverage/lcov.info', ['TN:', 'SF:src/one.js', 'DA:1,1', 'end_of_record', 'SF:src/two.js', 'DA:1,1', 'end_of_record', ''].join('\\n'));"
  ].join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'coverage/\n', 'utf8');
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'one.js'), 'export const one = "base";\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'src', 'two.js'), 'export const two = "base";\n', 'utf8');
  fs.mkdirSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'phase-parallel'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'phase-parallel', 'ALIGNMENT.md'), '# Alignment\n', 'utf8');
  fs.mkdirSync(path.join(tmpDir, 'docs', 'testing'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'docs', 'testing', 'TEST-PLAN.md'), '# Test Plan\n', 'utf8');
  const state = phaseState(plans);
  saveState(tmpDir, state);
  commit(tmpDir, 'Create parallel execution fixture');
  return tmpDir;
}

function writeAndCommit(worktree: string, planId: string, filePath: string, content: string): void {
  const summaryPath = path.join(worktree, 'docs', 'terrace', 'phases', 'phase-parallel', 'plans', planId, 'SUMMARY.md');
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(path.join(worktree, filePath), content, 'utf8');
  fs.writeFileSync(summaryPath, '# Summary: ' + planId + '\n\n- Verification: committed fixture change.\n', 'utf8');
  commit(worktree, 'Implement plan ' + planId);
}

describe('Terrace parallel worktree execution', () => {
  const activeRuns: Array<{ cwd: string; id: string }> = [];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = '';
  });

  afterEach(() => {
    for (const run of activeRuns.splice(0)) {
      try {
        parallelCleanup(run.cwd, run.id, { force: true });
      } catch (error) {
        // The fixture directory is removed below even when a test intentionally leaves a failed run.
      }
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(path.resolve(tmpDir, '..', '.terrace-worktrees'), { recursive: true, force: true });
    }
  });

  it('fails closed on missing ownership and overlapping plan files', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/shared.js'] },
      { id: 'two', title: 'Two', files: ['src/shared.js'] },
      { id: 'three', title: 'Three' },
      { id: 'bad-path', title: 'Bad Path', files: ['src/../src/bad.js'] }
    ]);

    const result = parallelPlan(tmpDir, 'phase-parallel');
    const cliResult = JSON.parse(execFileSync('node', [CLI_PATH, 'parallel', 'plan', 'phase-parallel', '--json'], { cwd: tmpDir, encoding: 'utf8' }));

    expect(result.allowed).toBe(false);
    expect(cliResult).toMatchObject({ mode: 'worktree', phase_id: 'phase-parallel', allowed: false });
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'PARALLEL_FILE_OVERLAP' }),
      expect.objectContaining({ code: 'PARALLEL_FILE_OWNERSHIP_REQUIRED' }),
      expect.objectContaining({ code: 'PARALLEL_PLAN_FILE_PATH_INVALID' })
    ]));
  });

  it('creates isolated worktrees, verifies summaries, merges deterministically, and cleans up', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/one.js'] },
      { id: 'two', title: 'Two', files: ['src/two.js'] }
    ]);

    const preview = parallelPlan(tmpDir, 'phase-parallel');
    expect(preview).toMatchObject({ allowed: true, waves: [{ wave: 1, plan_ids: ['one', 'two'] }] });

    const started = parallelStart(tmpDir, 'phase-parallel');
    activeRuns.push({ cwd: tmpDir, id: started.run_id });
    expect(started).toMatchObject({ allowed: true, status: 'running', mode: 'worktree' });
    expect(started.plans).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'one', status: 'ready', worktree: expect.any(String), branch: expect.any(String) }),
      expect.objectContaining({ id: 'two', status: 'ready', worktree: expect.any(String), branch: expect.any(String) })
    ]));

    for (const plan of started.plans) {
    writeAndCommit(plan.worktree, plan.id, 'src/' + plan.id + '.js', 'export const ' + plan.id + ' = "worker";\n');
    }

    expect(parallelStatus(tmpDir, started.run_id)).toMatchObject({
      ready_to_merge: true,
      inspections: [
        expect.objectContaining({ plan_id: 'one', status: 'ready_to_merge', summary_present: true }),
        expect.objectContaining({ plan_id: 'two', status: 'ready_to_merge', summary_present: true })
      ]
    });

    const merged = parallelMerge(tmpDir, started.run_id);
    expect(merged).toMatchObject({ status: 'merged', allowed: true, merged_plan_ids: ['one', 'two'] });
    expect(fs.readFileSync(path.join(tmpDir, 'src', 'one.js'), 'utf8')).toContain('worker');
    expect(fs.readFileSync(path.join(tmpDir, 'src', 'two.js'), 'utf8')).toContain('worker');
    expect(git(tmpDir, ['log', '--format=%s', '-2'])).toBe([
      'Terrace parallel merge: two (' + started.run_id + ')',
      'Terrace parallel merge: one (' + started.run_id + ')'
    ].join('\n'));

    const cleaned = parallelCleanup(tmpDir, started.run_id, { force: false });
    expect(cleaned).toMatchObject({ status: 'cleaned', allowed: true });
    for (const plan of started.plans) {
      expect(fs.existsSync(plan.worktree)).toBe(false);
    }
  });

  it('creates dependent waves only after the prior wave is merged', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/one.js'] },
      { id: 'two', title: 'Two', files: ['src/two.js'], depends_on: ['one'] }
    ]);

    const started = parallelStart(tmpDir, 'phase-parallel');
    activeRuns.push({ cwd: tmpDir, id: started.run_id });
    const first = started.plans.find((plan: { id: string }) => plan.id === 'one');
    const second = started.plans.find((plan: { id: string }) => plan.id === 'two');
    expect(first).toMatchObject({ status: 'ready', wave: 1 });
    expect(second).toMatchObject({ status: 'pending', wave: 2, worktree: null });

    writeAndCommit(first.worktree, 'one', 'src/one.js', 'export const one = "dependency";\n');
    const nextWave = parallelMerge(tmpDir, started.run_id);
    expect(nextWave).toMatchObject({ status: 'running', current_wave: 2 });
    const preparedSecond = nextWave.plans.find((plan: { id: string }) => plan.id === 'two');
    expect(preparedSecond).toMatchObject({ status: 'ready', worktree: expect.any(String), base_commit: expect.any(String) });
    expect(fs.readFileSync(path.join(preparedSecond.worktree, 'src', 'one.js'), 'utf8')).toContain('dependency');

    writeAndCommit(preparedSecond.worktree, 'two', 'src/two.js', 'export const two = "dependent";\n');
    expect(parallelMerge(tmpDir, started.run_id)).toMatchObject({ status: 'merged', allowed: true });
  });

  it('requires a committed summary and preserves a failed worker for explicit recovery', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/one.js'] }
    ]);

    const started = parallelStart(tmpDir, 'phase-parallel');
    activeRuns.push({ cwd: tmpDir, id: started.run_id });
    expect(phaseValidate(tmpDir, 'phase-parallel')).toMatchObject({
      allowed: false,
      blockers: [expect.objectContaining({ code: 'PARALLEL_MERGE_REQUIRED' })]
    });
    const blocked = parallelMerge(tmpDir, started.run_id);
    expect(blocked).toMatchObject({ allowed: false, blockers: expect.arrayContaining([
      expect.objectContaining({ code: 'PARALLEL_COMMIT_REQUIRED' }),
      expect.objectContaining({ code: 'PARALLEL_SUMMARY_REQUIRED' })
    ]) });

    const failed = parallelFail(tmpDir, started.run_id, 'one', 'worker stopped before producing evidence');
    expect(failed).toMatchObject({ status: 'failed', sequential_fallback: 'terrace phase execute phase-parallel' });
    const cleaned = parallelCleanup(tmpDir, started.run_id, { force: false });
    expect(cleaned).toMatchObject({ status: 'cleaned', allowed: true });
    expect(cleaned.cleanup.preserved_branches).toHaveLength(1);
  });

  it('reattaches an interrupted worker from its preserved branch before merge', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/one.js'] }
    ]);

    const started = parallelStart(tmpDir, 'phase-parallel');
    activeRuns.push({ cwd: tmpDir, id: started.run_id });
    const plan = started.plans[0];
    writeAndCommit(plan.worktree, 'one', 'src/one.js', 'export const one = "reattached";\n');
    fs.rmSync(plan.worktree, { recursive: true, force: true });
    git(tmpDir, ['worktree', 'prune']);

    const resumed = parallelResume(tmpDir, started.run_id);
    expect(resumed).toMatchObject({ allowed: true, status: 'running', plans: [expect.objectContaining({ id: 'one', status: 'ready', worktree: plan.worktree })] });
    expect(parallelStatus(tmpDir, started.run_id)).toMatchObject({ ready_to_merge: true });
    expect(parallelMerge(tmpDir, started.run_id)).toMatchObject({ allowed: true, status: 'merged' });
  });

  it('rejects worker changes to canonical phase artifacts', () => {
    tmpDir = prepareRepo([
      { id: 'one', title: 'One', files: ['src/one.js'] }
    ]);

    const started = parallelStart(tmpDir, 'phase-parallel');
    activeRuns.push({ cwd: tmpDir, id: started.run_id });
    const plan = started.plans[0];
    writeAndCommit(plan.worktree, 'one', 'src/one.js', 'export const one = "single-writer";\n');
    fs.writeFileSync(path.join(plan.worktree, 'docs', 'terrace', 'phases', 'phase-parallel', 'EXECUTION.md'), '# Worker execution\n', 'utf8');
    commit(plan.worktree, 'Attempt canonical phase write');

    expect(parallelStatus(tmpDir, started.run_id)).toMatchObject({
      ready_to_merge: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'PARALLEL_SINGLE_WRITER_VIOLATION' }),
        expect.objectContaining({ code: 'PARALLEL_UNOWNED_CHANGE' })
      ])
    });
    parallelFail(tmpDir, started.run_id, 'one', 'worker changed a canonical phase artifact');
    expect(parallelCleanup(tmpDir, started.run_id, { force: false })).toMatchObject({ status: 'cleaned', allowed: true });
  });
});
