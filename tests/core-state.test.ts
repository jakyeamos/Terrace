import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  assertLegalTransition,
  transitionState,
  loadState,
  saveState,
  appendEvent,
  readEvents,
  createStageRun,
  transitionStageRun,
  beginPhaseStageRun,
  persistStageTransition,
  replayStageRun,
  recoverStageRun
} = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core state machine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a JSON-led default state with required top-level fields', () => {
    const state = createDefaultState({ projectName: 'demo' });
    expect(state.schema_version).toBe('1.0');
    expect(state.project.name).toBe('demo');
    expect(state.workflow.status).toBe('initialized');
    expect(state).toHaveProperty('roadmap');
    expect(state).toHaveProperty('active_slice');
    expect(state).toHaveProperty('red_gate');
    expect(state).toHaveProperty('green_gate');
    expect(state).toHaveProperty('protected_tests');
    expect(state).toHaveProperty('decisions');
    expect(state).toHaveProperty('sessions');
  });

  it('allows initialized -> intake_recorded', () => {
    expect(() => assertLegalTransition('initialized', 'intake_recorded')).not.toThrow();
  });

  it('rejects initialized -> implementation_allowed', () => {
    expect(() => assertLegalTransition('initialized', 'implementation_allowed')).toThrow('Illegal transition');
  });

  it('transitionState preserves state and changes workflow status', () => {
    const state = createDefaultState({ projectName: 'demo' });
    const next = transitionState(state, 'intake_recorded');
    expect(next.workflow.status).toBe('intake_recorded');
    expect(next.project.name).toBe('demo');
  });

  it('saves and loads .terrace/state.json', () => {
    const state = createDefaultState({ projectName: 'demo' });
    saveState(tmpDir, state);
    const loaded = loadState(tmpDir);
    expect(loaded.project.name).toBe('demo');
    expect(fs.readdirSync(path.join(tmpDir, '.terrace')).filter((name) => name.includes('.tmp-'))).toEqual([]);
  });

  it('enforces ordered stage transitions and supports failed-stage retry', () => {
    const run = createStageRun({
      runId: 'phase:demo:1',
      phaseId: 'demo',
      stageIds: ['plan', 'execute'],
      timestamp: '2026-08-12T12:00:00.000Z'
    });

    expect(() => transitionStageRun(run, 'execute', 'active')).toThrow('Stage locked');
    const planActive = transitionStageRun(run, 'plan', 'active', { timestamp: '2026-08-12T12:00:01.000Z' });
    const planFailed = transitionStageRun(planActive, 'plan', 'failed', { timestamp: '2026-08-12T12:00:02.000Z' });
    const planRetried = transitionStageRun(planFailed, 'plan', 'active', { timestamp: '2026-08-12T12:00:03.000Z' });

    expect(planRetried.stages[0]).toMatchObject({ status: 'active', attempts: 2 });
  });

  it('retains a stop packet while blocked and clears it only on a legal retry', () => {
    const run = createStageRun({ runId: 'phase:demo:stop', phaseId: 'demo', stageIds: ['plan', 'execute'] });
    const active = transitionStageRun(run, 'plan', 'active');
    const blocked = transitionStageRun(active, 'plan', 'blocked', {
      stopPacket: { schema_version: 'terrace-stop-packet/v1', command: 'terrace phase plan demo' }
    });

    expect(blocked.stop_packet).toMatchObject({ schema_version: 'terrace-stop-packet/v1' });
    expect(() => transitionStageRun(blocked, 'execute', 'active')).toThrow('Stage locked');
    expect(transitionStageRun(blocked, 'plan', 'active').stop_packet).toBeNull();
  });

  it('recovers a stale stage snapshot by replaying the append-only event log', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    beginPhaseStageRun(tmpDir, 'phase-demo', {
      runId: 'phase:demo:replay',
      timestamp: '2026-08-12T12:00:00.000Z'
    });
    persistStageTransition(tmpDir, 'plan', 'active', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:01.000Z'
    });
    persistStageTransition(tmpDir, 'plan', 'passed', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:02.000Z',
      evidenceRefs: ['docs/terrace/phases/phase-demo/PLAN.md']
    });
    const staleState = loadState(tmpDir);
    const staleRun = staleState.workflow.stage_run;
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
    saveState(tmpDir, {
      ...loadState(tmpDir),
      workflow: { ...loadState(tmpDir).workflow, stage_run: staleRun }
    });

    expect(loadState(tmpDir).workflow.stage_run.revision).toBe(2);
    expect(replayStageRun(readEvents(tmpDir), blockedRun.run_id)).toEqual(blockedRun);
    expect(recoverStageRun(tmpDir)).toEqual(blockedRun);
    expect(recoverStageRun(tmpDir).stop_packet).toEqual(expect.objectContaining({
      schema_version: 'terrace-stop-packet/v1',
      command: 'terrace phase execute phase-demo'
    }));
    expect(loadState(tmpDir).workflow.stage_run.stages.map((stage: { status: string }) => stage.status)).toEqual([
      'passed',
      'blocked',
      'pending',
      'pending',
      'pending'
    ]);
  });

  it('repairs a manually forged passing snapshot from the authoritative event history', () => {
    saveState(tmpDir, createDefaultState({ projectName: 'demo' }));
    beginPhaseStageRun(tmpDir, 'phase-demo', {
      runId: 'phase:demo:forged-snapshot',
      timestamp: '2026-08-12T12:00:00.000Z'
    });
    persistStageTransition(tmpDir, 'plan', 'active', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:01.000Z'
    });
    const blockedRun = persistStageTransition(tmpDir, 'plan', 'blocked', {
      command: 'terrace phase plan phase-demo',
      timestamp: '2026-08-12T12:00:02.000Z',
      stopPacket: {
        schema_version: 'terrace-stop-packet/v1',
        command: 'terrace phase plan phase-demo',
        owner: 'workflow_operator'
      }
    });
    const state = loadState(tmpDir);
    saveState(tmpDir, {
      ...state,
      workflow: {
        ...state.workflow,
        stage_run: {
          ...blockedRun,
          stop_packet: null,
          stages: blockedRun.stages.map((stage: { id: string }) => ({
            ...stage,
            status: 'passed',
            attempts: Math.max(stage.id === 'plan' ? 1 : 0, 1),
            completed_at: '2026-08-12T12:00:03.000Z'
          }))
        }
      }
    });

    expect(loadState(tmpDir).workflow.stage_run.stages.every((stage: { status: string }) => stage.status === 'passed')).toBe(true);
    expect(recoverStageRun(tmpDir)).toEqual(blockedRun);
    expect(loadState(tmpDir).workflow.stage_run.stages.map((stage: { status: string }) => stage.status)).toEqual([
      'blocked',
      'pending',
      'pending',
      'pending',
      'pending'
    ]);
  });

  it('rejects an injected terminal event that skips required predecessor gates', () => {
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
});
