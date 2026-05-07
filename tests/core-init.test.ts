import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { agentAssetExpectations, initCore, installGlobalAgentBootstrap, readEvents, detectCommands } = require('../packages/terrace-core/src/index.cjs');

describe('terrace-core init and events', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects Node test commands from package.json once at init', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
        lint: 'eslint .'
      }
    }), 'utf-8');
    const commands = detectCommands(tmpDir);
    expect(commands.test_command).toBe('npm test');
    expect(commands.typecheck_command).toBe('npm run typecheck');
    expect(commands.lint_command).toBe('npm run lint');
  });

  it('initCore writes state, config, events, rules, and docs directories', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest run' } }), 'utf-8');
    const result = initCore(tmpDir, { projectName: 'demo' });
    expect(result.created).toContain('.terrace/state.json');
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'state.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'events.jsonl'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'rules', 'testing-trust.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'spec'))).toBe(true);
  });

  it('initCore installs default agent bootstrap assets in a fresh repo', () => {
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { enabled: boolean; manifest_path: string; assets: Array<{ path: string; type: string; status: string }> };
    };
    expect(result.agents.enabled).toBe(true);
    expect(result.agents.manifest_path).toBe('.terrace/agents/manifest.json');
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', type: 'codex-instructions', status: 'written' }),
      expect.objectContaining({ path: 'CLAUDE.md', type: 'claude-instructions', status: 'written' }),
      expect.objectContaining({ path: '.claude/skills/terrace-next/SKILL.md', type: 'claude-skill', status: 'written' }),
      expect.objectContaining({ path: '.claude/commands/terrace-next.md', type: 'claude-command', status: 'written' }),
      expect.objectContaining({ path: '.agents/skills/terrace-next/SKILL.md', type: 'codex-skill', status: 'written' }),
      expect.objectContaining({ path: '.agents/skills/terrace-align/SKILL.md', type: 'codex-skill', status: 'written' }),
      expect.objectContaining({ path: '.agents/skills/terrace-phase-complete/SKILL.md', type: 'codex-skill', status: 'written' }),
      expect.objectContaining({ path: '.agents/skills/terrace-ship-check/SKILL.md', type: 'codex-skill', status: 'written' }),
      expect.objectContaining({ path: '.claude/commands/terrace-align.md', type: 'claude-command', status: 'written' }),
      expect.objectContaining({ path: '.claude/commands/terrace-ship-check.md', type: 'claude-command', status: 'written' }),
      expect.objectContaining({ path: '.terrace/agents/manifest.json', type: 'manifest', status: 'written' })
    ]));
    expect(result.agents.assets.filter((asset) => asset.type === 'codex-skill')).toHaveLength(agentAssetExpectations().codexSkills);
    expect(result.agents.assets.filter((asset) => asset.type === 'claude-command')).toHaveLength(agentAssetExpectations().claudeCommands);
    expect(result.created).toContain('AGENTS.md');
    expect(result.created).toContain('CLAUDE.md');
    expect(result.created).toContain('.terrace/agents/manifest.json');
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toContain('terrace next');
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')).toContain('terrace do "<intent>"');
    expect(fs.readFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toContain('name: terrace-next');
    expect(fs.readFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-align', 'SKILL.md'), 'utf-8')).toContain('Run `terrace align $ARGUMENTS`.');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toContain('name: terrace-next');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'commands', 'terrace-next.md'), 'utf-8')).toContain('description: Find and follow the next Terrace workflow action.');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-ship-check', 'SKILL.md'), 'utf-8')).toContain('description: Run read-only release readiness checks.');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'agents', 'manifest.json'), 'utf-8')) as {
      schema_version: string;
      assets: Array<{ path: string; status: string }>;
    };
    expect(manifest.schema_version).toBe('1.0');
    expect(manifest.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'written' })
    ]));
  });

  it('initCore preserves existing user-owned agent files', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Custom Codex guidance\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'custom skill\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'), 'custom codex skill\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.claude', 'commands'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'commands', 'terrace-next.md'), 'custom command\n', 'utf-8');
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { assets: Array<{ path: string; status: string }> };
    };
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toBe('# Custom Codex guidance\n');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toBe('custom skill\n');
    expect(fs.readFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toBe('custom codex skill\n');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'commands', 'terrace-next.md'), 'utf-8')).toBe('custom command\n');
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'skipped' }),
      expect.objectContaining({ path: '.claude/skills/terrace-next/SKILL.md', status: 'skipped' }),
      expect.objectContaining({ path: '.agents/skills/terrace-next/SKILL.md', status: 'skipped' }),
      expect.objectContaining({ path: '.claude/commands/terrace-next.md', status: 'skipped' })
    ]));
    expect(result.created).not.toContain('AGENTS.md');
    expect(result.created).not.toContain('.claude/skills/terrace-next/SKILL.md');
    expect(result.created).not.toContain('.agents/skills/terrace-next/SKILL.md');
    expect(result.created).not.toContain('.claude/commands/terrace-next.md');
  });

  it('initCore reports unchanged agent assets on repeated init', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { assets: Array<{ path: string; status: string }> };
    };
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'unchanged' }),
      expect.objectContaining({ path: 'CLAUDE.md', status: 'unchanged' }),
      expect.objectContaining({ path: '.claude/skills/terrace-ship-check/SKILL.md', status: 'unchanged' }),
      expect.objectContaining({ path: '.claude/commands/terrace-ship-check.md', status: 'unchanged' }),
      expect.objectContaining({ path: '.agents/skills/terrace-ship-check/SKILL.md', status: 'unchanged' })
    ]));
    expect(result.created).not.toContain('AGENTS.md');
    expect(result.created).not.toContain('CLAUDE.md');
  });

  it('installs global Codex Terrace skills without overwriting user-owned files', () => {
    const globalAgentsDir = path.join(tmpDir, 'global-agents');
    fs.mkdirSync(path.join(globalAgentsDir, 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'custom global skill\n', 'utf-8');

    const result = installGlobalAgentBootstrap({ globalAgentsDir }) as {
      enabled: boolean;
      global_agents_dir: string;
      manifest_path: string;
      assets: Array<{ path: string; type: string; status: string }>;
      next_command: string;
    };

    expect(result.enabled).toBe(true);
    expect(result.global_agents_dir).toBe(globalAgentsDir);
    expect(result.manifest_path).toBe('terrace/manifest.json');
    expect(result.next_command).toBe('/terrace');
    expect(result.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'skills/terrace/SKILL.md', type: 'codex-global-skill', status: 'written' }),
      expect.objectContaining({ path: 'skills/terrace-next/SKILL.md', type: 'codex-global-skill', status: 'skipped' }),
      expect.objectContaining({ path: 'skills/terrace-ship-check/SKILL.md', type: 'codex-global-skill', status: 'written' }),
      expect.objectContaining({ path: 'terrace/manifest.json', type: 'global-manifest', status: 'written' })
    ]));
    expect(fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace', 'SKILL.md'), 'utf-8')).toContain('name: terrace');
    expect(fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toBe('custom global skill\n');
  });

  it('initCore records an init event with from_state and to_state', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const events = readEvents(tmpDir);
    expect(events).toHaveLength(1);
    expect(events[0].command).toBe('terrace init');
    expect(events[0].from_state).toBe('uninitialized');
    expect(events[0].to_state).toBe('initialized');
  });
});
