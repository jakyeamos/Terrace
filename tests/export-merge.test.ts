import { describe, expect, it } from 'vitest';

const { mergeModuleExports } = require('../packages/terrace-core/src/export-merge.cjs') as {
  mergeModuleExports: (modules: Array<[string, Record<PropertyKey, unknown>]>) => Record<PropertyKey, unknown>;
};

describe('core export merge', () => {
  it('preserves compatible identity exports and root public contracts', () => {
    const shared = () => 'shared';
    expect(mergeModuleExports([
      ['first', { first: 1, shared }],
      ['second', { second: 2, shared }]
    ])).toEqual({ first: 1, shared, second: 2 });

    const core = require('../packages/terrace-core/src/index.cjs');
    expect(core).toMatchObject({
      initCore: expect.any(Function),
      listCommandContracts: expect.any(Function),
      WORKFLOW_COMMAND_CONTRACTS: expect.any(Array)
    });
    const contracts = require('../packages/terrace-core/src/command-contracts.cjs');
    expect(contracts.listCommandContracts).toBe(core.listCommandContracts);
  });

  it('preserves enumerable symbol and own __proto__ exports without changing the prototype', () => {
    const symbol = Symbol('symbol-export');
    const protoValue = { preserved: true };
    const first: Record<PropertyKey, unknown> = {};
    Object.defineProperty(first, symbol, { enumerable: true, value: 'symbol value' });
    Object.defineProperty(first, '__proto__', { enumerable: true, value: protoValue });

    const merged = mergeModuleExports([['first', first]]);

    expect(merged[symbol]).toBe('symbol value');
    expect(Object.getOwnPropertyDescriptor(merged, '__proto__')).toMatchObject({
      enumerable: true,
      value: protoValue
    });
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });

  it('fails loudly when two modules export different values under one key', () => {
    expect(() => mergeModuleExports([
      ['first', { duplicate: 'first' }],
      ['second', { duplicate: 'second' }]
    ])).toThrow('Terrace core export collision for "duplicate": first and second.');
  });
});
