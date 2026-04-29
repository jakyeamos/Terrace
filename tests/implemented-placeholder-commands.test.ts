import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const { runSecurityCheck, securityShipCheck } = require('../packages/terrace-core/src/index.cjs') as {
  runSecurityCheck: (cwd: string) => { status: string; blocking: Array<{ id: string }>; warnings: Array<{ id: string }> };
  securityShipCheck: (cwd: string) => { passed: boolean; blocking: Array<{ code?: string }>; warnings: Array<{ code?: string }> };
};

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

describe('implemented placeholder command behavior', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-implemented-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        test: 'node --test',
        lint: 'node --check src/index.js'
      },
      dependencies: {
        express: '4.18.2'
      }
    }, null, 2), 'utf-8');
    fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src', 'app', 'api', 'billing'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'export const ok = true;\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'components', 'BillingPanel.tsx'), 'export function BillingPanel() { return null; }\n', 'utf-8');
    const sensitiveLogFixture = ['console', '.', 'log("to', 'ken", request.headers.auth', 'orization);\n'].join('');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app', 'api', 'billing', 'route.ts'), sensitiveLogFixture, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'billing.test.js'), 'import test from "node:test";\ntest("billing", () => {});\n', 'utf-8');
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs security checks and writes Terrace security evidence', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'API_TOKEN="12345678901234567890"\n', 'utf-8');

    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'security', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(parsed.status).toBe('blocked');
    expect(parsed.status).not.toBe('not_configured');
    expect(parsed.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'blocking' })
    ]));
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'security', 'latest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'security', 'SECURITY-CHECK.md'))).toBe(true);
  });

  it('evaluates security ship evidence without writing during ship check', () => {
    const missing = securityShipCheck(tmpDir);
    expect(missing.passed).toBe(true);
    expect(missing.warnings).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_MISSING' }));

    fs.writeFileSync(path.join(tmpDir, '.env'), 'API_TOKEN="12345678901234567890"\n', 'utf-8');
    const written = runSecurityCheck(tmpDir);
    const blocked = securityShipCheck(tmpDir);
    expect(written.status).toBe('blocked');
    expect(blocked.passed).toBe(false);
    expect(blocked.blocking.length).toBeGreaterThan(0);

    fs.writeFileSync(path.join(tmpDir, '.terrace', 'security', 'latest.json'), '{', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_INVALID' }));
  });

  it('generates static and imported review findings with the stable schema', () => {
    runTerrace(tmpDir, ['security', 'check', '--json']);
    const staticReview = runTerrace(tmpDir, ['review', 'ai', '--mode', 'security', '--feature', 'billing-refresh', '--json']);

    expect(staticReview.source).toBe('static');
    expect(staticReview.findings[0]).toEqual(expect.objectContaining({
      mode: 'security',
      file_or_artifact: expect.any(String),
      claim: expect.any(String),
      evidence: expect.any(String),
      recommended_fix: expect.any(String),
      source: expect.any(String)
    }));

    const importPath = path.join(tmpDir, 'external-review.json');
    fs.writeFileSync(importPath, JSON.stringify({
      findings: [{
        id: 'external-1',
        severity: 'high',
        file: 'src/index.js',
        message: 'External reviewer found a release blocker.',
        remediation: 'Fix the blocker.'
      }]
    }), 'utf-8');

    const imported = runTerrace(tmpDir, ['review', 'ai', '--mode', 'release', '--feature', 'billing-refresh', '--from', 'external-review.json', '--json']);

    expect(imported.source).toBe('import');
    expect(imported.findings).toContainEqual(expect.objectContaining({
      id: 'external-1',
      classification: 'blocking',
      source: 'import'
    }));
  });

  it('writes concrete codebase, docs, backfill, workstream, and UI artifacts', () => {
    const map = runTerrace(tmpDir, ['map-codebase', '--json']);
    const docs = runTerrace(tmpDir, ['docu', 'billing-refresh', '--type', 'runbook', '--json']);
    const backfill = runTerrace(tmpDir, ['backfill', '--feature', 'billing-refresh', '--json']);
    const workstreams = runTerrace(tmpDir, ['workstreams', 'plan', 'billing-refresh', '--json']);
    const design = runTerrace(tmpDir, ['design-source', 'import', 'figma', 'billing-refresh', 'figma://file/abc', '--json']);

    const mapText = fs.readFileSync(path.join(tmpDir, map.artifacts[0]), 'utf-8');
    const docsText = fs.readFileSync(path.join(tmpDir, docs.artifact), 'utf-8');
    const backfillText = fs.readFileSync(path.join(tmpDir, backfill.artifact), 'utf-8');
    const designText = fs.readFileSync(path.join(tmpDir, design.artifacts.spec), 'utf-8');

    expect(mapText).toContain('src/app/api/billing/route.ts');
    expect(docsText).toContain('Changed files:');
    expect(backfillText).toContain('Current Violations');
    expect(designText).toContain('BillingPanel.tsx');
    expect(workstreams.lanes).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: 'frontend', owned_files: expect.arrayContaining(['src/components/BillingPanel.tsx']) })
    ]));
    expect(mapText + docsText + backfillText + designText).not.toContain('TODO');
  }, 10000);

  it('includes security in ship check categories', () => {
    runTerrace(tmpDir, ['align', 'billing-refresh', '--tier', 'small', '--json']);
    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'ship', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.categories).toContainEqual(expect.objectContaining({
      category: 'security',
      command: 'terrace security check'
    }));
  }, 10000);
});
