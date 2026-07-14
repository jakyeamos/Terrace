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
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace autonomous', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace commands discover', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace align <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace test-plan <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace observe <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace validate-prod <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace cleanup <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace ui import-stitch <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace ui plan-refresh <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace ui diff <feature>', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace quick list', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace ship check', json: true }));
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace release-preflight', json: true }));
  });

  it('terrace-autonomous generated skill carries autonomous workflow guardrails', () => {
    const { templateAssets } = require('../packages/terrace-core/src/agents.cjs') as { templateAssets: () => Array<{ path: string; content: string }> };
    const asset = templateAssets().find((item) => item.path === '.agents/skills/terrace-autonomous/SKILL.md');
    const localPath = path.resolve(process.cwd(), '.agents/skills/terrace-autonomous/SKILL.md');

    expect(asset).toBeDefined();
    expect(asset?.content).toContain('allowed-tools:');
    expect(asset?.content).toContain('terrace autonomous --json');
    expect(asset?.content).toContain('<stop_conditions>');
    expect(asset?.content).toContain('Do not claim the autonomous run completed unless Terrace gates and verification agree.');
    expect(fs.readFileSync(localPath, 'utf-8')).toBe(asset?.content);
  });

  it('terrace-do generated assets match the state-bound preview/apply contract', () => {
    const { templateAssets } = require('../packages/terrace-core/src/agents.cjs') as { templateAssets: () => Array<{ path: string; content: string }> };
    const paths = [
      '.agents/skills/terrace-do/SKILL.md',
      '.claude/skills/terrace-do/SKILL.md',
      '.claude/commands/terrace-do.md'
    ];

    for (const assetPath of paths) {
      const asset = templateAssets().find((item) => item.path === assetPath);
      expect(asset?.content).toContain('requires_apply');
      expect(asset?.content).toContain('apply.argv');
      expect(asset?.content).toContain('--apply <plan-token>');
      expect(fs.readFileSync(path.resolve(process.cwd(), assetPath), 'utf-8')).toBe(asset?.content);
    }
  });

  it('reports outdated generated agent assets without overwriting user-owned files', () => {
    const { agentAssetStatus, initCore, runDoctor } = require('../packages/terrace-core/src/index.cjs') as {
      agentAssetStatus: (cwd: string) => { complete: boolean; outdated: string[]; outdated_count: number; remediation: string | null };
      initCore: (cwd: string, options: { projectName: string }) => unknown;
      runDoctor: (cwd: string) => { warnings: Array<{ code: string }> };
    };
    initCore(tmpDir, { projectName: 'agent-drift' });
    const stalePath = path.join(tmpDir, '.agents', 'skills', 'terrace-do', 'SKILL.md');
    const staleContent = '# Older Terrace Do\n';
    fs.writeFileSync(stalePath, staleContent, 'utf-8');

    const status = agentAssetStatus(tmpDir);

    expect(status).toMatchObject({
      complete: false,
      outdated_count: 1,
      outdated: ['.agents/skills/terrace-do/SKILL.md'],
      remediation: expect.stringContaining('will not overwrite user-owned files')
    });
    expect(fs.readFileSync(stalePath, 'utf-8')).toBe(staleContent);
    expect(runDoctor(tmpDir).warnings).toContainEqual(expect.objectContaining({ code: 'OUTDATED_AGENT_ASSETS' }));
  });

  it('reports outdated root instruction files without overwriting user-owned guidance', () => {
    const { agentAssetStatus, initCore, runDoctor } = require('../packages/terrace-core/src/index.cjs') as {
      agentAssetStatus: (cwd: string) => { complete: boolean; outdated: string[]; outdated_count: number; remediation: string | null };
      initCore: (cwd: string, options: { projectName: string }) => unknown;
      runDoctor: (cwd: string) => { warnings: Array<{ code: string }> };
    };
    initCore(tmpDir, { projectName: 'root-guidance-drift' });
    const rootInstructions = path.join(tmpDir, 'AGENTS.md');
    const customContent = '# Team-owned instructions\n';
    fs.writeFileSync(rootInstructions, customContent, 'utf-8');

    const status = agentAssetStatus(tmpDir);

    expect(status).toMatchObject({
      complete: false,
      outdated_count: 1,
      outdated: ['AGENTS.md'],
      remediation: expect.stringContaining('will not overwrite user-owned files')
    });
    expect(fs.readFileSync(rootInstructions, 'utf-8')).toBe(customContent);
    expect(runDoctor(tmpDir).warnings).toContainEqual(expect.objectContaining({ code: 'OUTDATED_AGENT_ASSETS' }));
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
