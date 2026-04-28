import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { classifyGsdCommand, portGsdDryRun } = require('../packages/terrace-core/src/index.cjs');

describe('terrace port gsd dry-run classifier', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-port-gsd-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('classifies core planning loop commands as improved ports', () => {
    expect(classifyGsdCommand('gsd-plan-phase').strategy).toBe('improved');
    expect(classifyGsdCommand('gsd-execute-phase').strategy).toBe('improved');
  });

  it('classifies governance-specific commands as replaced', () => {
    expect(classifyGsdCommand('gsd-validate-phase').strategy).toBe('replaced');
  });

  it('classifies low-risk utilities as as-is ports', () => {
    expect(classifyGsdCommand('gsd-note').strategy).toBe('as-is');
  });

  it('dry-run inventories planning artifacts without writing state', () => {
    const result = portGsdDryRun(tmpDir);
    expect(result.artifacts).toContain('.planning/ROADMAP.md');
    expect(result.artifacts).toContain('.planning/STATE.md');
    expect(result.writes).toHaveLength(0);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(false);
  });
});
