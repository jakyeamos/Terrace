import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const { createReleaseReadinessCliRouter } = require('../src/release-readiness-cli-router.cjs');

type Call = { name: string; cwd: string; options: unknown };
type OptionCalls = { release: string[][]; ship: string[][] };

function createRouter(calls: Call[], optionCalls: OptionCalls, failedHandlers: string[] = []) {
  const handler = (name: string) => (cwd: string, options: unknown) => {
    calls.push({ name, cwd, options });
    return { name, cwd, options, passed: !failedHandlers.includes(name) };
  };
  return createReleaseReadinessCliRouter({
    releasePreflight: handler('release-preflight'),
    shipCheck: handler('ship-check'),
    shipPrepare: handler('ship-prepare'),
    releaseOptionsFor: (rawArgs: string[]) => {
      optionCalls.release.push(rawArgs);
      return { source: 'release-options', rawArgs };
    },
    shipOptionsFor: (rawArgs: string[]) => {
      optionCalls.ship.push(rawArgs);
      return { source: 'ship-options', rawArgs };
    }
  });
}

describe('release-readiness CLI router', () => {
  it('loads without initializing the CLI dispatcher', () => {
    const routerPath = path.resolve(process.cwd(), 'src/release-readiness-cli-router.cjs');
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

  it('routes canonical and aliased release preflight with raw release options', () => {
    const calls: Call[] = [];
    const optionCalls: OptionCalls = { release: [], ship: [] };
    const router = createRouter(calls, optionCalls);
    const cwd = '/fixture';
    const canonical = ['release-preflight', 'ignored', '--static', '--target-version', '2.0.0', '--local'];
    const alias = ['release', 'preflight', '--full'];

    expect(router.route({ command_id: 'release-preflight', args: canonical.slice(0, 2), raw_args: canonical, cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'release-preflight', cwd },
      exitCode: undefined
    });
    expect(router.route({ command_id: 'release-preflight', args: alias.slice(0, 2), raw_args: alias, cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'release-preflight', cwd },
      exitCode: undefined
    });
    expect(optionCalls.release).toEqual([canonical, alias]);
    expect(calls.map((call) => call.options)).toEqual([
      { source: 'release-options', rawArgs: canonical },
      { source: 'release-options', rawArgs: alias }
    ]);
  });

  it('routes default/check/prepare ship forms and carries failed readiness exit intent', () => {
    const calls: Call[] = [];
    const optionCalls: OptionCalls = { release: [], ship: [] };
    const router = createRouter(calls, optionCalls, ['ship-check', 'ship-prepare']);
    const cwd = '/fixture';
    const defaultArgs = ['ship'];
    const checkArgs = ['ship', 'check', '--fast'];
    const missingModeArgs = ['ship', 'check', '--mode'];
    const prepareArgs = ['ship', 'prepare', '--full'];

    for (const [args, commandId, name] of [[defaultArgs, 'ship.check', 'ship-check'], [checkArgs, 'ship.check', 'ship-check'], [missingModeArgs, 'ship.check', 'ship-check'], [prepareArgs, 'ship.prepare', 'ship-prepare']] as const) {
      expect(router.route({ command_id: commandId, args, raw_args: args, cwd })).toMatchObject({
        handled: true,
        kind: 'result',
        data: { name, cwd, passed: false },
        exitCode: 1
      });
    }
    expect(optionCalls.ship).toEqual([defaultArgs, checkArgs, missingModeArgs, prepareArgs]);
    expect(calls.map((call) => call.name)).toEqual(['ship-check', 'ship-check', 'ship-check', 'ship-prepare']);
  });

  it('preserves exact router errors and leaves unrelated commands unhandled', () => {
    const calls: Call[] = [];
    const optionCalls: OptionCalls = { release: [], ship: [] };
    const router = createRouter(calls, optionCalls);
    const cwd = '/fixture';

    expect(router.route({ family_id: 'release', args: ['release'], raw_args: ['release'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown release subcommand: undefined. Use: preflight'
    });
    expect(router.route({ family_id: 'release', args: ['release', 'prepare'], raw_args: ['release', 'prepare'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown release subcommand: prepare. Use: preflight'
    });
    expect(router.route({ family_id: 'ship', args: ['ship', 'unknown'], raw_args: ['ship', 'unknown'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown ship subcommand: unknown. Use: check, prepare'
    });
    expect(router.route({ command_id: 'security.check', args: ['security', 'check'], raw_args: ['security', 'check'], cwd })).toEqual({ handled: false });
    expect(calls).toEqual([]);
    expect(optionCalls).toEqual({ release: [], ship: [] });
  });
});
