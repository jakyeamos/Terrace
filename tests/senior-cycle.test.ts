import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const seniorCycle = require('../packages/terrace-core/src/senior-cycle.cjs');
const workflow = require('../packages/terrace-core/src/workflow.cjs');
const { createDefaultState, loadState, saveState, statePathFor } = require('../packages/terrace-core/src/state.cjs');

function createFixture(name: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-senior-cycle-'));
  saveState(tmpDir, createDefaultState({ projectName: name }));
  return tmpDir;
}

describe('senior-cycle domain boundary', () => {
  it('loads without initializing workflow orchestration', () => {
    const seniorCyclePath = path.resolve(process.cwd(), 'packages/terrace-core/src/senior-cycle.cjs');
    const workflowPath = path.resolve(process.cwd(), 'packages/terrace-core/src/workflow.cjs');
    const script = [
      'require(' + JSON.stringify(seniorCyclePath) + ');',
      'const workflowPath = require.resolve(' + JSON.stringify(workflowPath) + ');',
      'process.stdout.write(JSON.stringify({ workflow_loaded: Boolean(require.cache[workflowPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ workflow_loaded: false });
  });

  it('preserves workflow facade identities for senior-cycle commands', () => {
    for (const name of [
      'seniorCycleStatus',
      'alignFeature',
      'interrogateFeature',
      'mapCodebase',
      'designFeature',
      'testPlanFeature',
      'observeFeature',
      'validateProdFeature',
      'cleanupFeature',
      'uiImportStitch',
      'uiPlanRefresh',
      'uiDiff'
    ]) {
      expect(workflow[name]).toBe(seniorCycle[name]);
    }
  });

  it('writes the large-tier artifact flow and persists the complete senior-cycle state', () => {
    const tmpDir = createFixture('large-tier-flow');
    try {
      const feature = 'billing-refresh';
      seniorCycle.alignFeature(tmpDir, feature, { tier: 'large' });
      seniorCycle.interrogateFeature(tmpDir, feature, {
        tier: 'large',
        userAnswers: 'Preserve billing approval behavior.\nTest authorization and rollback.\nRelease owner decides unresolved risk.'
      });
      seniorCycle.mapCodebase(tmpDir);
      seniorCycle.designFeature(tmpDir, feature, { tier: 'large' });
      seniorCycle.testPlanFeature(tmpDir, feature, { tier: 'large' });
      seniorCycle.observeFeature(tmpDir, feature, { tier: 'large' });
      seniorCycle.validateProdFeature(tmpDir, feature, { tier: 'large' });
      seniorCycle.cleanupFeature(tmpDir, feature, { tier: 'large' });

      expect(seniorCycle.seniorCycleStatus(tmpDir, feature, 'large')).toMatchObject({
        feature_id: feature,
        tier: 'large',
        allowed: {
          execute: true,
          implement: true,
          ship: true,
          complete: true
        },
        missing_artifacts: []
      });
      expect(loadState(tmpDir).senior_cycle).toMatchObject({
        active_feature: feature,
        features: {
          [feature]: {
            feature_id: feature,
            tier: 'large',
            artifacts: expect.objectContaining({
              alignment: 'docs/terrace/features/billing-refresh/ALIGNMENT.md',
              cleanup: 'docs/terrace/features/billing-refresh/CLEANUP.md'
            })
          }
        }
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports only ship-relevant senior blockers without mutating state', () => {
    const tmpDir = createFixture('ship-check');
    try {
      seniorCycle.alignFeature(tmpDir, 'billing-refresh', { tier: 'large' });
      const statePath = statePathFor(tmpDir);
      const before = fs.readFileSync(statePath, 'utf-8');

      const result = seniorCycle.seniorCycleShipCheck(tmpDir);

      expect(result).toMatchObject({
        category: 'senior_cycle',
        passed: false,
        blocking: [
          expect.objectContaining({ code: 'OBSERVABILITY_REQUIRED' }),
          expect.objectContaining({ code: 'VALIDATION_REQUIRED' })
        ]
      });
      expect(fs.readFileSync(statePath, 'utf-8')).toBe(before);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
