import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore } = require('../packages/terrace-core/src/index.cjs');

describe('terrace init (CLI-07, INST-01 through INST-08, OPS-08 through OPS-14)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .terrace/ directory in a clean repo', () => {
    initCore(tmpDir, { projectName: 'init-test' });
    expect(fs.existsSync(path.join(tmpDir, '.terrace'))).toBe(true);
  });

  it('creates state.json with strict-core workflow fields', () => {
    initCore(tmpDir, { projectName: 'init-test' });
    const stateFile = path.join(tmpDir, '.terrace', 'state.json');
    expect(fs.existsSync(stateFile)).toBe(true);
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
    expect(state).toHaveProperty('workflow');
    expect(state).toHaveProperty('roadmap');
    expect(state).toHaveProperty('active_slice');
    expect(state).toHaveProperty('protected_tests');
  });

  it('creates .terrace/presets/registry.json with correct schema (PRST-01, D-13)', () => {
    initCore(tmpDir, { projectName: 'init-test' });
    const reg = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    expect(fs.existsSync(reg)).toBe(true);
    const data = JSON.parse(fs.readFileSync(reg, 'utf-8')) as { version: string; presets: unknown[] };
    expect(data).toHaveProperty('version');
    expect(Array.isArray(data.presets)).toBe(true);
  });

  it('creates docs/prd/, docs/spec/, docs/testing/ directories (D-06)', () => {
    initCore(tmpDir, { projectName: 'init-test' });
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'spec'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'testing'))).toBe(true);
  });

  it('returns created paths for deterministic core artifacts', () => {
    const result = initCore(tmpDir, { projectName: 'init-test' }) as { created: string[] };
    expect(result.created).toContain('.terrace/state.json');
    expect(result.created).toContain('.terrace/events.jsonl');
  });

  it('does NOT create or modify .planning/ directory (GSD isolation, D-06)', () => {
    initCore(tmpDir, { projectName: 'init-test' });
    expect(fs.existsSync(path.join(tmpDir, '.planning'))).toBe(false);
  });

  it('does NOT resolve any path outside .terrace/ or docs/ in the target repo (GSD-04, D-06)', () => {
    const result = initCore(tmpDir, { projectName: 'init-test' }) as { created: string[] };
    for (const entry of result.created) {
      const resolved = path.resolve(tmpDir, entry);
      const inTerrace = resolved.startsWith(path.join(tmpDir, '.terrace'));
      const inDocs = resolved.startsWith(path.join(tmpDir, 'docs'));
      const inClaude = resolved.startsWith(path.join(tmpDir, '.claude'));
      const inAgents = resolved.startsWith(path.join(tmpDir, '.agents'));
      const isAgentRootFile = resolved === path.join(tmpDir, 'AGENTS.md') || resolved === path.join(tmpDir, 'CLAUDE.md');
      expect(inTerrace || inDocs || inClaude || inAgents || isAgentRootFile, `init wrote outside allowed paths: ${entry}`).toBe(true);
    }
  });

  it('works in a repo that also has a .planning/ directory (INST-06: GSD coexistence)', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
    expect(() => initCore(tmpDir, { projectName: 'init-test' })).not.toThrow();
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toBe('# State\n');
  });
});
