import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const { runSecurityCheck, securityShipCheck } = require('../packages/terrace-core/src/index.cjs') as {
  runSecurityCheck: (cwd: string) => { status: string; dependency_audit?: { package_manager: string; file: string; lockfile_present: boolean; status?: string }; evidence?: { schema_version: number; input_fingerprint: string; scope: { complete: boolean } }; findings: Array<{ id: string; file_or_artifact?: string; evidence?: string }>; blocking: Array<{ id: string }>; warnings: Array<{ id: string; file_or_artifact?: string; evidence?: string }> };
  securityShipCheck: (cwd: string, options?: { now?: number; maxAgeMs?: number }) => { passed: boolean; blocking: Array<{ code?: string }>; warnings: Array<{ code?: string }> };
};

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

function genericSecretAssignment(name: string): string {
  return [name, '=', '"12345678901234567890"'].join('');
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
    fs.writeFileSync(path.join(tmpDir, '.env'), genericSecretAssignment('API_TOKEN') + '\n', 'utf-8');

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

  it('requires current security evidence without writing during ship check', () => {
    const missing = securityShipCheck(tmpDir);
    expect(missing.passed).toBe(false);
    expect(missing.blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_REQUIRED' }));
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'security', 'latest.json'))).toBe(false);

    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:22-alpine\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.dockerignore'), '.env\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules\n', 'utf-8');
    const written = runSecurityCheck(tmpDir);
    expect(written.status).toBe('passed');
    expect(written.evidence).toMatchObject({
      schema_version: 1,
      input_fingerprint: expect.any(String),
      scope: { complete: true }
    });
    const recordedArtifact = path.join(tmpDir, '.terrace', 'security', 'latest.json');
    const recordedContents = fs.readFileSync(recordedArtifact, 'utf-8');
    expect(securityShipCheck(tmpDir).passed).toBe(true);
    expect(fs.readFileSync(recordedArtifact, 'utf-8')).toBe(recordedContents);

    fs.appendFileSync(path.join(tmpDir, 'Dockerfile'), 'USER node\n', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));
    expect(runSecurityCheck(tmpDir).status).toBe('passed');

    fs.appendFileSync(path.join(tmpDir, '.dockerignore'), 'secrets\n', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));
    expect(runSecurityCheck(tmpDir).status).toBe('passed');

    fs.appendFileSync(path.join(tmpDir, '.gitignore'), 'generated-source.js\n', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));
    expect(runSecurityCheck(tmpDir).status).toBe('passed');

    const artifact = recordedArtifact;
    const expired = JSON.parse(fs.readFileSync(artifact, 'utf-8'));
    expired.created_at = new Date(Date.now() - 2000).toISOString();
    expired.evidence.created_at = expired.created_at;
    fs.writeFileSync(artifact, JSON.stringify(expired), 'utf-8');
    expect(securityShipCheck(tmpDir, { maxAgeMs: 1000 }).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));
    expect(runSecurityCheck(tmpDir).status).toBe('passed');

    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }) + '\n', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));
    fs.rmSync(path.join(tmpDir, 'package-lock.json'));
    expect(runSecurityCheck(tmpDir).status).toBe('passed');

    fs.appendFileSync(path.join(tmpDir, 'src', 'index.js'), 'export const changed = true;\n', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_STALE' }));

    fs.mkdirSync(path.join(tmpDir, '.terrace', 'security'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'security', 'latest.json'), JSON.stringify({ status: 'passed', blocking: [] }), 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_LEGACY' }));

    fs.writeFileSync(path.join(tmpDir, '.env'), genericSecretAssignment('API_TOKEN') + '\n', 'utf-8');
    expect(runSecurityCheck(tmpDir).status).toBe('blocked');
    const blocked = securityShipCheck(tmpDir);
    expect(blocked.passed).toBe(false);
    expect(blocked.blocking.length).toBeGreaterThan(0);

    fs.writeFileSync(path.join(tmpDir, '.terrace', 'security', 'latest.json'), '{', 'utf-8');
    expect(securityShipCheck(tmpDir).blocking).toContainEqual(expect.objectContaining({ code: 'SECURITY_CHECK_INVALID' }));
  });

  it('prioritizes runtime source ahead of large documentation inventories', () => {
    const docsDir = path.join(tmpDir, 'docs', 'fixtures');
    fs.mkdirSync(docsDir, { recursive: true });
    for (let index = 0; index < 1005; index += 1) {
      fs.writeFileSync(path.join(docsDir, 'note-' + String(index).padStart(4, '0') + '.md'), '# Fixture\n', 'utf-8');
    }
    fs.writeFileSync(path.join(tmpDir, 'src', 'late-runtime.js'), 'const ' + genericSecretAssignment('api_key') + ';\n', 'utf-8');

    const result = runSecurityCheck(tmpDir);

    expect(result.evidence).toMatchObject({ scope: { complete: true } });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: expect.stringContaining('SECRET_GENERIC_ASSIGNMENT'),
      file_or_artifact: 'src/late-runtime.js'
    }));
  }, 120000);

  it('uses pnpm lockfiles for dependency audit evidence', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    packageJson.packageManager = 'pnpm@11.7.0';
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n', 'utf-8');

    const result = runSecurityCheck(tmpDir);

    expect(result.dependency_audit).toMatchObject({
      package_manager: 'pnpm',
      file: 'pnpm-lock.yaml',
      lockfile_present: true
    });
  });

  it('fails closed when dependency audit returns a JSON error payload', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    packageJson.packageManager = 'pnpm@11.7.0';
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n', 'utf-8');
    const binDir = path.join(tmpDir, 'fake-bin');
    fs.mkdirSync(binDir, { recursive: true });
    const fakePnpm = path.join(binDir, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
    const fakeProgram = process.platform === 'win32'
      ? '@echo {"error":"registry unavailable"}\r\n@exit /b 1\r\n'
      : '#!' + process.execPath + '\nprocess.stdout.write(\'{"error":"registry unavailable"}\\n\'); process.exit(1);\n';
    fs.writeFileSync(fakePnpm, fakeProgram, 'utf-8');
    if (process.platform !== 'win32') {
      fs.chmodSync(fakePnpm, 0o755);
    }
    const originalPath = process.env.PATH;
    process.env.PATH = binDir + path.delimiter + (originalPath || '');
    const result = (() => {
      try {
        return runSecurityCheck(tmpDir);
      } finally {
        if (originalPath === undefined) {
          delete process.env.PATH;
        } else {
          process.env.PATH = originalPath;
        }
      }
    })();

    expect(result.status).toBe('blocked');
    expect(result.dependency_audit).toMatchObject({ status: 'unavailable' });
    expect(result.blocking).toContainEqual(expect.objectContaining({ code: 'PNPM_AUDIT_UNAVAILABLE' }));
  });

  it('does not scan or fingerprint source through repository symlinks', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-security-outside-'));
    const outsideFile = path.join(outside, 'secret.js');
    fs.writeFileSync(outsideFile, 'const ' + genericSecretAssignment('api_key') + ';\n', 'utf-8');
    const link = path.join(tmpDir, 'src', 'outside-secret.js');
    try {
      fs.symlinkSync(outsideFile, link);
      const result = runSecurityCheck(tmpDir);

      expect(result.findings).not.toContainEqual(expect.objectContaining({
        code: expect.stringContaining('SECRET_GENERIC_ASSIGNMENT'),
        file_or_artifact: 'src/outside-secret.js'
      }));
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
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
  }, 120000);

  it('includes security in ship check categories', () => {
    runTerrace(tmpDir, ['align', 'billing-refresh', '--tier', 'small', '--json']);
    const result = spawnSync(NODE_BIN, [TERRACE_CLI, 'ship', 'check', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(result.stdout);

    expect(parsed.categories).toContainEqual(expect.objectContaining({
      category: 'security',
      command: 'terrace security check'
    }));
  }, 120000);
});
