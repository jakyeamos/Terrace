import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  initCore,
  protectBaseline,
  baselineStatus,
  enforceProtectedChanges,
  evaluatePolicy,
  addDecision,
  runAudit,
  runCiCheck,
  startSession,
  endSession,
  reconstructSession,
  migrateArtifacts,
  installBuiltInPreset
} = require('../packages/terrace-core/src/index.cjs');

function extractFrontmatter(content: string): Record<string, string> {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return {};
  const endIdx = lines.indexOf('---', 1);
  if (endIdx === -1) return {};
  const result: Record<string, string> = {};
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    result[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return result;
}

describe('Phase 3 through Phase 6 roadmap readiness', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-roadmap-test-'));
    initCore(tmpDir, { projectName: 'roadmap-test' });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'protected.test.ts'), 'it("works", () => {})\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'testing', 'TEST-ARCH.md'), 'req_id: SPEC-1\nspec_ref: SPEC-1\nfile: tests/protected.test.ts\nci_tier: local\nrisk: p1\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('protects baseline tests and reports registry status gaps', () => {
    const entry = protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-1', { severity: 'p1' });
    expect(entry.spec_ref).toBe('SPEC-1');

    const status = baselineStatus(tmpDir);
    expect(status.entries).toHaveLength(1);
    expect(status.missing_files).toHaveLength(0);
    expect(status.requirements_without_protected_anchor).toHaveLength(0);
  });

  it('refuses baseline registration without a spec_ref', () => {
    expect(() => protectBaseline(tmpDir, 'tests/protected.test.ts', '', {})).toThrow('spec_ref');
  });

  it('blocks protected test changes until a matching decision entry exists', () => {
    protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-1', {});
    const blocked = enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']);
    expect(blocked.blocking).toHaveLength(1);
    expect(blocked.blocking[0].message).toContain('SPEC-1');

    addDecision(tmpDir, { specRef: 'SPEC-1', rationale: 'Update protected expectation after spec change.' });
    const allowed = enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']);
    expect(allowed.blocking).toHaveLength(0);
  });

  it('evaluates recovery policy expiry and warning behavior', () => {
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'policy.json'), JSON.stringify({
      mode: 'recovery',
      previous_mode: 'strict',
      recovery_expires_at: '2000-01-01T00:00:00.000Z'
    }), 'utf-8');

    const expired = evaluatePolicy(tmpDir, new Date('2026-04-28T12:00:00.000Z'));
    expect(expired.mode).toBe('strict');
    expect(expired.actions).toContain('reverted_recovery_mode');
  });

  it('audits governance health and CI enforcement without relying on local hooks', () => {
    protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-1', {});
    const audit = runAudit(tmpDir);
    expect(audit.blocking.some((item: { code: string }) => item.code === 'MISSING_BASELINE_FILE')).toBe(false);

    const ci = runCiCheck(tmpDir, ['tests/protected.test.ts']);
    expect(ci.blocking.some((item: { code: string }) => item.code === 'PROTECTED_CHANGE_WITHOUT_DECISION')).toBe(true);
  });

  it('records session start/end and reconstructs repo-only context', () => {
    const started = startSession(tmpDir, { activeSlice: 'phase-5' });
    expect(fs.existsSync(started.file)).toBe(true);

    const ended = endSession(tmpDir, {
      decisions: ['Recorded lifecycle behavior'],
      filesChanged: ['packages/terrace-core/src/session.cjs'],
      nextSlice: 'phase-6'
    });
    expect(ended.file).toBe(started.file);

    const reconstructed = reconstructSession(tmpDir);
    expect(reconstructed.workflow_status).toBeTruthy();
    expect(reconstructed.last_session).toContain('phase-6');
  });

  it('migrates artifact schema versions without discarding user-authored content', () => {
    const prd = path.join(tmpDir, 'docs', 'prd', 'PRD.md');
    fs.appendFileSync(prd, '\nUser note: preserve me.\n', 'utf-8');
    const result = migrateArtifacts(tmpDir, '1.0');
    expect(result.changed.some((item: { file: string }) => item.file === prd)).toBe(true);
    expect(fs.readFileSync(prd, 'utf-8')).toContain('User note: preserve me.');
    expect(fs.readFileSync(prd, 'utf-8')).toContain('schema_version: "1.0"');
  });

  it('installs built-in Phase 6 presets including security command metadata', () => {
    const result = installBuiltInPreset(tmpDir, 'terrace-security', { force: false });
    expect(result.conflict).toBe(false);
    const registry = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'presets', 'registry.json'), 'utf-8'));
    const security = registry.presets.find((preset: { id: string }) => preset.id === 'terrace-security');
    expect(security.commands).toContain('terrace security check');
  });

  it('defines executable Phase 6 adversarial review and maintainer curator agents', () => {
    const verifierStep = path.resolve(process.cwd(), '.agents/skills/terrace-verifier-adversary/step-01-create.md');
    const curatorSkill = path.resolve(process.cwd(), '.agents/skills/terrace-maintainer-curator/SKILL.md');
    expect(fs.existsSync(verifierStep)).toBe(true);
    expect(fs.existsSync(curatorSkill)).toBe(true);

    const frontmatter = extractFrontmatter(fs.readFileSync(verifierStep, 'utf-8'));
    expect(frontmatter).toHaveProperty('mode', 'create');
    expect(frontmatter).toHaveProperty('next_step');
    expect(fs.readFileSync(curatorSkill, 'utf-8')).toContain('docs/spec/REGRESSIONS.md');
  });
});
