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

describe('agent production lifecycle phase 1 commands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-agent-lifecycle-'));
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates and reads a Tier One report card without mutating on plain report', () => {
    const updated = runTerrace(tmpDir, ['report', 'update', '--json']);

    expect(updated.artifact).toBe('.terrace/report-card.json');
    expect(updated.docs_ref).toBe('docs/terrace/REPORT-CARD.md');
    expect(updated.history_ref).toMatch(/^docs\/terrace\/report-history\/.+\.md$/);
    expect(updated.report_card.checks).toEqual(expect.any(Array));
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'report-card.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'REPORT-CARD.md'))).toBe(true);

    const before = fs.statSync(path.join(tmpDir, '.terrace', 'report-card.json')).mtimeMs;
    const read = runTerrace(tmpDir, ['report', '--json']);
    const after = fs.statSync(path.join(tmpDir, '.terrace', 'report-card.json')).mtimeMs;

    expect(read.report_card.score).toBe(updated.report_card.score);
    expect(after).toBe(before);
    expect(runTerrace(tmpDir, ['report', 'history', '--json']).items).toContain(updated.history_ref);
  });

  it('creates preflight and handoff artifacts for context transfer', () => {
    runTerrace(tmpDir, ['align', 'billing-refresh', '--json']);
    const preflight = runTerrace(tmpDir, ['preflight', 'billing-refresh', '--mode', 'init', '--json']);
    const handoff = runTerrace(tmpDir, ['handoff', 'create', '--feature', 'billing-refresh', '--for', 'codex', '--json']);

    expect(preflight).toMatchObject({
      feature_id: 'billing-refresh',
      mode: 'init',
      artifact: 'docs/terrace/features/billing-refresh/PREFLIGHT.md'
    });
    expect(handoff.feature_id).toBe('billing-refresh');
    expect(handoff.target).toBe('codex');
    expect(handoff.artifacts.markdown).toMatch(/^docs\/terrace\/handoffs\/.+-billing-refresh\.md$/);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'billing-refresh', 'PREFLIGHT.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, handoff.artifacts.markdown))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, handoff.artifacts.json))).toBe(true);
  }, 20000);

  it('tracks debt, audits blocking metadata, and resolves entries', () => {
    const added = runTerrace(tmpDir, ['debt', 'add', 'billing-refresh', '--json']);
    expect(added.entry).toMatchObject({
      id: 'debt-1',
      feature_id: 'billing-refresh',
      status: 'open'
    });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'billing-refresh', 'DEBT.md'))).toBe(true);

    const audit = runTerrace(tmpDir, ['debt', 'audit', '--json']);
    expect(audit.passed).toBe(false);
    expect(audit.blockers).toContainEqual(expect.objectContaining({ code: 'DEBT_OWNER_REQUIRED' }));

    const resolved = runTerrace(tmpDir, ['debt', 'resolve', 'debt-1', '--json']);
    expect(resolved.entry.status).toBe('resolved');
    expect(runTerrace(tmpDir, ['debt', 'audit', '--json']).passed).toBe(true);
  });

  it('feeds preflight, debt, and report categories into ship check', () => {
    runTerrace(tmpDir, ['align', 'billing-refresh', '--json']);
    runTerrace(tmpDir, ['preflight', 'billing-refresh', '--json']);
    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'ship', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.categories).toContainEqual(expect.objectContaining({ category: 'tier_one_report' }));
    expect(parsed.categories).toContainEqual(expect.objectContaining({ category: 'production_preflight' }));
    expect(parsed.categories).toContainEqual(expect.objectContaining({ category: 'debt' }));
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'report-card.json'))).toBe(true);
  }, 15000);

  it('runs ship check without writing report artifacts', () => {
    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'ship', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.categories).toContainEqual(expect.objectContaining({ category: 'tier_one_report' }));
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'report-card.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'REPORT-CARD.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'report-history'))).toBe(false);
  }, 15000);
});
