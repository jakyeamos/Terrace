import { describe, expect, it } from 'vitest';

type CatalogCommand = {
  id: string;
  effect: string;
  argv_pattern: string[];
  help: { usage: string; summary: string } | null;
  agent: { template_id: string; invocation: string; description: string } | null;
  variants: Array<{ when: string; effect: string }>;
  route_argv: Array<string | { kind: string; name: string; flag?: string }>;
  dispatch: {
    owner: string;
    forms: Array<{
      literals: string[];
      required_flags: string[];
      priority: number;
      kind: string;
      family_id: string | null;
      match: string;
      alias_id: string | null;
    }>;
  } | null;
  contracts: Array<{ command_id: string; command: string; category: string; json: boolean; purpose: string }>;
};

type Contract = {
  command: string;
  category: string;
  json: boolean;
  purpose: string;
};

const {
  commandById,
  listAgentCommands,
  listCommandCatalog,
  listCommandContracts,
  listHelpCommands,
  listIntentCommands,
  renderCommandArgv,
  renderCliHelp,
  validateCommandCatalog
} = require('../packages/terrace-core/src/index.cjs') as {
  commandById: (id: string) => CatalogCommand | null;
  listAgentCommands: () => Array<{ name: string; command: string; help?: string }>;
  listCommandCatalog: () => CatalogCommand[];
  listCommandContracts: () => Contract[];
  listHelpCommands: () => Array<{ id: string; usage: string; summary: string }>;
  listIntentCommands: () => Array<{ id: string; command_id: string }>;
  renderCommandArgv: (id: string, parameters?: Record<string, string | null>) => string[];
  renderCliHelp: () => string;
  validateCommandCatalog: () => {
    valid: boolean;
    duplicate_ids: string[];
    duplicate_agent_names: string[];
    missing_contract_commands: string[];
    missing_dispatch_commands: string[];
    invalid_dispatch_commands: string[];
  };
};

describe('command catalog', () => {
  it('is the unique source for help, agents, and published contracts', () => {
    const validation = validateCommandCatalog();
    const catalog = listCommandCatalog();
    const helpCommands = listHelpCommands();
    const agentCommands = listAgentCommands();
    const contracts = listCommandContracts();
    const projectedContracts = catalog.flatMap((entry) => entry.contracts.map(({ command_id, ...contract }) => contract));

    expect(validation).toMatchObject({
      valid: true,
      duplicate_ids: [],
      duplicate_agent_names: [],
      missing_contract_commands: [],
      missing_dispatch_commands: [],
      invalid_dispatch_commands: []
    });
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
    expect(new Set(helpCommands.map((entry) => entry.usage)).size).toBe(helpCommands.length);
    expect(new Set(agentCommands.map((entry) => entry.name)).size).toBe(agentCommands.length);
    expect(helpCommands.every((entry) => entry.usage.startsWith('terrace '))).toBe(true);
    expect(agentCommands.every((entry) => entry.name.startsWith('terrace-') && entry.command.startsWith('terrace '))).toBe(true);
    expect(contracts).toHaveLength(projectedContracts.length);
    expect(contracts).toEqual(expect.arrayContaining(projectedContracts));

    const renderedHelp = renderCliHelp();
    for (const entry of helpCommands) {
      expect(renderedHelp).toContain(entry.usage);
    }
  });

  it('keeps compatibility-sensitive and formerly drifting surfaces explicit', () => {
    const catalog = listCommandCatalog();
    const ids = new Set(catalog.map((entry) => entry.id));
    const help = renderCliHelp();

    for (const id of [
      'port.gsd.compare',
      'port.gsd.verify-parity',
      'design-source.diff',
      'phase.plan.alias',
      'phase.execute.alias',
      'phase.validate.alias',
      'phase.review.alias',
      'phase.complete.alias'
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(help).toContain('terrace do <intent> | --apply <plan-token>');
    expect(help).toContain('terrace design-source diff <source> <feature> <ref>');
    expect(commandById('ship.check')?.variants).toContainEqual(expect.objectContaining({
      when: '--full',
      effect: 'executes_project'
    }));
    expect(listCommandContracts()).toContainEqual(expect.objectContaining({ command: 'terrace ship check --fast' }));
  });

  it('marks persistence-capable commands as write-capable and describes ship prepare accurately', () => {
    expect(commandById('rule.audit')).toMatchObject({ effect: 'write' });
    expect(commandById('debt.audit')).toMatchObject({ effect: 'write' });
    expect(commandById('policy')).toMatchObject({ effect: 'write' });
    expect(commandById('ship.prepare')?.agent?.description).toBe('Write a release-readiness summary; --fast skips project scripts but still writes the summary.');
  });

  it('owns explicit parser forms without treating display patterns as parser grammar', () => {
    const catalog = listCommandCatalog();
    expect(catalog.every((entry) => entry.dispatch && entry.dispatch.forms.length > 0)).toBe(true);
    expect(commandById('port.gsd.compare')?.dispatch).toMatchObject({
      owner: 'legacy',
      forms: [expect.objectContaining({
        literals: ['port', 'gsd'],
        required_flags: ['--compare'],
        priority: 400
      })]
    });
    expect(commandById('ship.check')?.dispatch?.forms).toContainEqual(expect.objectContaining({
      literals: ['ship'],
      match: 'exact'
    }));
  });

  it('renders routed intent argv as arrays from catalog-owned parameter shapes', () => {
    const catalog = listCommandCatalog();
    const intentCommandIds = listIntentCommands().map((intent) => intent.command_id);

    for (const id of intentCommandIds) {
      expect(catalog.find((entry) => entry.id === id)?.route_argv.length).toBeGreaterThan(0);
    }
    expect(renderCommandArgv('phase.plan', { phase_id: 'phase-11' })).toEqual(['phase', 'plan', 'phase-11']);
    expect(renderCommandArgv('workbench.status', { feature_id: null })).toEqual(['workbench', 'status']);
    expect(renderCommandArgv('workbench.prepare', { feature_id: 'billing', target: 'generic' })).toEqual([
      'workbench',
      'prepare',
      'billing',
      '--for',
      'generic'
    ]);
    expect(renderCommandArgv('quick.plan', { title: 'fix login; no shell interpolation' })).toEqual([
      'quick',
      'plan',
      'fix login; no shell interpolation'
    ]);
    expect(renderCommandArgv('blocker.resolve', {
      blocker_id: 'deploy-evidence',
      owner: 'release_operator',
      evidence: 'docs/release-evidence.md'
    })).toEqual([
      'blocker',
      'resolve',
      'deploy-evidence',
      '--owner',
      'release_operator',
      '--evidence',
      'docs/release-evidence.md'
    ]);
    expect(() => renderCommandArgv('phase.plan', {})).toThrow(/Missing route parameter phase_id/);
  });

  it('returns defensive projections instead of mutable catalog records', () => {
    const first = listCommandCatalog();
    const init = first.find((entry) => entry.id === 'init');
    const port = first.find((entry) => entry.id === 'port.gsd');

    expect(init).toBeDefined();
    expect(port).toBeDefined();
    init?.argv_pattern.push('mutated');
    if (init?.help) init.help.summary = 'mutated';
    port?.agent && (port.agent.template_id = 'mutated');
    init?.dispatch?.forms[0].literals.push('mutated');

    expect(commandById('init')?.argv_pattern).not.toContain('mutated');
    expect(commandById('init')?.help?.summary).not.toBe('mutated');
    expect(commandById('port.gsd')?.agent?.template_id).toBe('terrace-port-gsd');
    expect(commandById('init')?.dispatch?.forms[0].literals).not.toContain('mutated');
  });
});
