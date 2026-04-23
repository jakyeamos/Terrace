// Phase 2 RED stubs — covers WKFL-02, WKFL-02a, WKFL-02b, WKFL-02c, WKFL-03
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Minimal inline YAML frontmatter extractor — no external dependencies */
function extractFrontmatter(content: string): Record<string, string> {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return {};
  const endIdx = lines.indexOf('---', 1);
  if (endIdx === -1) return {};
  const result: Record<string, string> = {};
  for (let i = 1; i < endIdx; i++) {
    const line = lines[i];
    if (!line) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = val;
  }
  return result;
}

describe('interrogation workflow tri-modal step files (WKFL-02, WKFL-02a, WKFL-02b, WKFL-02c, WKFL-03)', () => {
  let tmpDir: string;
  const interrogatorBase = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-interrogation-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('step-01-create.md exists in .agents/skills/terrace-spec-interrogator/ (WKFL-02, D-05)', () => {
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
  });

  it('step-01-create.md YAML frontmatter has required fields: step, mode, next_step, requires (WKFL-02, D-06)', () => {
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    expect(frontmatter).toHaveProperty('step');
    expect(frontmatter).toHaveProperty('mode');
    expect(frontmatter).toHaveProperty('next_step');
    expect(frontmatter).toHaveProperty('requires');
  });

  it('step-01-create.md mode field equals create (WKFL-02a, D-06)', () => {
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const frontmatter = extractFrontmatter(fs.readFileSync(stepFile, 'utf-8'));
    expect(frontmatter['mode']).toBe('create');
  });

  it('step-02-edit.md exists with mode edit (WKFL-02b, D-05)', () => {
    const stepFile = path.join(interrogatorBase, 'step-02-edit.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const frontmatter = extractFrontmatter(fs.readFileSync(stepFile, 'utf-8'));
    expect(frontmatter['mode']).toBe('edit');
  });

  it('step-03-validate.md exists with mode validate and next_step null (WKFL-02c, D-07)', () => {
    const stepFile = path.join(interrogatorBase, 'step-03-validate.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const frontmatter = extractFrontmatter(fs.readFileSync(stepFile, 'utf-8'));
    expect(frontmatter['mode']).toBe('validate');
    // next_step for terminal step should be null (stored as literal 'null' in YAML)
    expect(frontmatter['next_step']).toBe('null');
  });

  it('CLARIFICATIONS.md path in fast-mode output is docs/prd/CLARIFICATIONS.md (WKFL-03, D-16)', () => {
    // Fast-mode outputs unresolved assumptions to docs/prd/CLARIFICATIONS.md
    // This test verifies the step-01-create.md references this canonical path
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content).toContain('docs/prd/CLARIFICATIONS.md');
  });

  it('fast-mode assumption entry template has fields: assumption, status: unresolved, resolution: deferred (WKFL-03, D-16)', () => {
    // The step file must describe or contain the assumption entry format
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content).toContain('assumption:');
    expect(content).toContain('status: unresolved');
    expect(content).toContain('resolution: deferred');
  });
});
