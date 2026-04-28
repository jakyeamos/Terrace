import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  saveState,
  createDefaultState,
  phaseList,
  phaseShow,
  resumeWorkflow,
  nextWorkflow,
  backlogList,
  backlogAdd,
  shipCheck
} = require('../packages/terrace-core/src/index.cjs');

describe('workflow parity core helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-workflow-commands-'));
    const state = createDefaultState({ projectName: 'workflow-test' });
    state.roadmap.phases = [{
      id: 'phase-11-notifications',
      title: 'Phase 11: Notifications',
      status: 'migrated',
      source_ref: '.planning/ROADMAP.md',
      plans: [{ id: '11-01', title: 'Notification Plan', status: 'migrated', source_ref: '.planning/phases/11/11-01-PLAN.md' }]
    }];
    state.handoff = {
      status: 'paused',
      phase: 'Phase 11: Notifications',
      next_action: 'Plan Phase 11 via /gsd:plan-phase',
      source_ref: '.planning/HANDOFF.json'
    };
    state.sessions = [{ source: 'gsd_handoff', status: 'paused' }];
    state.blocked_actions = [{ description: 'Apply migration 034_prime_notes.sql', blocking: true, source_ref: '.planning/HANDOFF.json' }];
    state.backlog = { items: [{ id: 'sms-fallback', title: 'Add SMS fallback.', status: 'open', source_ref: '.planning/STATE.md' }] };
    saveState(tmpDir, state);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists, shows, resumes, and computes next workflow action from state', () => {
    expect(phaseList(tmpDir).phases).toHaveLength(1);
    expect(phaseShow(tmpDir, 'phase-11-notifications').phase.plans).toHaveLength(1);
    expect(resumeWorkflow(tmpDir)).toMatchObject({
      status: 'paused',
      next_action: 'Plan Phase 11 via /gsd:plan-phase'
    });
    expect(nextWorkflow(tmpDir)).toMatchObject({
      command: 'terrace phase show phase-11-notifications',
      blocked: true
    });
  });

  it('manages backlog items and rejects missing phase ids', () => {
    expect(backlogList(tmpDir).items).toContainEqual(expect.objectContaining({ title: 'Add SMS fallback.' }));
    expect(backlogAdd(tmpDir, 'Confirm beta email copy').item).toMatchObject({
      title: 'Confirm beta email copy',
      status: 'open'
    });
    expect(() => backlogAdd(tmpDir, '')).toThrow(/Usage:/);
    expect(() => phaseShow(tmpDir, 'missing-phase')).toThrow(/Unknown phase/);
  });

  it('reports failed ship checks as structured categories', () => {
    const result = shipCheck(tmpDir);

    expect(result.passed).toBe(false);
    expect(result.categories.map((category: { category: string }) => category.category)).toEqual([
      'typecheck',
      'lint',
      'test',
      'coverage',
      'package',
      'dirty_tree'
    ]);
    expect(result.blockers.length).toBeGreaterThan(0);
  }, 15000);
});
