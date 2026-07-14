import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  initCore,
  computeSpecHash,
  protectBaseline,
  addDecision,
  hasDecisionForSpec,
  enforceProtectedChanges,
  evaluatePolicy,
  startSession,
  endSession,
  reconstructSession,
  validateArtifacts,
  installBuiltInPreset,
  listPresets,
  migrateArtifacts,
  runAudit,
  runCiCheck,
  loadState,
  saveState,
  loadFragments
} = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core extraction of useful legacy behavior', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-legacy-'));
    initCore(tmpDir, { projectName: 'legacy-extraction' });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'protected.test.ts'), 'it("works", () => {})\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'docs', 'testing', 'TEST-ARCH.md'), 'req_id: SPEC-1\nspec_ref: SPEC-1\nfile: tests/protected.test.ts\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hashes stable spec content independent of whitespace and last_updated', () => {
    const first = '---\nspec_version: 1.0\nlast_updated: 2026-01-01\n---\n# Spec\n\nSame body.   \n';
    const second = '---\nspec_version: 1.0\nlast_updated: 2026-04-28\n---\n# Spec\nSame body.';

    expect(computeSpecHash(first)).toBe(computeSpecHash(second));
  });

  it('protects baselines and requires a spec-linked decision before protected changes pass', () => {
    protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-1', { severity: 'p1' });

    const blocked = enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']);
    expect(blocked.allowed).toBe(false);
    expect(blocked.blocking[0].code).toBe('PROTECTED_CHANGE_WITHOUT_DECISION');

    addDecision(tmpDir, { specRef: 'SPEC-1', rationale: 'Spec changed the protected expectation.' });
    expect(enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']).allowed).toBe(true);
  });

  it('does not authorize a protected change from state-only decision evidence', () => {
    const state = loadState(tmpDir);
    saveState(tmpDir, {
      ...state,
      decisions: [...state.decisions, { spec_ref: 'SPEC-STATE-ONLY' }]
    });

    expect(hasDecisionForSpec(tmpDir, 'SPEC-STATE-ONLY')).toBe(false);

    protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-STATE-ONLY', {});
    expect(enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']).allowed).toBe(false);

    addDecision(tmpDir, { specRef: 'SPEC-STATE-ONLY' });
    expect(hasDecisionForSpec(tmpDir, 'SPEC-STATE-ONLY')).toBe(true);
    expect(enforceProtectedChanges(tmpDir, ['tests/protected.test.ts']).allowed).toBe(true);
  });

  it('does not authorize a spec from a decision-log prefix match', () => {
    const state = loadState(tmpDir);
    saveState(tmpDir, {
      ...state,
      decisions: [...state.decisions, { spec_ref: 'SPEC-1' }]
    });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'spec', 'DECISION-LOG.md'), 'spec_ref: SPEC-10\n', 'utf8');

    expect(hasDecisionForSpec(tmpDir, 'SPEC-1')).toBe(false);
  });

  it('evaluates temporary recovery mode and records repo-only sessions against strict state', () => {
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'policy.json'), JSON.stringify({
      mode: 'recovery',
      previous_mode: 'strict',
      recovery_expires_at: '2000-01-01T00:00:00.000Z'
    }), 'utf-8');

    const policy = evaluatePolicy(tmpDir, new Date('2026-04-28T12:00:00.000Z'));
    expect(policy.mode).toBe('strict');
    expect(policy.actions).toContain('reverted_recovery_mode');

    const started = startSession(tmpDir, { activeSlice: 'core-extraction' });
    const ended = endSession(tmpDir, { nextSlice: 'cleanup' });
    expect(ended.file).toBe(started.file);
    expect(reconstructSession(tmpDir).last_session).toContain('cleanup');
  });

  it('validates artifacts, migrates schema versions, installs presets, and exposes health checks', () => {
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), '---\nversion: "1.0"\n---\n## incomplete\n', 'utf-8');
    const validation = validateArtifacts(tmpDir, {});
    expect(validation.blocking.some((item: { code: string }) => item.code === 'MISSING_REQUIRED_SECTION')).toBe(true);

    const migration = migrateArtifacts(tmpDir, '1.0');
    expect(migration.changed.some((item: { file: string }) => item.file.endsWith('PRD.md'))).toBe(true);

    installBuiltInPreset(tmpDir, 'terrace-security', { force: false });
    expect(listPresets(tmpDir).some((preset: { id: string }) => preset.id === 'terrace-security')).toBe(true);

    protectBaseline(tmpDir, 'tests/protected.test.ts', 'SPEC-1', {});
    expect(runAudit(tmpDir).blocking.some((item: { code: string }) => item.code === 'MISSING_BASELINE_FILE')).toBe(false);
    expect(runCiCheck(tmpDir, ['tests/protected.test.ts']).blocking.some((item: { code: string }) => item.code === 'PROTECTED_CHANGE_WITHOUT_DECISION')).toBe(true);
  });

  it('loads tiered agent fragments from core', () => {
    const agentDir = path.resolve(process.cwd(), '.agents', 'skills', 'terrace-spec-interrogator');
    const core = loadFragments(agentDir, { tier: 'core' });
    const all = loadFragments(agentDir, { tier: 'all' });

    expect(core.contents.length).toBeGreaterThan(0);
    expect(all.tokenCount).toBeGreaterThanOrEqual(core.tokenCount);
  });
});
