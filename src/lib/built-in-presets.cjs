'use strict';

const { installPreset } = require('./preset.cjs');

const BUILT_INS = {
  'terrace-tea': {
    id: 'terrace-tea',
    name: 'Terrace Test Effectiveness Analysis',
    version: '1.0',
    category: 'testing',
    effect: 'Read+Write',
    agents: ['terrace-test-architect'],
    workflows: ['test-architecture'],
    fragments: [],
    flags: [{ key: 'enabled', default: true }],
    commands: ['terrace preset install terrace-tea']
  },
  'terrace-mutation': {
    id: 'terrace-mutation',
    name: 'Terrace Mutation Testing',
    version: '1.0',
    category: 'testing',
    effect: 'Read+Write',
    agents: [],
    workflows: ['mutation-baseline'],
    fragments: [],
    flags: [{ key: 'enabled', default: true }],
    commands: ['terrace preset install terrace-mutation']
  },
  'terrace-ui': {
    id: 'terrace-ui',
    name: 'Terrace UI Governance',
    version: '1.0',
    category: 'frontend',
    effect: 'Read+Write',
    agents: [],
    workflows: ['ui-review'],
    fragments: [],
    flags: [{ key: 'enabled', default: true }],
    commands: ['terrace preset install terrace-ui']
  },
  'terrace-security': {
    id: 'terrace-security',
    name: 'Terrace Security Gate',
    version: '1.0',
    category: 'security',
    effect: 'Read-only',
    agents: [],
    workflows: ['security-check'],
    fragments: [],
    flags: [{ key: 'enabled', default: true }],
    commands: ['terrace security check']
  }
};

function installBuiltInPreset(cwd, id, options) {
  const manifest = BUILT_INS[id];
  if (!manifest) {
    throw new Error('Unknown built-in preset: ' + id);
  }
  return installPreset(cwd, manifest, options || {});
}

module.exports = {
  BUILT_INS,
  installBuiltInPreset
};
