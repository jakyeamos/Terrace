import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { createShipReadiness } = require('../packages/terrace-core/src/ship-readiness.cjs');
const { createDefaultState, saveState } = require('../packages/terrace-core/src/state.cjs');

describe('ship readiness policy boundary', () => {
  it('loads without initializing workflow orchestration', () => {
    const shipReadinessPath = path.resolve(process.cwd(), 'packages/terrace-core/src/ship-readiness.cjs');
    const workflowPath = path.resolve(process.cwd(), 'packages/terrace-core/src/workflow.cjs');
    const releasePreflightPath = path.resolve(process.cwd(), 'packages/terrace-core/src/release-preflight.cjs');
    const script = [
      'require(' + JSON.stringify(shipReadinessPath) + ');',
      'const workflowPath = require.resolve(' + JSON.stringify(workflowPath) + ');',
      'const releasePreflightPath = require.resolve(' + JSON.stringify(releasePreflightPath) + ');',
      'process.stdout.write(JSON.stringify({ workflow_loaded: Boolean(require.cache[workflowPath]), release_preflight_loaded: Boolean(require.cache[releasePreflightPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ workflow_loaded: false, release_preflight_loaded: false });
  });

  it('uses an injected senior-cycle category without changing the readiness projection', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-ship-readiness-'));
    try {
      saveState(tmpDir, createDefaultState({ projectName: 'ship-readiness' }));
      const calls: string[] = [];
      const trustedPublishingCalls: string[] = [];
      const { shipCheck } = createShipReadiness({
        seniorCycleShipCheck: (cwd: string) => {
          calls.push(cwd);
          return {
            category: 'senior_cycle',
            command: 'fixture senior-cycle check',
            passed: true,
            blocking: [],
            warnings: []
          };
        },
        terracePackageReleaseTarget: () => true,
        trustedPublishingShipCheck: (cwd: string) => {
          trustedPublishingCalls.push(cwd);
          return {
            category: 'trusted_publishing',
            command: 'fixture trusted-publishing check',
            passed: true,
            blocking: [],
            warnings: []
          };
        }
      });

      const result = shipCheck(tmpDir, { mode: 'fast' });

      expect(calls).toEqual([tmpDir]);
      expect(trustedPublishingCalls).toEqual([tmpDir]);
      expect(result.categories).toContainEqual(expect.objectContaining({
        category: 'senior_cycle',
        command: 'fixture senior-cycle check',
        passed: true,
        elapsed_ms: expect.any(Number)
      }));
      expect(result.timings).toContainEqual(expect.objectContaining({
        category: 'senior_cycle',
        elapsed_ms: expect.any(Number)
      }));
      expect(result.categories).toContainEqual(expect.objectContaining({
        category: 'trusted_publishing',
        command: 'fixture trusted-publishing check',
        passed: true,
        elapsed_ms: expect.any(Number)
      }));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
