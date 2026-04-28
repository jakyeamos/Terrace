'use strict';

const fs = require('fs');
const path = require('path');
const { createDefaultState, saveState } = require('./state.cjs');
const { detectCommands, writeConfig } = require('./config.cjs');
const { appendEvent } = require('./events.cjs');
const { defaultRuleFiles, writeDefaultRules } = require('./rules.cjs');

function ensureDir(cwd, relPath, created) {
  const fullPath = path.resolve(cwd, relPath);
  fs.mkdirSync(fullPath, { recursive: true });
  created.push(relPath);
}

function initCore(cwd, options) {
  const opts = options || {};
  const created = [];
  const state = createDefaultState({ projectName: opts.projectName || path.basename(cwd) });
  saveState(cwd, state);
  created.push('.terrace/state.json');

  writeConfig(cwd, {
    schema_version: '1.0',
    commands: detectCommands(cwd),
    pentest_authorized: false,
    execution_policy: {
      default_mode: 'strict',
      allow_low_effort: true
    }
  });
  created.push('.terrace/config.json');

  const presetRegistryPath = path.resolve(cwd, '.terrace', 'presets', 'registry.json');
  fs.mkdirSync(path.dirname(presetRegistryPath), { recursive: true });
  fs.writeFileSync(presetRegistryPath, JSON.stringify({ version: '1.0', presets: [] }, null, 2) + '\n', 'utf8');
  created.push('.terrace/presets/registry.json');

  ensureDir(cwd, 'docs/prd', created);
  ensureDir(cwd, 'docs/spec', created);
  ensureDir(cwd, 'docs/testing', created);

  writeDefaultRules(cwd);
  for (const relPath of defaultRuleFiles()) {
    created.push(relPath);
  }

  appendEvent(cwd, {
    command: 'terrace init',
    from_state: 'uninitialized',
    to_state: 'initialized',
    evidence_refs: ['.terrace/state.json', '.terrace/config.json']
  });
  created.push('.terrace/events.jsonl');

  return { created };
}

module.exports = {
  initCore
};
