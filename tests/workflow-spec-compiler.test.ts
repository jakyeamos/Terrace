// Phase 2 RED stubs — covers WKFL-04, WKFL-05
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

describe('spec compiler workflow tri-modal step files (WKFL-04, WKFL-05)', () => {
  let tmpDir: string;
  const compilerBase = path.resolve(process.cwd(), '.agents/skills/terrace-spec-compiler');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-spec-compiler-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('step-01-create.md exists in .agents/skills/terrace-spec-compiler/ (WKFL-04)', () => {
    const stepFile = path.join(compilerBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
  });

  it('step-01-create.md YAML frontmatter has required fields: step, mode, next_step, requires (WKFL-04)', () => {
    const stepFile = path.join(compilerBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    expect(frontmatter).toHaveProperty('step');
    expect(frontmatter).toHaveProperty('mode');
    expect(frontmatter).toHaveProperty('next_step');
    expect(frontmatter).toHaveProperty('requires');
  });

  it('COMPILED-SPEC.md output has YAML frontmatter with all required fields (WKFL-04, TMPL-02)', () => {
    // The COMPILED-SPEC.md template must exist with required frontmatter fields
    const compiledSpecTemplate = path.resolve(process.cwd(), 'src/templates/COMPILED-SPEC.md');
    expect(fs.existsSync(compiledSpecTemplate)).toBe(true);
    const content = fs.readFileSync(compiledSpecTemplate, 'utf-8');
    const requiredFields = [
      'spec_version',
      'project',
      'phase',
      'requirements',
      'protected',
      'last_updated',
      'source_refs',
    ];
    for (const field of requiredFields) {
      expect(content, `COMPILED-SPEC.md template missing required field: ${field}`).toContain(field);
    }
  });

  it('spec compiler step file references derived artifact paths including INVARIANTS.md (WKFL-05)', () => {
    const stepFile = path.join(compilerBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content).toContain('INVARIANTS.md');
  });

  it('spec compiler step file references PERMISSIONS-MATRIX.md as derived artifact (WKFL-05)', () => {
    const stepFile = path.join(compilerBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content).toContain('PERMISSIONS-MATRIX.md');
  });

  it('spec compiler step file references STATE-MACHINES.md as derived artifact (WKFL-05)', () => {
    const stepFile = path.join(compilerBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content).toContain('STATE-MACHINES.md');
  });
});
