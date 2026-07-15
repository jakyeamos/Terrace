import { describe, expect, it } from 'vitest';

type DispatchForm = {
  literals: string[];
  required_flags: string[];
  kind: 'command' | 'family';
  match: 'prefix' | 'exact';
};

type CatalogCommand = {
  id: string;
  dispatch: { owner: string; forms: DispatchForm[] } | null;
};

const { listCommandCatalog } = require('../packages/terrace-core/src/command-catalog.cjs') as {
  listCommandCatalog: () => CatalogCommand[];
};
const { resolveCommandDispatch } = require('../packages/terrace-core/src/command-parser.cjs') as {
  resolveCommandDispatch: (input: { args: string[]; raw_args: string[] }, options?: { catalog: CatalogCommand[] }) => Record<string, unknown>;
};

function resolve(args: string[], rawArgs = args) {
  return resolveCommandDispatch({ args, raw_args: rawArgs });
}

describe('catalog-owned command parser', () => {
  it('resolves every concrete catalog form without parsing display grammar', () => {
    for (const entry of listCommandCatalog()) {
      expect(entry.dispatch, entry.id).toBeTruthy();
      for (const form of entry.dispatch?.forms || []) {
        if (form.kind !== 'command') continue;
        const rawArgs = [...form.literals, ...form.required_flags];
        expect(resolve([...form.literals], rawArgs), entry.id).toMatchObject({
          kind: 'match',
          command_id: entry.id,
          owner: entry.dispatch?.owner,
          literals: form.literals
        });
      }
    }
  });

  it('preserves explicit precedence and compatibility aliases', () => {
    expect(resolve(['port', 'gsd'], ['port', 'gsd', '--compare', '--dry-run'])).toMatchObject({ command_id: 'port.gsd.compare' });
    expect(resolve(['port', 'gsd'], ['port', 'gsd', '--verify-parity', '--import-roadmap'])).toMatchObject({ command_id: 'port.gsd.verify-parity' });
    expect(resolve(['port', 'gsd'], ['port', 'gsd', '--import-roadmap', '--dry-run'])).toMatchObject({ command_id: 'port.gsd.import-roadmap' });
    expect(resolve(['port', 'gsd'], ['port', 'gsd', '--dry-run'])).toMatchObject({ command_id: 'port.gsd.dry-run' });
    expect(resolve(['planning', 'init'])).toMatchObject({ command_id: 'planning.refresh', alias_id: 'planning.init' });
    expect(resolve(['release', 'preflight'])).toMatchObject({ command_id: 'release-preflight', alias_id: 'release.preflight' });
    expect(resolve(['add', 'rule'])).toMatchObject({ command_id: 'rule.add', alias_id: 'add.rule' });
  });

  it('keeps named forms ahead of generic and family fallbacks', () => {
    expect(resolve(['interrogate', 'risk', 'billing'])).toMatchObject({ command_id: 'interrogate.mode' });
    expect(resolve(['interrogate', 'billing'])).toMatchObject({ command_id: 'interrogate' });
    expect(resolve(['quick', 'list'])).toMatchObject({ command_id: 'quick.list' });
    expect(resolve(['quick', 'phase-18'])).toMatchObject({ command_id: 'quick.roadmap-item' });
    expect(resolve(['ship'])).toMatchObject({ command_id: 'ship.check' });
    expect(resolve(['ship', 'prepare'])).toMatchObject({ command_id: 'ship.prepare' });
    expect(resolve(['ship', 'unknown'])).toMatchObject({ kind: 'family', family_id: 'ship', owner: 'release-readiness' });
    expect(resolve(['settings'])).toMatchObject({ command_id: 'settings.show' });
    expect(resolve(['settings', 'effort', 'thorough'])).toMatchObject({ command_id: 'settings.effort' });
    expect(resolve(['settings', 'unknown'])).toMatchObject({ kind: 'family', family_id: 'settings', owner: 'legacy' });
    expect(resolve(['report'])).toMatchObject({ command_id: 'report' });
    expect(resolve(['report', 'update'])).toMatchObject({ command_id: 'report.update' });
    expect(resolve(['report', 'unknown'])).toMatchObject({ kind: 'family', family_id: 'report', owner: 'report' });
  });

  it('returns ambiguous rather than relying on catalog declaration order', () => {
    const catalog = [
      { id: 'first', dispatch: { owner: 'legacy', forms: [{ literals: ['same'], required_flags: [], kind: 'command' as const, match: 'prefix' as const, priority: 0, family_id: null, alias_id: null }] } },
      { id: 'second', dispatch: { owner: 'legacy', forms: [{ literals: ['same'], required_flags: [], kind: 'command' as const, match: 'prefix' as const, priority: 0, family_id: null, alias_id: null }] } }
    ];

    expect(resolveCommandDispatch({ args: ['same'], raw_args: ['same'] }, { catalog })).toEqual({
      kind: 'ambiguous',
      candidates: ['command:legacy:first:', 'command:legacy:second:'],
      raw_args: ['same'],
      args: ['same']
    });
  });

  it('returns an unknown result for a command family absent from the catalog', () => {
    expect(resolve(['not-a-command'])).toEqual({
      kind: 'unknown',
      token: 'not-a-command',
      raw_args: ['not-a-command'],
      args: ['not-a-command']
    });
  });
});
