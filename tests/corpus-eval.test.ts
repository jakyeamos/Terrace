import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  agentAssetExpectations,
  templateAssets
} = require('../packages/terrace-core/src/agents.cjs');
const {
  classifyAgentAssetVerification,
  repairMigratedAgentAssets,
  renderReport,
  summarize
} = require('../scripts/terrace-corpus-eval.cjs');

describe('terrace corpus evaluation helpers', () => {
  it('derives agent asset expectations from generated bootstrap assets', () => {
    const assets = templateAssets();

    expect(agentAssetExpectations()).toEqual({
      codexSkills: assets.filter((asset: { type: string }) => asset.type === 'codex-skill').length,
      claudeSkills: assets.filter((asset: { type: string }) => asset.type === 'claude-skill').length,
      claudeCommands: assets.filter((asset: { type: string }) => asset.type === 'claude-command').length
    });
  });

  it('treats migrated-GSD repos with no agent assets as not applicable', () => {
    expect(classifyAgentAssetVerification('migrated-gsd', {
      present: false,
      complete: false
    })).toMatchObject({
      classification: 'not-applicable',
      skipped: true
    });
  });

  it('treats migrated-GSD repos with partial agent assets as an expected blocker', () => {
    expect(classifyAgentAssetVerification('migrated-gsd', {
      present: true,
      complete: false
    })).toMatchObject({
      classification: 'expected-blocker',
      skipped: false,
      remediation: 'Run terrace init in the migrated worktree to install missing non-overwriting agent assets.'
    });
  });

  it('repairs partial migrated-GSD agent assets before final verification', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-corpus-agent-repair-'));
    try {
      fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'), '# terrace-next\n', 'utf-8');
      const fakeTerrace = path.join(tmpDir, 'fake-terrace.cjs');
      fs.writeFileSync(fakeTerrace, [
        '#!/usr/bin/env node',
        "const { initCore } = require('" + path.resolve(process.cwd(), 'packages/terrace-core/src/index.cjs') + "');",
        "initCore(process.cwd(), { projectName: 'Agent Repair Fixture' });",
        "process.stdout.write(JSON.stringify({ ok: true }) + '\\n');"
      ].join('\n') + '\n', 'utf-8');
      fs.chmodSync(fakeTerrace, 0o755);

      const repair = repairMigratedAgentAssets({
        track: 'migrated-gsd',
        worktree: tmpDir,
        terraceBin: fakeTerrace,
        timeoutMs: 30000,
        npmCache: path.join(tmpDir, 'npm-cache')
      }, {
        present: true,
        complete: false
      });

      expect(repair).toMatchObject({
        command: 'terrace init --json',
        exitCode: 0,
        jsonValid: true
      });
      expect(classifyAgentAssetVerification('migrated-gsd', require('../scripts/terrace-corpus-eval.cjs').verifyAgentAssets(tmpDir))).toMatchObject({
        classification: 'pass',
        skipped: false
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('keeps scratch tracks strict when agent assets are incomplete', () => {
    expect(classifyAgentAssetVerification('scratch-real', {
      present: true,
      complete: false
    })).toMatchObject({
      classification: 'product-weakness',
      skipped: false
    });
  });

  it('renders product weaknesses separately from expected blockers', () => {
    const records = [
      {
        repo: 'demo',
        repoType: 'node',
        track: 'scratch-real',
        key: 'port-gsd-verify-parity',
        category: 'migration',
        classification: 'product-weakness',
        skipped: false,
        stdout: '{"passed":false}',
        stderr: '',
        score: { total: 40 }
      },
      {
        repo: 'demo',
        repoType: 'node',
        track: 'scratch-real',
        key: 'prd-import-overwrite-refusal',
        category: 'scratch-intake',
        classification: 'expected-blocker',
        skipped: false,
        stdout: '{"error":"Refusing to overwrite"}',
        stderr: '',
        score: { total: 30 }
      },
      {
        repo: 'demo',
        repoType: 'node',
        track: 'scratch-real',
        key: 'prd-import-overwrite-refusal',
        category: 'scratch-intake',
        classification: 'expected-blocker',
        skipped: false,
        stdout: '{"error":"Refusing to overwrite"}',
        stderr: '',
        score: { total: 30 }
      }
    ];

    const summary = summarize(records, {
      runId: 'test-run',
      evidenceDir: process.cwd()
    });
    const report = renderReport(summary, records, 'test-run');

    expect(summary.improvementBacklog.map((item: { command: string }) => item.command)).toEqual(['port-gsd-verify-parity']);
    expect(report).toContain('## Product Weaknesses');
    expect(report).toContain('## Expected Blockers / Ergonomics Watchlist');
    expect(report).toContain('`port-gsd-verify-parity`: `demo` / `scratch-real` / `product-weakness`');
    expect(report).toContain('`prd-import-overwrite-refusal`: `demo` / `scratch-real` / `expected-blocker`');
  });
});
