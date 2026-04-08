import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const NODE_BIN = process.execPath;

describe('--json output mode for all CLI commands (CLI-12)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-json-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('terrace init --json produces a parseable JSON array of manifest entries', () => {
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty('file');
    expect(parsed[0]).toHaveProperty('action');
  });

  it('terrace doctor --json produces parseable JSON with blocking and warnings', () => {
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'doctor', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout) as { blocking: unknown[]; warnings: unknown[] };
    expect(parsed).toHaveProperty('blocking');
    expect(parsed).toHaveProperty('warnings');
  });

  it('terrace preset list --json produces parseable JSON array', () => {
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'preset', 'list', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('terrace phase set intake --json produces parseable JSON with updated phase', () => {
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'phase', 'set', 'interrogation', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout) as { phase: string };
    expect(parsed).toHaveProperty('phase');
    expect(parsed.phase).toBe('interrogation');
  });
});
