// Phase 2 RED stubs — covers WKFL-06
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

describe('test architect workflow tri-modal step files (WKFL-06)', () => {
  let tmpDir: string;
  const testArchitectBase = path.resolve(process.cwd(), '.agents/skills/terrace-test-architect');

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-test-architect-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('step-01-create.md exists in .agents/skills/terrace-test-architect/ (WKFL-06)', () => {
    const stepFile = path.join(testArchitectBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
  });

  it('step-01-create.md YAML frontmatter has required fields: step, mode, next_step, requires (WKFL-06)', () => {
    const stepFile = path.join(testArchitectBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    const frontmatter = extractFrontmatter(content);
    expect(frontmatter).toHaveProperty('step');
    expect(frontmatter).toHaveProperty('mode');
    expect(frontmatter).toHaveProperty('next_step');
    expect(frontmatter).toHaveProperty('requires');
  });

  it('TEST-ARCH.md template maps requirement IDs to test layers with p0|p1|p2|p3 risk score (WKFL-06, TMPL-03)', () => {
    const testArchTemplate = path.resolve(process.cwd(), 'src/templates/TEST-ARCH.md');
    expect(fs.existsSync(testArchTemplate)).toBe(true);
    const content = fs.readFileSync(testArchTemplate, 'utf-8');
    // Must contain risk score notation p0, p1, p2, or p3
    const hasRiskScore = /p0|p1|p2|p3/i.test(content);
    expect(hasRiskScore, 'TEST-ARCH.md template must reference p0/p1/p2/p3 risk scoring (WKFL-06)').toBe(true);
  });

  it('TEST-ARCH.md template has ci_tier field in requirement entries (WKFL-06)', () => {
    const testArchTemplate = path.resolve(process.cwd(), 'src/templates/TEST-ARCH.md');
    expect(fs.existsSync(testArchTemplate)).toBe(true);
    const content = fs.readFileSync(testArchTemplate, 'utf-8');
    expect(content, 'TEST-ARCH.md must contain ci_tier field').toContain('ci_tier');
  });

  it('test architect step file references P0-P3 risk scoring in its workflow instructions (WKFL-06)', () => {
    const stepFile = path.join(testArchitectBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    const hasRiskScore = /p0|p1|p2|p3/i.test(content);
    expect(hasRiskScore, 'step-01-create.md must reference P0-P3 risk scoring').toBe(true);
  });

  it('test architect step file references ci_tier assignment in its workflow instructions (WKFL-06)', () => {
    const stepFile = path.join(testArchitectBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile)).toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content, 'step-01-create.md must reference ci_tier assignment (WKFL-06)').toContain('ci_tier');
  });
});
