'use strict';

const fs = require('fs');
const path = require('path');

function loadFragments(agentDir, options) {
  const tier = (options && options.tier) || 'core';
  const indexPath = path.resolve(agentDir, 'fragments', 'fragment-index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  const tierSets = {
    core: new Set(['core']),
    extended: new Set(['core', 'extended']),
    specialized: new Set(['core', 'extended', 'specialized']),
    all: new Set(['core', 'extended', 'specialized'])
  };
  const allowedTiers = tierSets[tier] || tierSets.core;
  const entries = index.fragments.filter((entry) => allowedTiers.has(entry.tier));

  let totalChars = 0;
  const contents = entries.map((entry) => {
    const fragPath = path.resolve(agentDir, 'fragments', entry.file);
    if (!fragPath.startsWith(path.resolve(agentDir) + path.sep) && fragPath !== path.resolve(agentDir)) {
      throw new Error('UNSAFE_PATH: fragment file escapes agent directory');
    }
    const content = fs.readFileSync(fragPath, 'utf8');
    totalChars += content.length;
    return content;
  });

  return {
    contents,
    tokenCount: Math.ceil(totalChars / 4)
  };
}

module.exports = {
  loadFragments
};
