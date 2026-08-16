import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const { createReportCliRouter } = require('../src/report-cli-router.cjs');

type Call = { name: string; cwd: string; options?: unknown };

function createRouter(calls: Call[], ceremonyPassed = true) {
  const handler = (name: string) => (cwd: string, options?: unknown) => {
    calls.push({ name, cwd, options });
    return name === 'ceremony' ? { name, cwd, passed: ceremonyPassed } : { name, cwd, options };
  };
  return createReportCliRouter({
    reportRead: handler('read'),
    reportUpdate: handler('update'),
    reportOpen: handler('open'),
    reportHistory: handler('history'),
    reportCeremony: handler('ceremony')
  });
}

describe('report CLI router', () => {
  it('loads without initializing the CLI dispatcher', () => {
    const routerPath = path.resolve(process.cwd(), 'src/report-cli-router.cjs');
    const cliPath = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
    const script = [
      'require(' + JSON.stringify(routerPath) + ');',
      'const cliPath = require.resolve(' + JSON.stringify(cliPath) + ');',
      'process.stdout.write(JSON.stringify({ cli_loaded: Boolean(require.cache[cliPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ cli_loaded: false });
  });

  it('routes read, update, open, and history with the existing command contract', () => {
    const calls: Call[] = [];
    const router = createRouter(calls);
    const cwd = '/fixture';

    expect(router.route({ command_id: 'report', args: ['report'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'read', cwd },
      exitCode: undefined
    });
    for (const [sub, name] of [['update', 'update'], ['open', 'open'], ['history', 'history']] as const) {
      expect(router.route({ command_id: 'report.' + sub, args: ['report', sub, 'ignored'], cwd })).toMatchObject({
        handled: true,
        kind: 'result',
        data: { name, cwd },
        exitCode: undefined
      });
    }
    expect(calls).toEqual([
      { name: 'read', cwd, options: undefined },
      { name: 'update', cwd, options: { command: 'terrace report update' } },
      { name: 'open', cwd, options: undefined },
      { name: 'history', cwd, options: undefined }
    ]);
  });

  it('carries the ceremony exit intent without taking renderer ownership', () => {
    const cwd = '/fixture';
    const passingCalls: Call[] = [];
    const failingCalls: Call[] = [];

    expect(createRouter(passingCalls, true).route({ command_id: 'report.ceremony', args: ['report', 'ceremony'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'ceremony', cwd, passed: true },
      exitCode: undefined
    });
    expect(createRouter(failingCalls, false).route({ command_id: 'report.ceremony', args: ['report', 'ceremony'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'ceremony', cwd, passed: false },
      exitCode: 1
    });
    expect(passingCalls).toEqual([{ name: 'ceremony', cwd, options: undefined }]);
    expect(failingCalls).toEqual([{ name: 'ceremony', cwd, options: undefined }]);
  });

  it('preserves the exact unknown-subcommand error and leaves unrelated commands unhandled', () => {
    const calls: Call[] = [];
    const router = createRouter(calls);
    const cwd = '/fixture';

    expect(router.route({ family_id: 'report', args: ['report', 'unknown'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown report subcommand: unknown. Use: update, open, history, ceremony'
    });
    expect(router.route({ command_id: 'ship.check', args: ['ship', 'check'], cwd })).toEqual({ handled: false });
    expect(calls).toEqual([]);
  });
});
