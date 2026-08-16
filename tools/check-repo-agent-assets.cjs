#!/usr/bin/env node
'use strict';

// Source-only parity check. It never invokes the Terrace CLI or writes assets.
const { execFileSync } = require('node:child_process');
const {
  repoGeneratedAssetStatus,
  repoGeneratedTemplateAssets
} = require('../packages/terrace-core/src/agents.cjs');

function sourceAssetTrackingStatus(cwd) {
  try {
    const isWorktree = execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim() === 'true';
    if (!isWorktree) {
      return { checked: false, untracked: [] };
    }
  } catch {
    return { checked: false, untracked: [] };
  }

  const sourcePaths = repoGeneratedTemplateAssets().map((asset) => asset.path);
  const trackedPaths = new Set(execFileSync('git', ['ls-files', '--', ...sourcePaths], {
    cwd,
    encoding: 'utf-8'
  }).split('\n').filter(Boolean));
  return {
    checked: true,
    untracked: sourcePaths.filter((assetPath) => !trackedPaths.has(assetPath))
  };
}

const status = repoGeneratedAssetStatus(process.cwd());
const tracking = sourceAssetTrackingStatus(process.cwd());
const complete = status.complete && tracking.untracked.length === 0;
const output = {
  scope: status.scope,
  expected_total: status.expected_total,
  current_count: status.current_count,
  missing_count: status.missing_count,
  stale_count: status.stale_count,
  missing: status.missing,
  stale: status.stale,
  source_tracking_checked: tracking.checked,
  untracked_source_assets: tracking.untracked,
  complete,
  remediation: complete
    ? null
    : status.remediation || 'Track every source-owned repo_generated asset before committing.'
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (!complete) {
  process.exitCode = 1;
}
