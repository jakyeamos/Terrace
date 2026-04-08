'use strict';

const path = require('path');
const { readJson, writeJson } = require('./core.cjs');

const VALID_CATEGORIES = ['governance', 'testing', 'frontend', 'security', 'integration'];
const VALID_EFFECTS = ['Read-only', 'Read+Write'];

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

module.exports = {
  installPreset,
  listPresets
};
