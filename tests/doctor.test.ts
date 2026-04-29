import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, runDoctor } = require('../packages/terrace-core/src/index.cjs');

type DoctorResult = {
  blocking: Array<{ code: string; message: string; remediation: string }>;
  warnings: Array<{ code: string; message: string }>;
  healthy: boolean;
};

describe('terrace doctor diagnostics (CLI-10, OPS-08 through OPS-14)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-doctor-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports MISSING_TERRACE_DIR as blocking error when .terrace/ does not exist', () => {
    const result = runDoctor(tmpDir) as DoctorResult;
    const hasError = result.blocking.some((e) => e.code === 'MISSING_TERRACE_DIR');
    expect(hasError).toBe(true);
  });

  it('provides non-empty remediation string for each blocking error (OPS-08)', () => {
    const result = runDoctor(tmpDir) as DoctorResult;
    result.blocking.forEach((e) => {
      expect(typeof e.remediation).toBe('string');
      expect(e.remediation.length).toBeGreaterThan(0);
    });
  });

  it('reports MISSING_PROJECT_STATE as blocking error when .terrace/ exists but state.json does not', () => {
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    const result = runDoctor(tmpDir) as DoctorResult;
    const hasError = result.blocking.some((e) => e.code === 'MISSING_PROJECT_STATE');
    expect(hasError).toBe(true);
  });

  it('reports healthy:true and no blocking errors when minimal valid install exists', () => {
    initCore(tmpDir, { projectName: 'doctor-test' });
    const result = runDoctor(tmpDir) as DoctorResult;
    expect(result.blocking).toHaveLength(0);
    expect(result.healthy).toBe(true);
  });

  it('output always has blocking[], warnings[], healthy boolean (CLI-12 JSON shape)', () => {
    const result = runDoctor(tmpDir) as DoctorResult;
    expect(Array.isArray(result.blocking)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(typeof result.healthy).toBe('boolean');
  });

  it('works in a repo with no existing tests — does not throw or require test files (OPS-08)', () => {
    expect(() => runDoctor(tmpDir)).not.toThrow();
  });
});
