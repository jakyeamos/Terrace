import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { cmdInit } = require('../src/lib/init.cjs');

type ManifestEntry = { file: string; action: 'created' | 'skipped' | 'overwritten' };

describe('terrace init (CLI-07, INST-01 through INST-08, OPS-08 through OPS-14)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .terrace/ directory in a clean repo', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    expect(fs.existsSync(path.join(tmpDir, '.terrace'))).toBe(true);
  });

  it('creates project-state.json with all 5 required Phase 1 fields', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    const stateFile = path.join(tmpDir, '.terrace', 'project-state.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
    expect(state).toHaveProperty('phase');
    expect(state).toHaveProperty('spec_hash');
    expect(state).toHaveProperty('active_slice');
    expect(state).toHaveProperty('last_session');
    expect(state).toHaveProperty('policy_mode');
  });

  it('creates .terrace/presets/registry.json with correct schema (PRST-01, D-13)', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    const reg = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    expect(fs.existsSync(reg)).toBe(true);
    const data = JSON.parse(fs.readFileSync(reg, 'utf-8')) as { version: string; presets: unknown[] };
    expect(data).toHaveProperty('version');
    expect(Array.isArray(data.presets)).toBe(true);
  });

  it('creates docs/prd/, docs/spec/, docs/testing/ directories (D-06)', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'spec'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'testing'))).toBe(true);
  });

  it('returns a manifest array listing every file with file and action fields (INST-04, D-08)', () => {
    const result = cmdInit(tmpDir, { force: false, yes: false }) as ManifestEntry[];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('file');
    expect(result[0]).toHaveProperty('action');
  });

  it('is idempotent: re-running with same options returns only skipped entries (INST-02, D-07)', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    const result = cmdInit(tmpDir, { force: false, yes: false }) as ManifestEntry[];
    const actions = result.map((r) => r.action);
    expect(actions.every((a) => a === 'skipped')).toBe(true);
  });

  it('returns overwritten actions when --force is passed (INST-03, D-07)', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    const result = cmdInit(tmpDir, { force: true, yes: false }) as ManifestEntry[];
    const actions = result.map((r) => r.action);
    expect(actions.some((a) => a === 'overwritten')).toBe(true);
  });

  it('does NOT create or modify .planning/ directory (GSD isolation, D-06)', () => {
    cmdInit(tmpDir, { force: false, yes: false });
    expect(fs.existsSync(path.join(tmpDir, '.planning'))).toBe(false);
  });

  it('does NOT resolve any path outside .terrace/ or docs/ in the target repo (GSD-04, D-06)', () => {
    const result = cmdInit(tmpDir, { force: false, yes: false }) as ManifestEntry[];
    for (const entry of result) {
      const resolved = path.resolve(entry.file);
      const inTerrace = resolved.startsWith(path.join(tmpDir, '.terrace'));
      const inDocs = resolved.startsWith(path.join(tmpDir, 'docs'));
      expect(inTerrace || inDocs, `init wrote outside allowed paths: ${entry.file}`).toBe(true);
    }
  });

  it('works in a repo that also has a .planning/ directory (INST-06: GSD coexistence)', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
    expect(() => cmdInit(tmpDir, { force: false, yes: false })).not.toThrow();
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toBe('# State\n');
  });
});
