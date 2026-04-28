import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { portGsd, runAudit } = require('../packages/terrace-core/src/index.cjs');

describe('terrace port gsd migration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-port-gsd-migration-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-demo'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Legacy Project\n\nCurrent focus: migrate this.\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), '# Requirements\n\n- REQ-001: preserve migration intent\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Bootstrap\n\n## Phase 2: Release\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# Legacy State\n\nlast_activity: legacy work\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'phases', '01-demo', 'PLAN.md'), '# Unsupported phase plan\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('migrates supported GSD artifacts into Terrace state without deleting source files', () => {
    const result = portGsd(tmpDir, { force: false });

    expect(result.mode).toBe('migration');
    expect(result.writes).toContain('.terrace/state.json');
    expect(result.writes).toContain('.terrace/migration/gsd-port-report.json');
    expect(result.writes).toContain('docs/prd/PRD.md');
    expect(result.writes).toContain('docs/spec/COMPILED-SPEC.md');
    expect(result.writes).toContain('docs/terrace-migration/GSD-STATE.md');
    expect(result.skipped).toContainEqual({
      artifact: '.planning/phases/01-demo/PLAN.md',
      reason: 'unsupported_artifact'
    });
    expect(fs.existsSync(path.join(tmpDir, '.planning', 'PROJECT.md'))).toBe(true);

    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));
    expect(state.project.name).toBe(path.basename(tmpDir));
    expect(state.migration.source).toBe('gsd');
    expect(state.migration.artifacts).toContain('.planning/PROJECT.md');
    expect(state.roadmap.phases).toEqual([
      { id: 'phase-1-bootstrap', title: 'Phase 1: Bootstrap', status: 'migrated', source_ref: '.planning/ROADMAP.md' },
      { id: 'phase-2-release', title: 'Phase 2: Release', status: 'migrated', source_ref: '.planning/ROADMAP.md' }
    ]);

    const prd = fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf8');
    const spec = fs.readFileSync(path.join(tmpDir, 'docs', 'spec', 'COMPILED-SPEC.md'), 'utf8');
    expect(prd).toContain('Current focus: migrate this.');
    expect(spec).toContain('REQ-001: preserve migration intent');
    expect(result.review_checklist).toContain('Review docs/prd/PRD.md against the original .planning/PROJECT.md.');
    expect(runAudit(tmpDir).healthy).toBe(true);
  });

  it('refuses to overwrite an existing Terrace state without force', () => {
    fs.mkdirSync(path.join(tmpDir, '.terrace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'state.json'), '{"existing":true}\n', 'utf8');

    expect(() => portGsd(tmpDir, { force: false })).toThrow(/already exists/);
  });

  it('does not overwrite migrated docs without force and reports the skipped target', () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'prd'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'existing prd\n', 'utf8');

    const result = portGsd(tmpDir, { force: false });

    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf8')).toBe('existing prd\n');
    expect(result.skipped).toContainEqual({
      artifact: '.planning/PROJECT.md',
      target: 'docs/prd/PRD.md',
      reason: 'target_exists'
    });
  });
});
