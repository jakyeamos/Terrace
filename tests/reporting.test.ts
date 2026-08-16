import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const reporting = require('../packages/terrace-core/src/reporting.cjs');
const lifecycle = require('../packages/terrace-core/src/lifecycle.cjs');

describe('reporting domain boundary', () => {
  it('loads without initializing lifecycle or its higher-level consumers', () => {
    const reportingPath = path.resolve(process.cwd(), 'packages/terrace-core/src/reporting.cjs');
    const modulePaths = {
      lifecycle: path.resolve(process.cwd(), 'packages/terrace-core/src/lifecycle.cjs'),
      workflow: path.resolve(process.cwd(), 'packages/terrace-core/src/workflow.cjs'),
      ship_readiness: path.resolve(process.cwd(), 'packages/terrace-core/src/ship-readiness.cjs')
    };
    const script = [
      'require(' + JSON.stringify(reportingPath) + ');',
      'const modulePaths = ' + JSON.stringify(modulePaths) + ';',
      'const loaded = Object.fromEntries(Object.entries(modulePaths).map(([name, modulePath]) => [name, Boolean(require.cache[require.resolve(modulePath)])]));',
      'process.stdout.write(JSON.stringify(loaded));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      lifecycle: false,
      workflow: false,
      ship_readiness: false
    });
  });

  it('keeps the lifecycle facade identity-compatible', () => {
    expect(lifecycle.reportRead).toBe(reporting.reportRead);
    expect(lifecycle.reportUpdate).toBe(reporting.reportUpdate);
    expect(lifecycle.reportOpen).toBe(reporting.reportOpen);
    expect(lifecycle.reportHistory).toBe(reporting.reportHistory);
    expect(lifecycle.reportCeremony).toBe(reporting.reportCeremony);
    expect(lifecycle.reportShipCheck).toBe(reporting.reportShipCheck);
  });
});
