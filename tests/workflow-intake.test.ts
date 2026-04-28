// Phase 2 RED stubs — covers WKFL-01, OPS-01, OPS-02
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const NODE_BIN = process.execPath;

describe('intake workflow provisional PRD and fast-mode path (WKFL-01, OPS-01, OPS-02)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-intake-test-'));
    // Initialize a Terrace project (creates .terrace/, docs/, etc.)
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init'], { cwd: tmpDir, encoding: 'utf-8' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('when no PRD exists, intake produces docs/prd/PRD.md marked [PROVISIONAL] in unfilled sections (OPS-01, D-13)', () => {
    // The PRD.md template must exist and contain [PROVISIONAL] markers
    // In Phase 2, the intake workflow writes a provisional PRD from steering.md + user request
    // This test verifies the template has the [PROVISIONAL] marker pattern
    const prdTemplate = path.resolve(process.cwd(), 'packages/terrace-core/templates/PRD.md');
    expect(fs.existsSync(prdTemplate), 'PRD.md template must exist').toBe(true);
    const content = fs.readFileSync(prdTemplate, 'utf-8');
    expect(content, 'PRD.md template must contain [PROVISIONAL] marker for intake workflow (OPS-01)').toContain('[PROVISIONAL');
  });

  it('provisional PRD reads from .terrace/steering.md — steering.md template has intent, non_negotiables, scope_boundaries fields (D-14)', () => {
    const steeringTemplate = path.resolve(process.cwd(), 'packages/terrace-core/templates/steering.md');
    expect(fs.existsSync(steeringTemplate), 'steering.md template must exist').toBe(true);
    const content = fs.readFileSync(steeringTemplate, 'utf-8');
    expect(content, 'steering.md must contain intent field').toContain('intent');
    expect(content, 'steering.md must contain non_negotiables field').toContain('non_negotiables');
    expect(content, 'steering.md must contain scope_boundaries field').toContain('scope_boundaries');
  });

  it('intake step-01 file exists in the intake skill directory for WKFL-01 (WKFL-01)', () => {
    // Terrace intake workflow entry point — spec-interrogator drives intake via step files
    // The intake workflow is handled by the interrogator agent
    const interrogatorBase = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile), 'Interrogator step-01-create.md must exist for intake entry (WKFL-01)').toBe(true);
  });

  it('Stage 2 offer text contains the exact interrogation prompt string (D-15)', () => {
    // The intake step file must contain the exact Stage 2 offer string
    const interrogatorBase = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile), 'step-01-create.md must exist').toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(
      content,
      'step file must contain exact Stage 2 offer text (D-15)'
    ).toContain('Run the Interrogation workflow to refine ambiguities? (y/N)');
  });

  it('when interrogation declined, CLARIFICATIONS.md is created with unresolved assumptions (OPS-02, D-16)', () => {
    // The step file must document the fast-mode path that creates CLARIFICATIONS.md
    const interrogatorBase = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');
    const stepFile = path.join(interrogatorBase, 'step-01-create.md');
    expect(fs.existsSync(stepFile), 'step-01-create.md must exist').toBe(true);
    const content = fs.readFileSync(stepFile, 'utf-8');
    expect(content, 'step file must reference CLARIFICATIONS.md fast-mode path (OPS-02)').toContain('CLARIFICATIONS.md');
    expect(content, 'step file must describe unresolved assumption logging (OPS-02)').toContain('unresolved');
  });
});
