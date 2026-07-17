import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'src', 'terrace-tools.cjs');
const windowsShell = process.platform === 'win32';

function pnpmExec(args: string[], options: { cwd: string; encoding: BufferEncoding; timeout?: number }) {
  return execFileSync('pnpm', args, { ...options, shell: windowsShell });
}

function terraceExec(terraceBin: string, args: string[], options: { cwd: string; encoding: BufferEncoding; env?: NodeJS.ProcessEnv }) {
  return execFileSync(terraceBin, args, { ...options, shell: windowsShell });
}

function packedPaths(): string[] {
  const output = pnpmExec(['pack', '--dry-run', '--json', '--config.node-linker=hoisted'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  return (JSON.parse(output) as { files: Array<{ path: string }> }).files.map((file) => file.path);
}

type GlobalCommandSurface = {
  name: string;
  help?: string;
};

type AgentAsset = {
  path: string;
  type: string;
  status: string;
};

const { listProductReadinessSurface, renderReadmeCommandIndex } = require('../packages/terrace-core/src/index.cjs') as {
  listProductReadinessSurface: () => GlobalCommandSurface[];
  renderReadmeCommandIndex: () => string;
};

const globalCommandSurface = listProductReadinessSurface();

describe('tier-one product readiness', () => {
  it('exposes registry metadata for a publishable CLI package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(pkg.bin).toEqual({ terrace: 'src/terrace-tools.cjs' });
    expect(pkg.main).toBe('packages/terrace-core/src/index.cjs');
    expect(pkg.files).toEqual([
      'src/',
      'scripts/',
      'packages/terrace-core/',
      'README.md',
      'LICENSE',
      'CHANGELOG.md'
    ]);
    expect(pkg.license).toBe('MIT');
    expect(pkg.author.name).toBe('Jakye Amos');
    expect(pkg.homepage).toBe('https://github.com/jakyeamos/Terrace#readme');
    expect(pkg.bugs.url).toBe('https://github.com/jakyeamos/Terrace/issues');
    expect(pkg.publishConfig).toMatchObject({ access: 'public', provenance: true });
    expect(pkg.repository.type).toBe('git');
    expect(pkg.exports['.']).toBe('./packages/terrace-core/src/index.cjs');
  });

  it('keeps the legacy main entry import-safe', () => {
    const script = [
      'const library = require(' + JSON.stringify(repoRoot) + ');',
      'const cliPath = require.resolve(' + JSON.stringify(cliPath) + ');',
      'process.stdout.write(JSON.stringify({ init_core: typeof library.initCore, cli_loaded: Boolean(require.cache[cliPath]) }));'
    ].join('\n');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ init_core: 'function', cli_loaded: false });
  });

  it('documents install, quickstart, command reference, workflow examples, and troubleshooting', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

    for (const heading of ['Install', 'Quickstart', 'What Terrace Creates', 'Release Readiness', 'Command Reference', 'Workflow Example', 'Troubleshooting']) {
      expect(readme).toContain('## ' + heading);
    }
    expect(readme).toContain('terrace report` is read-only');
    expect(readme).toContain('pnpm audit --audit-level moderate');
    expect(readme).toContain('pnpm run release:dry-run');
    expect(readme).toContain('terrace init --force --yes');
  });

  it('keeps the README command index generated from the catalog', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
    const startMarker = '<!-- terrace-command-catalog:start -->';
    const endMarker = '<!-- terrace-command-catalog:end -->';
    const start = readme.indexOf(startMarker);
    const end = readme.indexOf(endMarker);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(readme.slice(start, end + endMarker.length)).toBe(renderReadmeCommandIndex());
  });

  it('prints top-level CLI help and version without requiring a Terrace state file', () => {
    const help = execFileSync('node', [cliPath, '--help'], { cwd: repoRoot, encoding: 'utf8' });
    const version = execFileSync('node', [cliPath, '--version'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const helpJson = JSON.parse(execFileSync('node', [cliPath, '--help', '--json'], { cwd: repoRoot, encoding: 'utf8' })) as {
      usage: string;
      sections: { common: Array<{ usage: string }>; advanced: Array<{ usage: string }>; compatibility: Array<{ usage: string }> };
      commands: Array<{ id: string }>;
    };
    const versionJson = JSON.parse(execFileSync('node', [cliPath, '--version', '--json'], { cwd: repoRoot, encoding: 'utf8' })) as {
      command: string;
      package: string;
      version: string;
    };
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(help).toContain('Usage: terrace <command>');
    expect(help).toContain('terrace init');
    expect(help).toContain('terrace agents install-global');
    expect(help).toContain('Common workflow:');
    expect(help).toContain('Advanced commands:');
    expect(help).toContain('Compatibility aliases:');
    expect(version).toBe(pkg.version);
    expect(helpJson).toMatchObject({ usage: 'terrace <command> [options]' });
    expect(helpJson.sections.common.map((entry) => entry.usage)).toContain('terrace next');
    expect(helpJson.sections.advanced.map((entry) => entry.usage)).toContain('terrace release-preflight [--static] [--fast|--local|--full] [--target-version <version>]');
    expect(helpJson.sections.compatibility.map((entry) => entry.usage)).toContain('terrace plan-phase <id>');
    expect(helpJson.commands.map((entry) => entry.id)).toContain('phase.set');
    expect(versionJson).toEqual({ command: 'terrace', package: pkg.name, version: pkg.version });
  });

  it('keeps legacy integration artifacts out of the publish allowlist', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(pkg.files).not.toContain('.agents');
    expect(pkg.files).not.toContain('.claude');
    expect(pkg.files).not.toContain('.planning');
    expect(pkg.files).not.toContain('.tracker');
    expect(pkg.files).not.toContain('tests');
  });

  it('contains only runtime assets in the publish payload', () => {
    const paths = packedPaths();
    const corpusConfig = fs.readFileSync(path.join(repoRoot, 'scripts', 'terrace-corpus-default-config.json'), 'utf8');

    expect(paths).toEqual(expect.arrayContaining([
      'src/terrace-tools.cjs',
      'scripts/terrace-corpus-eval.cjs',
      'scripts/terrace-corpus-default-config.json',
      'packages/terrace-core/src/index.cjs'
    ]));
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.length).toBeLessThan(160);
    expect(paths.some((file) => file.startsWith('docs/'))).toBe(false);
    expect(paths.some((file) => file.startsWith('docs/terrace/corpus/'))).toBe(false);
    expect(paths.some((file) => file.startsWith('.agents/') || file.startsWith('.claude/'))).toBe(false);
    expect(JSON.parse(corpusConfig)).toMatchObject({ realRepos: [] });
    expect(corpusConfig).not.toMatch(/\/Users\/|\/private\/|docs\/terrace\/corpus/);
  });

  it('publishes releases through GitHub trusted publishing instead of npm tokens', () => {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'release-publish.yml'), 'utf8');
    const releaseDocs = fs.readFileSync(path.join(repoRoot, 'docs', 'RELEASE.md'), 'utf8');
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('environment: npm');
    expect(workflow).toContain('pnpm publish --access public --provenance --no-git-checks --config.node-linker=hoisted');
    expect(workflow).not.toContain('NODE_AUTH_TOKEN');
    expect(workflow).not.toContain('NPM_TOKEN');
    expect(releaseDocs).toContain('npm trusted publishing');
    expect(releaseDocs).toContain('trusted_publishing');
    expect(releaseDocs).toContain('@jakyeamos33/terrace@0.2.0');
    expect(releaseDocs).not.toContain('pnpm whoami');
    expect(releaseDocs).not.toContain('run `pnpm publish');
    expect(readme).toContain('npm trusted publishing with OIDC');
  });

  it('records explicit truth-file verification metadata', () => {
    const truth = fs.readFileSync(path.join(repoRoot, '.tracker', 'PROJECT_TRUTH.md'), 'utf8');

    expect(truth).toMatch(/^lastVerifiedCommand: .+$/m);
    expect(truth).toMatch(/^lastVerifiedAt: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-04:00"$/m);
  });

  it('runs the packed CLI and global agent installer from a fresh consumer project', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-packed-consumer-'));
    const packDir = path.join(tmpRoot, 'pack');
    const consumerDir = path.join(tmpRoot, 'consumer');
    const globalAgentsDir = path.join(tmpRoot, 'global-agents');
    const globalClaudeDir = path.join(tmpRoot, 'global-claude');
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });

    try {
      const packOutput = pnpmExec(['pack', '--pack-destination', packDir, '--config.node-linker=hoisted'], {
        cwd: repoRoot,
        encoding: 'utf8'
      }).trim();
      const packedFile = packOutput.split(/\r?\n/).pop() || '';
      const tarballPath = path.isAbsolute(packedFile) ? packedFile : path.join(packDir, packedFile);

      fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'terrace-consumer', private: true }), 'utf8');
      pnpmExec(['add', '--ignore-scripts', tarballPath], {
        cwd: consumerDir,
        encoding: 'utf8',
        timeout: 60000
      });

      const terraceBin = path.join(consumerDir, 'node_modules', '.bin', 'terrace');
      const help = terraceExec(terraceBin, ['--help'], { cwd: consumerDir, encoding: 'utf8' });
      const version = terraceExec(terraceBin, ['--version'], { cwd: consumerDir, encoding: 'utf8' }).trim();
      const corpusPlan = JSON.parse(terraceExec(terraceBin, ['corpus', 'run', '--dry-run-plan', '--sample', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const globalInstall = JSON.parse(terraceExec(terraceBin, ['agents', 'install-global', '--json'], {
        cwd: consumerDir,
        encoding: 'utf8',
        env: {
          ...process.env,
          TERRACE_GLOBAL_AGENTS_DIR: globalAgentsDir,
          TERRACE_GLOBAL_CLAUDE_DIR: globalClaudeDir
        }
      }));
      const init = JSON.parse(terraceExec(terraceBin, ['init', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const statePath = path.join(consumerDir, '.terrace', 'state.json');
      const eventsPath = path.join(consumerDir, '.terrace', 'events.jsonl');
      const stateBeforeRepeat = fs.readFileSync(statePath, 'utf8');
      const eventsBeforeRepeat = fs.readFileSync(eventsPath, 'utf8');
      const repeatedInit = JSON.parse(terraceExec(terraceBin, ['init', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      fs.rmSync(path.join(consumerDir, '.agents', 'skills', 'terrace-next'), { recursive: true });
      const agentRepair = JSON.parse(terraceExec(terraceBin, ['agents', 'repair', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      expect(fs.readFileSync(statePath, 'utf8')).toBe(stateBeforeRepeat);
      expect(fs.readFileSync(eventsPath, 'utf8')).toBe(eventsBeforeRepeat);
      const terraceRoute = JSON.parse(terraceExec(terraceBin, ['do', 'what next', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const terraceNext = JSON.parse(terraceExec(terraceBin, ['next', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const doctor = JSON.parse(terraceExec(terraceBin, ['doctor', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const audit = JSON.parse(terraceExec(terraceBin, ['audit', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const reportPath = path.join(consumerDir, '.terrace', 'report-card.json');
      expect(fs.existsSync(reportPath)).toBe(false);
      const report = JSON.parse(terraceExec(terraceBin, ['report', 'update', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const reportMtime = fs.statSync(reportPath).mtimeMs;
      const ship = spawnSync(terraceBin, ['ship', 'check', '--json'], { cwd: consumerDir, encoding: 'utf8', shell: windowsShell });

      expect(help).toContain('Usage: terrace <command>');
      expect(version).toBe(JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version);
      expect(corpusPlan.plan).toEqual(expect.any(Array));
      expect(corpusPlan.plan.length).toBeGreaterThan(0);
      expect(fs.statSync(tarballPath).size).toBeLessThan(300_000);
      expect(globalInstall).toMatchObject({
        enabled: true,
        global_agents_dir: globalAgentsDir,
        global_claude_dir: globalClaudeDir,
        next_command: '/terrace'
      });
      for (const command of globalCommandSurface) {
        if (command.help) {
          expect(help).toContain(command.help);
        }
      }
      expect(globalInstall.assets).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'skills/terrace/SKILL.md', status: 'written' }),
        expect.objectContaining({ path: 'skills/terrace-next/SKILL.md', status: 'written' }),
        expect.objectContaining({ path: 'skills/terrace-ship-check/SKILL.md', status: 'written' }),
        expect.objectContaining({ path: 'skills/terrace-workbench-prepare/SKILL.md', status: 'written' }),
        expect.objectContaining({ path: 'terrace/manifest.json', status: 'written' })
      ]));
      expect(globalInstall.claude_assets).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'skills/terrace/SKILL.md', status: 'written' }),
        expect.objectContaining({ path: 'commands/terrace.md', status: 'written' }),
        expect.objectContaining({ path: 'commands/terrace-next.md', status: 'written' }),
        expect.objectContaining({ path: 'commands/terrace-ship-check.md', status: 'written' }),
        expect.objectContaining({ path: 'commands/terrace-workbench-prepare.md', status: 'written' }),
        expect.objectContaining({ path: 'terrace/manifest.json', status: 'written' })
      ]));
      const codexManifest = JSON.parse(fs.readFileSync(path.join(globalAgentsDir, 'terrace', 'manifest.json'), 'utf8')) as { schema_version: string; generated_by: string; assets: AgentAsset[] };
      const claudeManifest = JSON.parse(fs.readFileSync(path.join(globalClaudeDir, 'terrace', 'manifest.json'), 'utf8')) as { schema_version: string; generated_by: string; assets: AgentAsset[] };
      const codexAssetPaths = new Set((globalInstall.assets as AgentAsset[]).map((asset) => asset.path));
      const claudeAssetPaths = new Set((globalInstall.claude_assets as AgentAsset[]).map((asset) => asset.path));
      const codexManifestPaths = new Set(codexManifest.assets.map((asset) => asset.path));
      const claudeManifestPaths = new Set(claudeManifest.assets.map((asset) => asset.path));

      expect(codexManifest).toMatchObject({ schema_version: '1.0', generated_by: 'terrace agents install-global' });
      expect(claudeManifest).toMatchObject({ schema_version: '1.0', generated_by: 'terrace agents install-global' });
      expect(codexManifest.assets).toEqual((globalInstall.assets as AgentAsset[]).filter((asset) => asset.path !== 'terrace/manifest.json'));
      expect(claudeManifest.assets).toEqual((globalInstall.claude_assets as AgentAsset[]).filter((asset) => asset.path !== 'terrace/manifest.json'));
      expect((globalInstall.assets as AgentAsset[]).filter((asset) => asset.type === 'codex-global-skill')).toHaveLength(globalCommandSurface.length + 1);
      expect((globalInstall.claude_assets as AgentAsset[]).filter((asset) => asset.type === 'claude-global-skill')).toHaveLength(globalCommandSurface.length + 1);
      expect((globalInstall.claude_assets as AgentAsset[]).filter((asset) => asset.type === 'claude-global-command')).toHaveLength(globalCommandSurface.length + 1);
      for (const command of globalCommandSurface) {
        const codexSkillPath = `skills/${command.name}/SKILL.md`;
        const claudeSkillPath = `skills/${command.name}/SKILL.md`;
        const claudeCommandPath = `commands/${command.name}.md`;
        expect(codexAssetPaths.has(codexSkillPath)).toBe(true);
        expect(claudeAssetPaths.has(claudeSkillPath)).toBe(true);
        expect(claudeAssetPaths.has(claudeCommandPath)).toBe(true);
        expect(codexManifestPaths.has(codexSkillPath)).toBe(true);
        expect(claudeManifestPaths.has(claudeSkillPath)).toBe(true);
        expect(claudeManifestPaths.has(claudeCommandPath)).toBe(true);
        expect(fs.readFileSync(path.join(globalAgentsDir, codexSkillPath), 'utf8')).toContain(`name: ${command.name}`);
        expect(fs.readFileSync(path.join(globalClaudeDir, claudeSkillPath), 'utf8')).toContain(`name: ${command.name}`);
        expect(fs.readFileSync(path.join(globalClaudeDir, claudeCommandPath), 'utf8')).toContain('Run `terrace');
      }
      const codexTerraceEntrypoint = fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace', 'SKILL.md'), 'utf8');
      const codexTerraceNext = fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'utf8');
      const claudeTerraceEntrypoint = fs.readFileSync(path.join(globalClaudeDir, 'commands', 'terrace.md'), 'utf8');
      expect(codexTerraceEntrypoint).toContain('name: terrace');
      expect(codexTerraceEntrypoint).toContain('terrace do "$ARGUMENTS"');
      expect(codexTerraceEntrypoint).toContain('terrace next');
      expect(codexTerraceNext).toContain('Run `terrace next`.');
      expect(claudeTerraceEntrypoint).toContain('description: Route Terrace workflow intent through the local Terrace CLI.');
      expect(claudeTerraceEntrypoint).toContain('argument-hint: <intent> | --apply <plan-token>');
      expect(claudeTerraceEntrypoint).toContain('terrace do "$ARGUMENTS"');
      expect(init.created).toContain('.terrace/state.json');
      expect(repeatedInit).toMatchObject({ mode: 'already_initialized', created: [] });
      expect(agentRepair.assets).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: '.agents/skills/terrace-next/SKILL.md', status: 'written' })
      ]));
      expect(terraceRoute.command).toBe('terrace next');
      expect(terraceRoute.result.command).toBe(terraceNext.command);
      expect(doctor.healthy).toBe(true);
      expect(audit.healthy).toBe(true);
      expect(audit.read_only).toBe(true);
      expect(report.artifact).toBe('.terrace/report-card.json');
      expect(JSON.parse(ship.stdout).categories.map((category: { category: string }) => category.category)).toContain('tier_one_report');
      expect(ship.stdout).not.toContain(repoRoot);
      expect(fs.existsSync(path.join(consumerDir, '.terrace', 'state.json'))).toBe(true);
      expect(fs.statSync(reportPath).mtimeMs).toBe(reportMtime);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  }, 180000);
});
