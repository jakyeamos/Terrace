'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Load knowledge fragments for a governance agent.
 * @param {string} agentDir - Absolute path to agent skill directory
 * @param {{ tier: 'core' | 'extended' | 'specialized' | 'all' }} options
 * @returns {{ contents: string[], tokenCount: number }}
 */
function loadFragments(agentDir, options) {
  const tier = (options && options.tier) || 'core';
  const indexPath = path.resolve(agentDir, 'fragments', 'fragment-index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

  const entries = index.fragments.filter(function (e) {
    return tier === 'all' ? true : e.tier === tier;
  });

  let totalChars = 0;
  const contents = entries.map(function (entry) {
    const fragPath = path.resolve(agentDir, 'fragments', entry.file);
    // Path traversal guard (T-02-05)
    if (!fragPath.startsWith(path.resolve(agentDir) + path.sep) &&
        fragPath !== path.resolve(agentDir)) {
      throw new Error('UNSAFE_PATH: fragment file escapes agent directory');
    }
    const content = fs.readFileSync(fragPath, 'utf-8');
    totalChars += content.length;
    return content;
  });

  return {
    contents,
    tokenCount: Math.ceil(totalChars / 4)
  };
}

module.exports = { loadFragments };
