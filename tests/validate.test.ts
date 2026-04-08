import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { validateArtifacts } = require('../src/lib/validate.cjs');

type ValidationResult = {
  blocking: Array<{ code: string; message: string; file?: string }>;
  warnings: Array<{ code: string; message: string; file?: string }>;
};

describe('terrace spec validate (VAL-01 through VAL-05)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-validate-test-'));
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns blocking errors when a required template section is missing (VAL-01, VAL-02)', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), '---\nversion: "1.0"\n---\n## incomplete_section\n', 'utf-8');
    const result = validateArtifacts(tmpDir, {}) as ValidationResult;
    expect(result.blocking.length).toBeGreaterThan(0);
  });

  it('stale last_session produces a warning, not a blocking error (VAL-04)', () => {
    const stateFile = path.join(tmpDir, '.terrace', 'project-state.json');
    fs.writeFileSync(stateFile, JSON.stringify({
      phase: 'intake',
      spec_hash: 'abc123',
      active_slice: null,
      last_session: '2000-01-01T00:00:00.000Z',
      policy_mode: 'standard'
    }), 'utf-8');
    const result = validateArtifacts(tmpDir, {}) as ValidationResult;
    const hasStaleWarning = result.warnings.some((w) => w.code === 'STALE_SESSION');
    expect(hasStaleWarning).toBe(true);
    expect(result.blocking.some((e) => e.code === 'STALE_SESSION')).toBe(false);
  });

  it('output shape has blocking[] and warnings[] arrays (VAL-02, CLI-12 JSON shape)', () => {
    const result = validateArtifacts(tmpDir, {}) as ValidationResult;
    expect(Array.isArray(result.blocking)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('does not throw when custom file_mapping is provided (VAL-05)', () => {
    const config = { file_mapping: { 'PRD.md': 'docs/requirements/PRODUCT-BRIEF.md' } };
    expect(() => validateArtifacts(tmpDir, config)).not.toThrow();
  });

  it('reports missing spec_ref in an artifact as a blocking error (VAL-03)', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'DECISION-LOG.md'), '---\ndecision_id: D-01\ndate: 2026-01-01\nauthor: test\nchange_type: add\nrationale: test\nimpact: none\nstatus: active\n---\n', 'utf-8');
    const result = validateArtifacts(tmpDir, {}) as ValidationResult;
    const hasMissingRef = result.blocking.some((e) => e.code === 'MISSING_SPEC_REF');
    expect(hasMissingRef).toBe(true);
  });
});
