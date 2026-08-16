import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  appendEvent,
  beginPhaseStageRun,
  createDefaultState,
  createStageRun,
  loadState,
  persistStageTransition,
  recoverStageRun,
  replaceState,
  saveState,
  transitionStageRun
} = require('../packages/terrace-core/src/index.cjs');

const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

function runTerrace(cwd: string, args: string[]): Record<string, unknown> {
  return JSON.parse(execFileSync(process.execPath, [TERRACE_CLI, ...args], {
    cwd,
    encoding: 'utf8'
  }));
}

describe('durable phase-stage state', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-stage-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('enforces ordered transitions and permits an explicit failed-stage retry', () => {
    const run = createStageRun({
      runId: 'phase:demo:1',
      phaseId: 'demo',
      stageIds: ['plan', 'execute'],
      timestamp: '2026-08-12T12:00:00.000Z'
    });

    expect(() => transitionStageRun(run, 'execute', 'active')).toThrow('Stage locked');
    const active = transitionStageRun(run, 'plan', 'active', { timestamp: '2026-08-12T12:00:01.000Z' });
    const failed = transitionStageRun(active, 'plan', 'failed', { timestamp: '2026-08-12T12:00:02.000Z' });
    const retried = transitionStageRun(failed, 'plan', 'active', { timestamp: '2026-08-12T12:00:03.000Z' });

    expect(retried.stages[0]).toMatchObject({ status: 'active', attempts: 2 });
  });

  it('replays the event ledger when the saved stage snapshot is stale', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    beginPhaseStageRun(tmpDir, 'phase-demo', {
      runId: 'phase:demo:replay',
      timestamp: '2026-08-12T12:00:00.000Z'
    });
    persistStageTransition(tmpDir, 'plan', 'active', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:01.000Z'
    });
    const staleRun = loadState(tmpDir).workflow.stage_run;
    persistStageTransition(tmpDir, 'plan', 'passed', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:02.000Z',
      evidenceRefs: ['docs/terrace/phases/phase-demo/PLAN.md']
    });
    persistStageTransition(tmpDir, 'execute', 'active', {
      command: 'terrace phase execute phase-demo',
      timestamp: '2026-08-12T12:00:03.000Z'
    });
    const blockedRun = persistStageTransition(tmpDir, 'execute', 'blocked', {
      command: 'terrace phase execute phase-demo',
      timestamp: '2026-08-12T12:00:04.000Z',
      evidenceRefs: ['.planning/HANDOFF.json'],
      stopPacket: {
        schema_version: 'terrace-stop-packet/v1',
        command: 'terrace phase execute phase-demo',
        owner: 'workflow_operator'
      }
    });

    const current = loadState(tmpDir);
    replaceState(tmpDir, {
      ...current,
      workflow: { ...current.workflow, stage_run: staleRun }
    });

    expect(loadState(tmpDir).workflow.stage_run.revision).toBe(1);
    expect(recoverStageRun(tmpDir)).toEqual(blockedRun);
    expect(loadState(tmpDir).workflow.stage_run.stages.map((stage: { status: string }) => stage.status)).toEqual([
      'passed',
      'blocked',
      'pending',
      'pending',
      'pending'
    ]);
  });

  it('rejects a forged terminal event that skips predecessor gates', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    const run = beginPhaseStageRun(tmpDir, 'phase-demo', {
      runId: 'phase:demo:skipped-gates',
      timestamp: '2026-08-12T12:00:00.000Z'
    });
    appendEvent(tmpDir, {
      event_type: 'stage_transition',
      command: 'manual event edit',
      run_id: run.run_id,
      phase_id: run.phase_id,
      revision: 1,
      stage_id: 'complete',
      from_status: 'pending',
      to_status: 'passed',
      result: 'passed',
      timestamp: '2026-08-12T12:00:01.000Z'
    });

    expect(() => recoverStageRun(tmpDir)).toThrow('Illegal stage transition: complete pending -> passed');
    expect(loadState(tmpDir).workflow.stage_run.stages.every((stage: { status: string }) => stage.status === 'pending')).toBe(true);
  });

  it('lists and resolves a blocker only with owner and repo-local evidence', () => {
    saveState(tmpDir, {
      ...createDefaultState({ projectName: 'demo' }),
      blocked_actions: [{
        description: 'Confirm external deployment evidence',
        blocking: true,
        owner: 'release_operator',
        source_ref: 'release-check'
      }]
    });
    fs.writeFileSync(path.join(tmpDir, 'BLOCKER-EVIDENCE.md'), '# Verified\n', 'utf8');

    const listed = runTerrace(tmpDir, ['blocker', 'list', '--json']) as { items: Array<{ id: string; blocking: boolean }> };
    expect(listed.items).toEqual([expect.objectContaining({
      id: 'confirm-external-deployment-evidence',
      blocking: true
    })]);

    const resolved = runTerrace(tmpDir, [
      'blocker',
      'resolve',
      listed.items[0].id,
      '--owner',
      'release_operator',
      '--evidence',
      'BLOCKER-EVIDENCE.md',
      '--json'
    ]);

    expect(resolved).toMatchObject({
      status: 'resolved',
      item: {
        blocking: false,
        resolution: {
          owner: 'release_operator',
          evidence_ref: 'BLOCKER-EVIDENCE.md'
        }
      },
      next_command: 'terrace next'
    });
    expect(loadState(tmpDir).blocked_actions[0]).toMatchObject({ blocking: false, status: 'resolved' });
  });
});
