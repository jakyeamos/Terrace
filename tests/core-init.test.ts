import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      packageManager: 'pnpm@11.7.0',
      scripts: {
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
        lint: 'eslint .'
      }
    }), 'utf-8');
    const commands = detectCommands(tmpDir);
    expect(commands.package_manager).toBe('pnpm');
    expect(commands.test_command).toBe('pnpm test');
    expect(commands.typecheck_command).toBe('pnpm run typecheck');
    expect(commands.lint_command).toBe('pnpm run lint');
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
    expect(fs.readFileSync(path.join(tmpDir, '.agents', 'skills', 'terrace-interrogate', 'SKILL.md'), 'utf-8')).toContain('do not tell the user to rerun a command');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toContain('name: terrace-next');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'commands', 'terrace-next.md'), 'utf-8')).toContain('description: Find and follow the next Terrace workflow action.');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'commands', 'terrace-interrogate.md'), 'utf-8')).toContain('Use the answers as the authority');
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

  it('preserves existing core artifacts byte-for-byte on repeated init', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const configPath = path.join(tmpDir, '.terrace', 'config.json');
    const registryPath = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    const eventsPath = path.join(tmpDir, '.terrace', 'events.jsonl');
    const rulePaths = ['testing-trust', 'security', 'architecture', 'pentest', 'maintainability']
      .map((name) => path.join(tmpDir, '.terrace', 'rules', name + '.json'));

    fs.writeFileSync(statePath, 'not valid JSON\n', 'utf-8');
    fs.writeFileSync(configPath, '{"custom":true}\n', 'utf-8');
    fs.writeFileSync(registryPath, '{"version":"custom","presets":["keep"]}\n', 'utf-8');
    fs.writeFileSync(eventsPath, '{"event_id":"keep","command":"custom"}\n', 'utf-8');
    for (const rulePath of rulePaths) {
      fs.writeFileSync(rulePath, '{"custom":true}\n', 'utf-8');
    }
    const before = new Map([statePath, configPath, registryPath, eventsPath, ...rulePaths]
      .map((filePath) => [filePath, fs.readFileSync(filePath, 'utf-8')]));

    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      mode: string;
      created: string[];
      preserved: string[];
    };

    expect(result.mode).toBe('already_initialized');
    expect(result.created).toEqual([]);
    expect(result.preserved).toEqual(expect.arrayContaining([
      '.terrace/state.json',
      '.terrace/config.json',
      '.terrace/presets/registry.json',
      '.terrace/events.jsonl',
      '.terrace/rules/testing-trust.json'
    ]));
    for (const [filePath, content] of before) {
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
    }
  });

  it('repairs only missing core and agent artifacts without changing established state', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const eventsPath = path.join(tmpDir, '.terrace', 'events.jsonl');
    const stateBefore = fs.readFileSync(statePath, 'utf-8');
    const eventsBefore = fs.readFileSync(eventsPath, 'utf-8');

    fs.rmSync(path.join(tmpDir, '.terrace', 'config.json'));
    fs.rmSync(path.join(tmpDir, '.terrace', 'presets', 'registry.json'));
    fs.rmSync(path.join(tmpDir, '.terrace', 'rules', 'security.json'));
    fs.rmSync(path.join(tmpDir, 'docs', 'spec'), { recursive: true });
    fs.rmSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true });

    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      mode: string;
      created: string[];
    };

    expect(result.mode).toBe('repaired');
    expect(result.created).toEqual(expect.arrayContaining([
      '.terrace/config.json',
      '.terrace/presets/registry.json',
      '.terrace/rules/security.json',
      'docs/spec',
      '.agents/skills/terrace-next/SKILL.md'
    ]));
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBefore);
    expect(fs.readFileSync(eventsPath, 'utf-8')).toBe(eventsBefore);
  });

  it('requires force and yes together before resetting, then preserves a backup', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const configPath = path.join(tmpDir, '.terrace', 'config.json');
    const customRulePath = path.join(tmpDir, '.terrace', 'rules', 'custom.json');
    const customAgentPath = path.join(tmpDir, 'AGENTS.md');
    const stateBefore = JSON.stringify({ workflow: { status: 'handoff_ready' }, preserved: true }, null, 2) + '\n';
    const configBefore = '{"custom":true}\n';
    fs.writeFileSync(statePath, stateBefore, 'utf-8');
    fs.writeFileSync(configPath, configBefore, 'utf-8');
    fs.writeFileSync(customRulePath, '{"rule":"keep"}\n', 'utf-8');
    fs.writeFileSync(customAgentPath, '# User-owned instructions\n', 'utf-8');

    expect(() => initCore(tmpDir, { projectName: 'demo', force: true })).toThrow(/--force --yes/);
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBefore);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(configBefore);

    const result = initCore(tmpDir, { projectName: 'demo', force: true, yes: true }) as {
      mode: string;
      reset: { backup_path: string; overwritten: string[] };
    };

    expect(result.mode).toBe('reset');
    expect(result.reset.overwritten).toEqual(expect.arrayContaining([
      '.terrace/state.json',
      '.terrace/config.json'
    ]));
    expect(fs.readFileSync(path.join(tmpDir, result.reset.backup_path, 'state.json'), 'utf-8')).toBe(stateBefore);
    expect(fs.readFileSync(path.join(tmpDir, result.reset.backup_path, 'config.json'), 'utf-8')).toBe(configBefore);
    expect(fs.readFileSync(statePath, 'utf-8')).not.toBe(stateBefore);
    expect(fs.readFileSync(customRulePath, 'utf-8')).toBe('{"rule":"keep"}\n');
    expect(fs.readFileSync(customAgentPath, 'utf-8')).toBe('# User-owned instructions\n');
    expect(readEvents(tmpDir)).toEqual([
      expect.objectContaining({
        command: 'terrace init --force --yes',
        from_state: 'handoff_ready',
        to_state: 'initialized'
      })
    ]);
  });

  it('refuses a forced reset through a symlinked managed state path before backup or rollback can touch the target', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const externalPath = path.join(tmpDir, 'outside-state.json');
    const sentinel = '{"external":true}\n';
    fs.writeFileSync(externalPath, sentinel, 'utf8');
    fs.rmSync(statePath);
    fs.symlinkSync(externalPath, statePath);
    let resetError: { details?: { code?: string } } | null = null;

    try {
      initCore(tmpDir, { projectName: 'demo', force: true, yes: true });
    } catch (error) {
      resetError = error as { details?: { code?: string } };
    }

    expect(resetError).toMatchObject({
      details: expect.objectContaining({ code: 'INIT_RESET_PATH_UNSAFE' })
    });
    expect(fs.readFileSync(externalPath, 'utf8')).toBe(sentinel);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'backups'))).toBe(false);
  });

  it('backs up a managed agent manifest before a forced reset repairs partial assets', () => {
    initCore(tmpDir, { projectName: 'demo' });
    fs.rmSync(path.join(tmpDir, '.terrace'), { recursive: true, force: true });
    fs.rmSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next'), { recursive: true, force: true });
    const manifestPath = path.join(tmpDir, '.terrace', 'agents', 'manifest.json');
    const manifestBefore = '{"generated_by":"older Terrace"}\n';
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, manifestBefore, 'utf-8');

    const result = initCore(tmpDir, { projectName: 'demo', force: true, yes: true }) as {
      mode: string;
      reset: { backup_path: string; backed_up: string[]; overwritten: string[] };
    };

    expect(result.mode).toBe('reset');
    expect(result.reset.backed_up).toContain('.terrace/agents/manifest.json');
    expect(result.reset.overwritten).toContain('.terrace/agents/manifest.json');
    expect(fs.readFileSync(path.join(tmpDir, result.reset.backup_path, 'agents', 'manifest.json'), 'utf-8')).toBe(manifestBefore);
    expect(fs.readFileSync(manifestPath, 'utf-8')).not.toBe(manifestBefore);
    expect(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md'))).toBe(true);
  });

  it('does not partially reset state when reset configuration cannot be prepared', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const configPath = path.join(tmpDir, '.terrace', 'config.json');
    const stateBefore = '{"workflow":{"status":"handoff_ready"}}\n';
    const configBefore = '{"custom":true}\n';
    fs.writeFileSync(statePath, stateBefore, 'utf-8');
    fs.writeFileSync(configPath, configBefore, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{not valid json\n', 'utf-8');

    expect(() => initCore(tmpDir, { projectName: 'demo', force: true, yes: true })).toThrow();
    expect(fs.readFileSync(statePath, 'utf-8')).toBe(stateBefore);
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(configBefore);
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'backups'))).toBe(false);
  });

  it('restores managed artifacts from backup when a forced reset fails after writing', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const configPath = path.join(tmpDir, '.terrace', 'config.json');
    const registryPath = path.join(tmpDir, '.terrace', 'presets', 'registry.json');
    const eventsPath = path.join(tmpDir, '.terrace', 'events.jsonl');
    const manifestPath = path.join(tmpDir, '.terrace', 'agents', 'manifest.json');
    const missingAgentPath = path.join(tmpDir, '.agents', 'skills', 'terrace-next', 'SKILL.md');
    const rulePaths = ['testing-trust', 'security', 'architecture', 'pentest', 'maintainability']
      .map((name) => path.join(tmpDir, '.terrace', 'rules', name + '.json'));
    const originals = new Map<string, string>([
      [statePath, '{"workflow":{"status":"handoff_ready"}}\n'],
      [configPath, '{"custom":true}\n'],
      [registryPath, '{"version":"custom","presets":["keep"]}\n'],
      [eventsPath, '{"event_id":"keep","command":"custom"}\n'],
      [manifestPath, fs.readFileSync(manifestPath, 'utf-8')],
      ...rulePaths.map((rulePath) => [rulePath, '{"custom":true}\n'] as [string, string])
    ]);
    for (const [filePath, content] of originals) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    fs.rmSync(path.dirname(missingAgentPath), { recursive: true, force: true });
    const mutableFs = require('fs') as typeof fs;
    const appendFailure = vi.spyOn(mutableFs, 'appendFileSync').mockImplementationOnce(() => {
      throw new Error('simulated reset event failure');
    });
    let resetError: { details?: { code?: string; backup_path?: string } } | null = null;

    try {
      try {
        initCore(tmpDir, { projectName: 'demo', force: true, yes: true });
      } catch (error) {
        resetError = error as { details?: { code?: string; backup_path?: string } };
      }
    } finally {
      appendFailure.mockRestore();
    }

    expect(resetError).toMatchObject({
      details: expect.objectContaining({
        code: 'INIT_RESET_ROLLED_BACK',
        backup_path: expect.stringMatching(/^\.terrace\/backups\//)
      })
    });
    for (const [filePath, content] of originals) {
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
    }
    expect(fs.existsSync(missingAgentPath)).toBe(false);
  });

  it('installs global Codex and Claude Terrace skills without overwriting user-owned files', () => {
    const globalAgentsDir = path.join(tmpDir, 'global-agents');
    const globalClaudeDir = path.join(tmpDir, 'global-claude');
    fs.mkdirSync(path.join(globalAgentsDir, 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'custom global skill\n', 'utf-8');
    fs.mkdirSync(path.join(globalClaudeDir, 'commands'), { recursive: true });
    fs.writeFileSync(path.join(globalClaudeDir, 'commands', 'terrace-next.md'), 'custom global command\n', 'utf-8');

    const result = installGlobalAgentBootstrap({ globalAgentsDir, globalClaudeDir }) as {
      enabled: boolean;
      global_agents_dir: string;
      global_claude_dir: string;
      manifest_path: string;
      claude_manifest_path: string;
      assets: Array<{ path: string; type: string; status: string }>;
      claude_assets: Array<{ path: string; type: string; status: string }>;
      next_command: string;
    };

    expect(result.enabled).toBe(true);
    expect(result.global_agents_dir).toBe(globalAgentsDir);
    expect(result.global_claude_dir).toBe(globalClaudeDir);
    expect(result.manifest_path).toBe('terrace/manifest.json');
    expect(result.claude_manifest_path).toBe('terrace/manifest.json');
    expect(result.next_command).toBe('/terrace');
    expect(result.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'skills/terrace/SKILL.md', type: 'codex-global-skill', status: 'written' }),
      expect.objectContaining({ path: 'skills/terrace-next/SKILL.md', type: 'codex-global-skill', status: 'skipped' }),
      expect.objectContaining({ path: 'skills/terrace-ship-check/SKILL.md', type: 'codex-global-skill', status: 'written' }),
      expect.objectContaining({ path: 'terrace/manifest.json', type: 'global-manifest', status: 'written' })
    ]));
    expect(result.claude_assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'skills/terrace/SKILL.md', type: 'claude-global-skill', status: 'written' }),
      expect.objectContaining({ path: 'commands/terrace.md', type: 'claude-global-command', status: 'written' }),
      expect.objectContaining({ path: 'commands/terrace-next.md', type: 'claude-global-command', status: 'skipped' }),
      expect.objectContaining({ path: 'commands/terrace-ship-check.md', type: 'claude-global-command', status: 'written' }),
      expect.objectContaining({ path: 'terrace/manifest.json', type: 'global-manifest', status: 'written' })
    ]));
    expect(fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace', 'SKILL.md'), 'utf-8')).toContain('name: terrace');
    expect(fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toBe('custom global skill\n');
    expect(fs.readFileSync(path.join(globalClaudeDir, 'skills', 'terrace', 'SKILL.md'), 'utf-8')).toContain('name: terrace');
    expect(fs.readFileSync(path.join(globalClaudeDir, 'commands', 'terrace-next.md'), 'utf-8')).toBe('custom global command\n');
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
