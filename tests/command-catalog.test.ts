import { describe, expect, it } from 'vitest';

type CatalogCommand = {
  id: string;
  argv_pattern: string[];
  help: { usage: string; summary: string } | null;
  agent: { template_id: string; invocation: string } | null;
  variants: Array<{ when: string; effect: string }>;
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
  renderCliHelp,
  validateCommandCatalog
} = require('../packages/terrace-core/src/index.cjs') as {
  commandById: (id: string) => CatalogCommand | null;
  listAgentCommands: () => Array<{ name: string; command: string; help?: string }>;
  listCommandCatalog: () => CatalogCommand[];
  listCommandContracts: () => Contract[];
  listHelpCommands: () => Array<{ id: string; usage: string; summary: string }>;
  renderCliHelp: () => string;
  validateCommandCatalog: () => {
    valid: boolean;
    duplicate_ids: string[];
    duplicate_agent_names: string[];
    missing_contract_commands: string[];
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
      missing_contract_commands: []
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

  it('returns defensive projections instead of mutable catalog records', () => {
    const first = listCommandCatalog();
    const init = first.find((entry) => entry.id === 'init');
    const port = first.find((entry) => entry.id === 'port.gsd');

    expect(init).toBeDefined();
    expect(port).toBeDefined();
    init?.argv_pattern.push('mutated');
    if (init?.help) init.help.summary = 'mutated';
    port?.agent && (port.agent.template_id = 'mutated');

    expect(commandById('init')?.argv_pattern).not.toContain('mutated');
    expect(commandById('init')?.help?.summary).not.toBe('mutated');
    expect(commandById('port.gsd')?.agent?.template_id).toBe('terrace-port-gsd');
  });
});
