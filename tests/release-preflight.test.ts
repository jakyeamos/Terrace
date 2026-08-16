import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  SHIP_CHECK_MODES,
  createReleasePreflight
} = require('../packages/terrace-core/src/release-preflight.cjs');

describe('release preflight policy boundary', () => {
  it('loads without initializing workflow orchestration', () => {
    const releasePreflightPath = path.resolve(process.cwd(), 'packages/terrace-core/src/release-preflight.cjs');
    const workflowPath = path.resolve(process.cwd(), 'packages/terrace-core/src/workflow.cjs');
    const script = [
      'require(' + JSON.stringify(releasePreflightPath) + ');',
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

  it('uses injected workflow checks while retaining the static contract', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-release-preflight-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.2.3' }), 'utf-8');
      const calls: Array<{ cwd: string; options: { mode: string; includeTrustedPublishing: boolean } }> = [];
      const releasePreflight = createReleasePreflight({
        dirtyTreeCheck: () => {
          throw new Error('static preflight must not inspect the dirty tree');
        },
        shipCheck: (cwd: string, options: { mode: string; includeTrustedPublishing: boolean }) => {
          calls.push({ cwd, options });
          return {
            mode: options.mode,
            passed: true,
            blockers: [],
            warnings: [],
            categories: [{ category: 'stub', passed: true, command: 'stub check' }]
          };
        }
      });

      const result = releasePreflight(tmpDir, { runCommands: false, shipMode: 'fast' });

      expect(SHIP_CHECK_MODES).toEqual(['fast', 'local', 'full']);
      expect(calls).toEqual([{
        cwd: tmpDir,
        options: { mode: 'fast', includeTrustedPublishing: false }
      }]);
      expect(result.ship_check).toEqual({
        mode: 'fast',
        passed: true,
        blocker_count: 0,
        warning_count: 0,
        categories: [{ category: 'stub', passed: true, skipped: false, command: 'stub check' }]
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects static full mode before invoking workflow dependencies', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-release-preflight-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.2.3' }), 'utf-8');
      const releasePreflight = createReleasePreflight({
        dirtyTreeCheck: () => {
          throw new Error('invalid static mode must not inspect the dirty tree');
        },
        shipCheck: () => {
          throw new Error('invalid static mode must not invoke ship check');
        }
      });

      const result = releasePreflight(tmpDir, { runCommands: false, shipMode: 'full' });

      expect(result.blockers).toContainEqual(expect.objectContaining({ code: 'RELEASE_STATIC_MODE_INVALID' }));
      expect(result.ship_check).toMatchObject({ mode: 'full', passed: false, categories: [] });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
