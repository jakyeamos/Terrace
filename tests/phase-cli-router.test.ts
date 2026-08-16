import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';

const { createPhaseCliRouter } = require('../src/phase-cli-router.cjs');

type Call = { name: string; cwd: string; phaseId?: string };

function createRouter(calls: Call[]) {
  const handler = (name: string) => (cwd: string, phaseId?: string) => {
    calls.push({ name, cwd, phaseId });
    return { name, cwd, phaseId };
  };
  return createPhaseCliRouter({
    phaseList: handler('list'),
    phaseShow: handler('show'),
    phasePlan: handler('plan'),
    phaseExecute: handler('execute'),
    phaseValidate: handler('validate'),
    phaseReview: handler('review'),
    phaseComplete: handler('complete'),
    phaseCompleteWorkflow: handler('complete-workflow'),
    loadState: (cwd: string) => ({ cwd, workflow: { status: 'initialized' } }),
    transitionState: (state: { cwd: string; workflow: { status: string } }, status: string) => ({
      ...state,
      workflow: { status }
    }),
    saveState: () => undefined
  });
}

describe('phase CLI router', () => {
  it('loads without initializing the CLI dispatcher', () => {
    const routerPath = path.resolve(process.cwd(), 'src/phase-cli-router.cjs');
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

  it('routes canonical phase actions and leaves unrelated commands unhandled', () => {
    const calls: Call[] = [];
    const router = createRouter(calls);
    const cwd = '/fixture';

    expect(router.route({ command_id: 'phase.list', args: ['phase', 'list'], cwd })).toEqual({
      handled: true,
      kind: 'result',
      data: { name: 'list', cwd, phaseId: undefined }
    });
    for (const action of ['show', 'plan', 'execute', 'validate', 'review', 'complete']) {
      expect(router.route({ command_id: 'phase.' + action, args: ['phase', action, 'phase-12'], cwd })).toEqual({
        handled: true,
        kind: 'result',
        data: { name: action, cwd, phaseId: 'phase-12' }
      });
    }
    expect(router.route({ command_id: 'ship.check', args: ['ship', 'check'], cwd })).toEqual({ handled: false });
    expect(calls.map((call) => call.name)).toEqual(['list', 'show', 'plan', 'execute', 'validate', 'review', 'complete']);
  });

  it('preserves aliases and the combined phase workflow envelope', () => {
    const calls: Call[] = [];
    const router = createRouter(calls);
    const cwd = '/fixture';

    for (const action of ['plan', 'execute', 'validate', 'review', 'complete']) {
      expect(router.route({ command_id: 'phase.' + action + '.alias', args: [action + '-phase', 'phase-12'], cwd })).toEqual({
        handled: true,
        kind: 'result',
        data: {
          command_alias: 'terrace phase ' + action + ' phase-12',
          result: { name: action, cwd, phaseId: 'phase-12' }
        }
      });
    }
    expect(router.route({ command_id: 'phase.execute-complete', args: ['execute-phase-complete', 'phase-12'], cwd })).toEqual({
      handled: true,
      kind: 'result',
      data: { name: 'complete-workflow', cwd, phaseId: 'phase-12' }
    });
  });

  it('preserves phase-set transition ordering and exact phase errors', () => {
    const order: string[] = [];
    const router = createPhaseCliRouter({
      phaseList: () => undefined,
      phaseShow: () => undefined,
      phasePlan: () => undefined,
      phaseExecute: () => undefined,
      phaseValidate: () => undefined,
      phaseReview: () => undefined,
      phaseComplete: () => undefined,
      phaseCompleteWorkflow: () => undefined,
      loadState: () => {
        order.push('load');
        return { workflow: { status: 'initialized' } };
      },
      transitionState: (state: { workflow: { status: string } }, status: string) => {
        order.push('transition:' + status);
        return { ...state, workflow: { status } };
      },
      saveState: (_cwd: string, state: { workflow: { status: string } }) => {
        order.push('save:' + state.workflow.status);
      }
    });
    const cwd = '/fixture';

    expect(router.route({ command_id: 'phase.set', args: ['phase', 'set', 'intake_recorded'], cwd })).toEqual({
      handled: true,
      kind: 'result',
      data: { workflow: { status: 'intake_recorded' } }
    });
    expect(order).toEqual(['load', 'transition:intake_recorded', 'save:intake_recorded']);
    expect(router.route({ command_id: 'phase.show', args: ['phase', 'show'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Usage: terrace phase show <phase-id>'
    });
    expect(router.route({ family_id: 'phase', args: ['phase', 'invalid'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Unknown phase subcommand: invalid. Use: list, show, plan, execute, validate, review, complete, set'
    });
    expect(router.route({ command_id: 'phase.execute-complete', args: ['execute-phase-complete'], cwd })).toEqual({
      handled: true,
      kind: 'error',
      message: 'Usage: terrace execute-phase-complete <phase-id>'
    });
  });
});
