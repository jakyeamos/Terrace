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

describe('tier-one product readiness', () => {
  it('exposes registry metadata for a publishable CLI package', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(pkg.bin).toEqual({ terrace: 'src/terrace-tools.cjs' });
    expect(pkg.files).toEqual([
      'src/',
      'scripts/',
      'packages/terrace-core/',
      'README.md',
      'LICENSE',
      'CHANGELOG.md',
      'docs/'
    ]);
    expect(pkg.license).toBe('MIT');
    expect(pkg.author.name).toBe('Jakye Amos');
    expect(pkg.homepage).toBe('https://github.com/jakyeamos/Terrace#readme');
    expect(pkg.bugs.url).toBe('https://github.com/jakyeamos/Terrace/issues');
    expect(pkg.publishConfig).toMatchObject({ access: 'public', provenance: true });
    expect(pkg.repository.type).toBe('git');
    expect(pkg.exports['.']).toBe('./packages/terrace-core/src/index.cjs');
  });

  it('documents install, quickstart, command reference, workflow examples, and troubleshooting', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

    for (const heading of ['Install', 'Quickstart', 'What Terrace Creates', 'Release Readiness', 'Command Reference', 'Workflow Example', 'Troubleshooting']) {
      expect(readme).toContain('## ' + heading);
    }
    expect(readme).toContain('terrace report` is read-only');
    expect(readme).toContain('pnpm audit --audit-level moderate');
    expect(readme).toContain('pnpm run release:dry-run');
  });

  it('prints top-level CLI help and version without requiring a Terrace state file', () => {
    const help = execFileSync('node', [cliPath, '--help'], { cwd: repoRoot, encoding: 'utf8' });
    const version = execFileSync('node', [cliPath, '--version'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(help).toContain('Usage: terrace <command>');
    expect(help).toContain('terrace init');
    expect(help).toContain('terrace agents install-global');
    expect(version).toBe(pkg.version);
  });

  it('keeps legacy integration artifacts out of the publish allowlist', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(pkg.files).not.toContain('.agents');
    expect(pkg.files).not.toContain('.claude');
    expect(pkg.files).not.toContain('.planning');
    expect(pkg.files).not.toContain('.tracker');
    expect(pkg.files).not.toContain('tests');
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
      const terraceRoute = JSON.parse(terraceExec(terraceBin, ['do', 'what next', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const terraceNext = JSON.parse(terraceExec(terraceBin, ['next', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const doctor = JSON.parse(terraceExec(terraceBin, ['doctor', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const audit = JSON.parse(terraceExec(terraceBin, ['audit', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const report = JSON.parse(terraceExec(terraceBin, ['report', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const reportPath = path.join(consumerDir, '.terrace', 'report-card.json');
      const reportMtime = fs.statSync(reportPath).mtimeMs;
      const ship = spawnSync(terraceBin, ['ship', 'check', '--json'], { cwd: consumerDir, encoding: 'utf8', shell: windowsShell });

      expect(help).toContain('Usage: terrace <command>');
      expect(version).toBe(JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version);
      expect(globalInstall).toMatchObject({
        enabled: true,
        global_agents_dir: globalAgentsDir,
        global_claude_dir: globalClaudeDir,
        next_command: '/terrace'
      });
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
      expect(globalInstall.assets.filter((asset: { path: string }) => asset.path.startsWith('skills/terrace-'))).toHaveLength(
        globalInstall.claude_assets.filter((asset: { path: string }) => asset.path.startsWith('commands/terrace-')).length
      );
      expect(globalInstall.assets.filter((asset: { path: string }) => asset.path.startsWith('skills/terrace-')).length).toBeGreaterThan(50);
      const codexTerraceEntrypoint = fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace', 'SKILL.md'), 'utf8');
      const codexTerraceNext = fs.readFileSync(path.join(globalAgentsDir, 'skills', 'terrace-next', 'SKILL.md'), 'utf8');
      const claudeTerraceEntrypoint = fs.readFileSync(path.join(globalClaudeDir, 'commands', 'terrace.md'), 'utf8');
      expect(codexTerraceEntrypoint).toContain('name: terrace');
      expect(codexTerraceEntrypoint).toContain('terrace do "$ARGUMENTS"');
      expect(codexTerraceEntrypoint).toContain('terrace next');
      expect(codexTerraceNext).toContain('Run `terrace next`.');
      expect(claudeTerraceEntrypoint).toContain('description: Route Terrace workflow intent through the local Terrace CLI.');
      expect(claudeTerraceEntrypoint).toContain('terrace do "$ARGUMENTS"');
      expect(fs.existsSync(path.join(globalAgentsDir, 'terrace', 'manifest.json'))).toBe(true);
      expect(fs.existsSync(path.join(globalClaudeDir, 'terrace', 'manifest.json'))).toBe(true);
      expect(init.created).toContain('.terrace/state.json');
      expect(terraceRoute.command).toBe('terrace next');
      expect(terraceRoute.result.command).toBe(terraceNext.command);
      expect(doctor.healthy).toBe(true);
      expect(audit.healthy).toBe(true);
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
