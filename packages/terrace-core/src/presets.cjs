'use strict';

const path = require('path');
const { readJson, writeJson } = require('./json.cjs');

const VALID_CATEGORIES = ['governance', 'testing', 'frontend', 'security', 'integration'];
const VALID_EFFECTS = ['Read-only', 'Read+Write'];

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

function registryPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'presets', 'registry.json');
}

function policyPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'policy.json');
}

function readRegistry(cwd) {
  return readJson(registryPathFor(cwd), { version: '1.0', presets: [] });
}

function listPresets(cwd) {
  const registry = readRegistry(cwd);
  return Array.isArray(registry.presets) ? registry.presets : [];
}

function installPreset(cwd, manifest, options) {
  const opts = options || {};
  const force = Boolean(opts.force);

  if (!VALID_CATEGORIES.includes(manifest.category)) {
    throw new Error('Invalid preset category: ' + manifest.category);
  }
  if (!VALID_EFFECTS.includes(manifest.effect)) {
    throw new Error('Invalid preset effect: ' + manifest.effect);
  }

  const registry = readRegistry(cwd);
  if (!Array.isArray(registry.presets)) {
    registry.presets = [];
  }

  const index = registry.presets.findIndex((preset) => preset.id === manifest.id);
  if (index >= 0) {
    const existing = registry.presets[index];
    if (existing.version === manifest.version) {
      return { conflict: false, message: 'Preset already installed: ' + manifest.id };
    }
    if (!force) {
      return { conflict: true, message: 'Preset conflict for ' + manifest.id + ': existing version ' + existing.version + ', requested ' + manifest.version };
    }
  }

  const entry = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    category: manifest.category,
    effect: manifest.effect,
    agents: manifest.agents || [],
    workflows: manifest.workflows || [],
    fragments: manifest.fragments || [],
    flags: manifest.flags || [],
    commands: manifest.commands || [],
    installed_at: new Date().toISOString(),
    conflicts: []
  };

  if (index >= 0) {
    registry.presets[index] = entry;
  } else {
    registry.presets.push(entry);
  }
  writeJson(registryPathFor(cwd), registry);

  const policy = readJson(policyPathFor(cwd), {});
  if (!policy[manifest.id]) {
    policy[manifest.id] = {};
  }
  for (const flag of entry.flags) {
    policy[manifest.id][flag.key] = flag.default;
  }
  writeJson(policyPathFor(cwd), policy);

  return { conflict: false, message: 'Preset installed: ' + manifest.id };
}

function installBuiltInPreset(cwd, id, options) {
  const manifest = BUILT_INS[id];
  if (!manifest) {
    throw new Error('Unknown built-in preset: ' + id);
  }
  return installPreset(cwd, manifest, options || {});
}

module.exports = {
  BUILT_INS,
  installPreset,
  listPresets,
  installBuiltInPreset
};
