// Phase 2 RED stubs — covers AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

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
    expect(commands).toContainEqual(expect.objectContaining({ command: 'terrace blocker resolve <id> --owner <owner> --evidence <ref>', json: true }));
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

  it('terrace-resume generated command preserves blocker ownership', () => {
    const { templateAssets } = require('../packages/terrace-core/src/agents.cjs') as { templateAssets: () => Array<{ path: string; content: string }> };
    const assetPath = '.claude/commands/terrace-resume.md';
    const asset = templateAssets().find((item) => item.path === assetPath);

    expect(asset?.content).toContain('An active workspace');
    expect(asset?.content).toContain('lock is not authority to delete the lock, retry, or invent a next command');
    expect(asset?.content).toContain('surface a next command when Terrace supplied one');
    expect(fs.readFileSync(path.resolve(process.cwd(), assetPath), 'utf-8')).toBe(asset?.content);
  });

  it('keeps source-owned generated assets distinct from consumer bootstrap templates', () => {
    const {
      repoGeneratedAssetStatus,
      repoGeneratedTemplateAssets,
      templateAssets,
      listAgentCommands
    } = require('../packages/terrace-core/src/index.cjs') as {
      repoGeneratedAssetStatus: (cwd: string) => {
        scope: string;
        expected_total: number;
        missing: string[];
        stale: string[];
        complete: boolean;
        remediation: string | null;
      };
      repoGeneratedTemplateAssets: () => Array<{ path: string; scope: string; content: string }>;
      templateAssets: () => Array<{ path: string; scope: string }>;
      listAgentCommands: () => Array<{ name: string }>;
    };
    const sourceAssets = repoGeneratedTemplateAssets();
    const allAssets = templateAssets();
    const status = repoGeneratedAssetStatus(process.cwd());

    expect(sourceAssets).toHaveLength(listAgentCommands().length * 3);
    expect(sourceAssets.every((asset) => asset.scope === 'repo_generated')).toBe(true);
    expect(sourceAssets.some((asset) => asset.path === 'AGENTS.md' || asset.path === 'CLAUDE.md')).toBe(false);
    expect(allAssets.filter((asset) => asset.scope === 'consumer_bootstrap').map((asset) => asset.path)).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(status).toMatchObject({
      scope: 'repo_generated',
      expected_total: sourceAssets.length,
      missing: [],
      stale: [],
      complete: true,
      remediation: null
    });
  });

  it('reports source-owned drift without overwriting a consumer asset', () => {
    const {
      initCore,
      repoGeneratedAssetStatus
    } = require('../packages/terrace-core/src/index.cjs') as {
      initCore: (cwd: string, options: { projectName: string }) => unknown;
      repoGeneratedAssetStatus: (cwd: string) => { stale: string[]; missing: string[]; complete: boolean };
    };
    initCore(tmpDir, { projectName: 'source-parity-read-only' });
    const stalePath = path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md');
    const missingPath = path.join(tmpDir, '.claude', 'commands', 'terrace-next.md');
    const staleContent = '# Consumer-owned override\n';
    fs.writeFileSync(stalePath, staleContent, 'utf-8');
    fs.rmSync(missingPath);

    const status = repoGeneratedAssetStatus(tmpDir);

    expect(status).toMatchObject({
      complete: false,
      stale: ['.agents/skills/terrace-next/SKILL.md'],
      missing: ['.claude/commands/terrace-next.md']
    });
    expect(fs.readFileSync(stalePath, 'utf-8')).toBe(staleContent);
    expect(fs.existsSync(missingPath)).toBe(false);
  });

  it('runs the source-only parity check without invoking Terrace', () => {
    const result = spawnSync('node', ['tools/check-repo-agent-assets.cjs'], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      scope: 'repo_generated',
      complete: true,
      missing_count: 0,
      stale_count: 0,
      source_tracking_checked: true,
      untracked_source_assets: []
    });
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
