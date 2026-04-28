import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { portGsd } = require('../packages/terrace-core/src/index.cjs');

describe('terrace port gsd migration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-port-gsd-migration-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Legacy Project\n\nCurrent focus: migrate this.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Legacy State\n\nlast_activity: legacy work\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates supported GSD artifacts into Terrace state without deleting source files', () => {
    const result = portGsd(tmpDir, { force: false });

    expect(result.mode).toBe('migration');
    expect(result.writes).toContain('.terrace/state.json');
    expect(result.writes).toContain('.terrace/migration/gsd-port-report.json');
    expect(result.skipped).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md'))).toBe(true);

    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));
    expect(state.project.name).toBe(path.basename(tmpDir));
    expect(state.migration.source).toBe('gsd');
    expect(state.migration.artifacts).toContain('.planning/PROJECT.md');
  });

  it('refuses to overwrite an existing Terrace state without force', () => {
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'state.json'), '{"existing":true}\n', 'utf8');

    expect(() => portGsd(tmpDir, { force: false })).toThrow(/already exists/);
  });
});
