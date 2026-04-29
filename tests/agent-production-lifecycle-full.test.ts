import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

describe('agent production lifecycle full command surface', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-agent-full-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        test: 'node --test'
      }
    }), 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'sample.test.js'), 'import test from "node:test";\ntest("sample", () => {});\n', 'utf-8');
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes documentation and test evaluation artifacts', () => {
    const docs = runTerrace(tmpDir, ['docu', 'billing-refresh', '--type', 'runbook', '--json']);
    const testEval = runTerrace(tmpDir, ['test', 'eval', '--feature', 'billing-refresh', '--changed', '--json']);

    expect(docs).toMatchObject({
      feature_id: 'billing-refresh',
      type: 'runbook',
      artifact: 'docs/terrace/features/billing-refresh/RUNBOOK.md'
    });
    expect(testEval).toMatchObject({
      feature_id: 'billing-refresh',
      changed_only: true,
      artifact: 'docs/testing/TEST-EVAL.md'
    });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'billing-refresh', 'RUNBOOK.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'testing', 'TEST-EVAL.md'))).toBe(true);
  });

  it('supports interrogation modes and structured AI reviews', () => {
    const adjust = runTerrace(tmpDir, ['interrogate', 'adjust', 'billing-refresh', '--json']);
    const review = runTerrace(tmpDir, ['review', 'ai', '--mode', 'security', '--feature', 'billing-refresh', '--json']);

    expect(adjust).toMatchObject({
      feature_id: 'billing-refresh',
      mode: 'adjust',
      artifact: 'docs/terrace/features/billing-refresh/ADJUSTMENT.md'
    });
    expect(review).toMatchObject({
      feature_id: 'billing-refresh',
      mode: 'security',
      artifact: 'docs/terrace/reviews/billing-refresh/security.json'
    });
    expect(review.findings[0]).toMatchObject({
      mode: 'security',
      classification: 'warning'
    });
  });

  it('authors rules, audits them, and writes backfill specs without mutating code', () => {
    const rule = runTerrace(tmpDir, ['rule', 'add', 'typescript', 'no-any-production', '--json']);
    const alias = runTerrace(tmpDir, ['add', 'rule', 'security', 'no-token-logs', '--json']);
    const audit = runTerrace(tmpDir, ['rule', 'audit', '--json']);
    const backfill = runTerrace(tmpDir, ['backfill', '--rule', 'no-any-production', '--since', 'HEAD~1', '--feature', 'billing-refresh', '--json']);

    expect(rule.artifact).toBe('.terrace/rules/typescript/no-any-production.json');
    expect(alias.artifact).toBe('.terrace/rules/security/no-token-logs.json');
    expect(audit.rule_count).toBeGreaterThanOrEqual(2);
    expect(audit.blockers).toContainEqual(expect.objectContaining({ code: 'RULE_OWNER_REQUIRED' }));
    expect(backfill).toMatchObject({
      rule: 'no-any-production',
      since: 'HEAD~1',
      feature_id: 'billing-refresh',
      mutates_code: false
    });
    expect(backfill.artifact).toMatch(/^docs\/terrace\/backfill\/.+-BACKFILL-SPEC\.md$/);
  });

  it('normalizes design sources and plans risk-based workstreams', () => {
    const imported = runTerrace(tmpDir, ['design-source', 'import', 'figma', 'settings-refresh', 'figma://file/abc', '--json']);
    const diff = runTerrace(tmpDir, ['design-source', 'diff', 'existing-ui', 'settings-refresh', '/settings', '--json']);
    const workstreams = runTerrace(tmpDir, ['workstreams', 'plan', 'settings-refresh', '--json']);

    expect(imported.artifacts).toMatchObject({
      spec: 'docs/terrace/features/settings-refresh/UI-SPEC.md',
      assets: 'docs/terrace/features/settings-refresh/UI-ASSETS.md',
      verify: 'docs/terrace/features/settings-refresh/UI-VERIFY.md'
    });
    expect(diff.artifact).toBe('docs/terrace/features/settings-refresh/UI-DIFF.md');
    expect(workstreams.json_ref).toBe('.terrace/workstreams/settings-refresh.json');
    expect(workstreams.lanes.map((lane: { lane: string }) => lane.lane)).toContain('data/migrations');
  });

  it('adds all production lifecycle categories to ship check', () => {
    runTerrace(tmpDir, ['align', 'billing-refresh', '--tier', 'large', '--json']);
    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'ship', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const ship = JSON.parse(result.stdout);

    expect(ship.categories.map((category: { category: string }) => category.category)).toEqual(expect.arrayContaining([
      'tier_one_report',
      'production_preflight',
      'ai_review',
      'debt',
      'documentation',
      'test_eval',
      'rule_audit'
    ]));
  }, 20000);
});
