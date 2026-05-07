import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const NODE_BIN = process.execPath;

describe('--json output mode for all CLI commands (CLI-12)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-json-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('terrace init --json produces parseable strict-core init output', () => {
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(parsed.created).toContain('.terrace/state.json');
    expect(parsed.agents.enabled).toBe(true);
    expect(parsed.agents.manifest_path).toBe('.terrace/agents/manifest.json');
    expect(parsed.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'written' }),
      expect.objectContaining({ path: 'CLAUDE.md', status: 'written' }),
      expect.objectContaining({ path: '.terrace/agents/manifest.json', status: 'written' })
    ]));
  });

  it('terrace agents install-global --json installs into the configured global agents directory', () => {
    const globalAgentsDir = path.join(tmpDir, 'global-agents');
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'agents', 'install-global', '--json'], {
      cwd: tmpDir,
      encoding: 'utf-8',
      env: { ...process.env, TERRACE_GLOBAL_AGENTS_DIR: globalAgentsDir }
    });
    const parsed = JSON.parse(stdout);
    expect(parsed.enabled).toBe(true);
    expect(parsed.global_agents_dir).toBe(globalAgentsDir);
    expect(parsed.next_command).toBe('/terrace');
    expect(parsed.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'skills/terrace/SKILL.md', status: 'written' }),
      expect.objectContaining({ path: 'skills/terrace-next/SKILL.md', status: 'written' }),
      expect.objectContaining({ path: 'terrace/manifest.json', status: 'written' })
    ]));
    expect(fs.existsSync(path.join(globalAgentsDir, 'skills', 'terrace', 'SKILL.md'))).toBe(true);
  });

  it('terrace doctor --json produces parseable JSON with blocking and warnings', () => {
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'doctor', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout) as { blocking: unknown[]; warnings: unknown[] };
    expect(parsed).toHaveProperty('blocking');
    expect(parsed).toHaveProperty('warnings');
  });

  it('terrace preset list --json produces parseable JSON array', () => {
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'preset', 'list', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('terrace phase set --json produces parseable JSON with updated workflow status', () => {
    execFileSync(NODE_BIN, [TERRACE_CLI, 'init', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const stdout = execFileSync(NODE_BIN, [TERRACE_CLI, 'phase', 'set', 'intake_recorded', '--json'], { cwd: tmpDir, encoding: 'utf-8' });
    const parsed = JSON.parse(stdout) as { workflow: { status: string } };
    expect(parsed.workflow.status).toBe('intake_recorded');
  });
});
