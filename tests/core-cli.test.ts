import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');

function runTerrace(tmpDir: string, args: string[]) {
  const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8' });
  return JSON.parse(stdout);
}

describe('strict core CLI delegation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes strict core state as JSON', () => {
    const result = runTerrace(tmpDir, ['core', 'init', '--json']);

    expect(result.created).toContain('.terrace/state.json');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(true);
  });

  it('explains core rules through the CLI', () => {
    runTerrace(tmpDir, ['core', 'init', '--json']);
    const result = runTerrace(tmpDir, ['rule', 'explain', 'testing-trust', '--json']);

    expect(result.id).toBe('testing-trust');
  });

  it('runs GSD port inventory in dry-run mode', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');

    const result = runTerrace(tmpDir, ['port', 'gsd', '--dry-run', '--json']);

    expect(result.artifacts).toContain('.planning/ROADMAP.md');
    expect(result.writes).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
  });
});
