import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const { createSeniorCycleCliRouter } = require('../src/senior-cycle-cli-router.cjs');

type Call = { name: string; cwd: string; args: unknown[] };

function createRouter(calls: Call[], optionCalls: string[][]) {
  const handler = (name: string) => (cwd: string, ...args: unknown[]) => {
    calls.push({ name, cwd, args });
    return { name, cwd, args };
  };
  return createSeniorCycleCliRouter({
    optionsFor: (rawArgs: string[]) => {
      optionCalls.push(rawArgs);
      return { tier: 'large', userAnswers: 'fixture answers' };
    },
    alignFeature: handler('align'),
    interrogateFeature: handler('interrogate-feature'),
    interrogateMode: handler('interrogate-mode'),
    mapCodebase: handler('map-codebase'),
    designFeature: handler('design'),
    testPlanFeature: handler('test-plan'),
    observeFeature: handler('observe'),
    validateProdFeature: handler('validate-prod'),
    cleanupFeature: handler('cleanup'),
    uiImportStitch: handler('ui-import-stitch'),
    uiPlanRefresh: handler('ui-plan-refresh'),
    uiDiff: handler('ui-diff')
  });
}

describe('senior-cycle CLI router', () => {
  it('loads without initializing the CLI dispatcher', () => {
    const routerPath = path.resolve(process.cwd(), 'src/senior-cycle-cli-router.cjs');
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

  it('routes senior-cycle feature commands with their option contract', () => {
    const calls: Call[] = [];
    const optionCalls: string[][] = [];
    const router = createRouter(calls, optionCalls);
    const cwd = '/fixture';

    for (const command of ['align', 'design', 'test-plan', 'observe', 'validate-prod', 'cleanup']) {
      const rawArgs = [command, 'billing-refresh', '--tier', 'large'];
      expect(router.route({ command_id: command, args: rawArgs.slice(0, 2), raw_args: rawArgs, cwd })).toMatchObject({
        handled: true,
        kind: 'result',
        data: { name: command, cwd }
      });
    }
    expect(optionCalls).toEqual([
      ['align', 'billing-refresh', '--tier', 'large'],
      ['design', 'billing-refresh', '--tier', 'large'],
      ['test-plan', 'billing-refresh', '--tier', 'large'],
      ['observe', 'billing-refresh', '--tier', 'large'],
      ['validate-prod', 'billing-refresh', '--tier', 'large'],
      ['cleanup', 'billing-refresh', '--tier', 'large']
    ]);
    expect(calls.map((call) => call.name)).toEqual(['align', 'design', 'test-plan', 'observe', 'validate-prod', 'cleanup']);
  });

  it('routes generic and mode-specific interrogation through distinct handlers', () => {
    const calls: Call[] = [];
    const optionCalls: string[][] = [];
    const router = createRouter(calls, optionCalls);
    const cwd = '/fixture';

    expect(router.route({ command_id: 'interrogate', args: ['interrogate', 'billing-refresh'], raw_args: ['interrogate', 'billing-refresh'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'interrogate-feature', cwd }
    });
    expect(router.route({ command_id: 'interrogate.mode', args: ['interrogate', 'risk', 'billing-refresh'], raw_args: ['interrogate', 'risk', 'billing-refresh'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'interrogate-mode', cwd }
    });
    expect(calls).toEqual([
      expect.objectContaining({ name: 'interrogate-feature', args: ['billing-refresh', { tier: 'large', userAnswers: 'fixture answers' }] }),
      expect.objectContaining({ name: 'interrogate-mode', args: ['risk', 'billing-refresh', { tier: 'large', userAnswers: 'fixture answers' }] })
    ]);
    expect(optionCalls).toEqual([
      ['interrogate', 'billing-refresh'],
      ['interrogate', 'risk', 'billing-refresh']
    ]);
  });

  it('keeps map and UI routes option-free and preserves the unknown-UI error', () => {
    const calls: Call[] = [];
    const optionCalls: string[][] = [];
    const router = createRouter(calls, optionCalls);
    const cwd = '/fixture';

    expect(router.route({ command_id: 'map-codebase', args: ['map-codebase'], raw_args: ['map-codebase', '--paste-answers'], cwd })).toMatchObject({
      handled: true,
      kind: 'result',
      data: { name: 'map-codebase', cwd }
    });
    for (const [sub, name] of [['import-stitch', 'ui-import-stitch'], ['plan-refresh', 'ui-plan-refresh'], ['diff', 'ui-diff']]) {
      expect(router.route({ command_id: 'ui.' + sub, args: ['ui', sub, 'settings-refresh'], raw_args: ['ui', sub, 'settings-refresh', '--paste-answers'], cwd })).toMatchObject({
        handled: true,
        kind: 'result',
        data: { name, cwd }
      });
    }
    expect(router.route({ family_id: 'ui', args: ['ui', 'unknown'], raw_args: ['ui', 'unknown'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown ui subcommand: unknown. Use: import-stitch, plan-refresh, diff'
    });
    expect(router.route({ command_id: 'ship.check', args: ['ship', 'check'], raw_args: ['ship', 'check'], cwd })).toEqual({ handled: false });
    expect(optionCalls).toEqual([]);
  });
});
