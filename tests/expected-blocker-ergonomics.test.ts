import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

const {
  discoverProjectCommands,
  initCore,
  runDoctor,
  runSecurityCheck,
  securityShipCheck
} = require('../packages/terrace-core/src/index.cjs');

function runTerrace(tmpDir: string, args: string[]) {
  const result = spawnSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: result.stdout.trim().startsWith('{') ? JSON.parse(result.stdout) : null
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
}

describe('expected blocker ergonomics', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-blocker-ux-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns actionable JSON and human next steps for PRD overwrite refusal', () => {
    runTerrace(tmpDir, ['init', '--json']);
    fs.writeFileSync(path.join(tmpDir, 'feature-prd.md'), '# Saved Search\n', 'utf-8');
    expect(runTerrace(tmpDir, ['prd', 'import', 'saved-search', '--file', 'feature-prd.md', '--json']).status).toBe(0);

    const jsonResult = runTerrace(tmpDir, ['prd', 'import', 'saved-search', '--file', 'feature-prd.md', '--json']);
    expect(jsonResult.status).toBe(1);
    expect(jsonResult.json).toMatchObject({
      error: expect.stringContaining('Refusing to overwrite docs/terrace/features/saved-search/PRD.md'),
      details: {
        code: 'PRD_OVERWRITE_REFUSED',
        file: 'docs/terrace/features/saved-search/PRD.md',
        next_command: 'terrace prd import saved-search --file <file> --force'
      },
      next_command: 'terrace prd import saved-search --file <file> --force'
    });

    const humanResult = runTerrace(tmpDir, ['prd', 'import', 'saved-search', '--file', 'feature-prd.md']);
    expect(humanResult.stderr).toContain('Next: terrace prd import saved-search --file <file> --force');
    expect(humanResult.stderr).toContain('File: docs/terrace/features/saved-search/PRD.md');
  });

  it('adds exact guidance to spec validation blockers', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), '# PRD\n\n## actors\n- User\n', 'utf-8');

    const result = runTerrace(tmpDir, ['spec', 'validate', '--json']);

    expect(result.status).toBe(1);
    expect(result.json.blocking[0]).toMatchObject({
      code: 'MISSING_REQUIRED_SECTION',
      section: 'problem',
      why_blocked: expect.stringContaining('governance artifact'),
      next_command: 'terrace interrogate <feature>',
      remediation: expect.stringContaining('terrace spec validate')
    });
  });

  it('refuses to complete interrogation without user input and returns questions for the agent to ask', () => {
    const result = runTerrace(tmpDir, ['interrogate', 'billing-refresh', '--json']);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      error: 'INTERROGATION_REQUIRES_USER_INPUT',
      details: {
        code: 'INTERROGATION_REQUIRES_USER_INPUT',
        feature_id: 'billing-refresh',
        mode: 'init',
        questions: expect.arrayContaining([
          expect.stringContaining('What user workflow or business outcome')
        ]),
        remediation: expect.stringContaining('Ask the user these questions')
      }
    });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'billing-refresh', 'INTERROGATION.md'))).toBe(false);
  });

  it('summarizes ship-check blockers with next and recheck commands', () => {
    initCore(tmpDir, { projectName: 'Ship UX' });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), '# PRD\n', 'utf-8');

    const result = runTerrace(tmpDir, ['ship', 'check', '--fast', '--json']);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      passed: false,
      top_blockers: expect.any(Array),
      next_command: expect.any(String),
      recheck_command: 'terrace ship check --fast'
    });
    expect(result.json.blockers[0]).toEqual(expect.objectContaining({
      next_command: expect.any(String),
      remediation: expect.any(String)
    }));
  });

  it('gives report ceremony cleanup guidance', () => {
    initCore(tmpDir, { projectName: 'Report UX' });
    fs.mkdirSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'demo', 'NOTES.md'), '# Notes\n\nTODO\n', 'utf-8');

    const result = runTerrace(tmpDir, ['report', 'ceremony', '--json']);

    expect(result.status).toBe(1);
    expect(result.json).toMatchObject({
      passed: false,
      next_command: expect.any(String),
      warnings: expect.arrayContaining([
        expect.objectContaining({
          code: 'LOW_DENSITY_ARTIFACT',
          file: 'docs/terrace/features/demo/NOTES.md',
          next_command: expect.any(String),
          remediation: expect.stringContaining('terrace report ceremony')
        })
      ])
    });
  });

  it('distinguishes missing security evidence from blocked security findings', () => {
    initCore(tmpDir, { projectName: 'Security UX' });

    expect(securityShipCheck(tmpDir).warnings[0]).toMatchObject({
      code: 'SECURITY_CHECK_MISSING',
      next_command: 'terrace security check',
      why_blocked: expect.stringContaining('security evidence')
    });

    fs.writeFileSync(path.join(tmpDir, '.env'), 'api_key="12345678901234567890"\n', 'utf-8');
    const check = runSecurityCheck(tmpDir);
    expect(check.status).toBe('blocked');
    expect(check.blocking[0]).toMatchObject({
      next_command: 'terrace security check',
      remediation: expect.stringContaining('Then rerun `terrace security check`.')
    });
  });

  it('detects partial generated agent assets in doctor and command discovery', () => {
    writeJson(path.join(tmpDir, '.terrace', 'state.json'), { project: { name: 'Partial Agents' } });
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'), '# terrace-next\n', 'utf-8');

    expect(runDoctor(tmpDir).warnings).toContainEqual(expect.objectContaining({
      code: 'PARTIAL_AGENT_ASSETS',
      next_command: 'terrace init'
    }));
    expect(discoverProjectCommands(tmpDir).warnings).toContainEqual(expect.objectContaining({
      code: 'PARTIAL_AGENT_ASSETS',
      next_command: 'terrace init'
    }));
  });

  it('exposes corpus run and report as first-class CLI commands', () => {
    const dryRun = runTerrace(tmpDir, ['corpus', 'run', '--dry-run-plan', '--sample', '--json']);
    expect(dryRun.status).toBe(0);
    expect(dryRun.json.plan).toEqual(expect.any(Array));

    const report = runTerrace(tmpDir, ['corpus', 'report', '--json']);
    expect(report.status).toBe(0);
    expect(report.json).toMatchObject({
      runId: expect.any(String),
      totals: expect.objectContaining({ commands: expect.any(Number) }),
      report: expect.stringContaining('docs/terrace/corpus/REPORT.md')
    });
  });
});
