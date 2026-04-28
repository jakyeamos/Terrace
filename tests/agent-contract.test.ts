// Phase 2 RED stubs — covers AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('agent contract and steering loader (AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-agent-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadFragments is available from terrace-core (AGNT-07)', () => {
    const { loadFragments } = require('../packages/terrace-core/src/index.cjs') as { loadFragments: unknown };
    expect(typeof loadFragments).toBe('function');
  });

  it('workflow command contracts are available from terrace-core', () => {
    const { listCommandContracts } = require('../packages/terrace-core/src/index.cjs') as { listCommandContracts: () => Array<{ command: string; json: boolean }> };
    const commands = listCommandContracts();

    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace next', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace resume', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace quick list', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace ship check', json: true }));
  });

  it('terrace-spec-interrogator agent directory exists at .agents/skills/terrace-spec-interrogator/ (AGNT-01)', () => {
    const agentDir = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');
    expect(fs.existsSync(agentDir)).toBe(true);
  });

  it('terrace-spec-compiler agent directory exists at .agents/skills/terrace-spec-compiler/ (AGNT-02)', () => {
    const agentDir = path.resolve(process.cwd(), '.agents/skills/terrace-spec-compiler');
    expect(fs.existsSync(agentDir)).toBe(true);
  });

  it('terrace-test-architect agent directory exists at .agents/skills/terrace-test-architect/ (AGNT-03)', () => {
    const agentDir = path.resolve(process.cwd(), '.agents/skills/terrace-test-architect');
    expect(fs.existsSync(agentDir)).toBe(true);
  });

  it('terrace-spec-interrogator SKILL.md contains all AGNT-07 required fields (AGNT-07)', () => {
    const skillPath = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator/SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);
    const content = fs.readFileSync(skillPath, 'utf-8');
    const requiredFields = [
      'purpose:',
      'allowed_outputs:',
      'forbidden_actions:',
      'required_inputs:',
      'handoff_behavior:',
      'artifact_ownership:',
      'fragment_index_ref:',
    ];
    for (const field of requiredFields) {
      expect(content, `SKILL.md missing field: ${field}`).toContain(field);
    }
  });

  it('each agent SKILL.md has a fragment_index_ref field pointing to fragments/fragment-index.json (AGNT-07)', () => {
    const agents = [
      'terrace-spec-interrogator',
      'terrace-spec-compiler',
      'terrace-test-architect',
    ];
    for (const agent of agents) {
      const skillPath = path.resolve(process.cwd(), `.agents/skills/${agent}/SKILL.md`);
      expect(fs.existsSync(skillPath), `SKILL.md missing for ${agent}`).toBe(true);
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(content, `${agent} SKILL.md missing fragment_index_ref`).toContain('fragment_index_ref:');
      expect(content, `${agent} SKILL.md fragment_index_ref must reference fragments/fragment-index.json`).toContain('fragments/fragment-index.json');
    }
  });

  it('first workflow step instruction in SKILL.md is to read steering.md before any other step (AGNT-08, D-03)', () => {
    const agents = [
      'terrace-spec-interrogator',
      'terrace-spec-compiler',
      'terrace-test-architect',
    ];
    for (const agent of agents) {
      const skillPath = path.resolve(process.cwd(), `.agents/skills/${agent}/SKILL.md`);
      expect(fs.existsSync(skillPath), `SKILL.md missing for ${agent}`).toBe(true);
      const content = fs.readFileSync(skillPath, 'utf-8');
      expect(
        content,
        `${agent} SKILL.md must contain steering.md read instruction (AGNT-08)`
      ).toContain('Read `.terrace/steering.md` before any other step');
    }
  });
});
