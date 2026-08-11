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

type GlobalCommandSurface = {
  name: string;
  help?: string;
};

type AgentAsset = {
  path: string;
  type: string;
  status: string;
};

const globalCommandSurface: GlobalCommandSurface[] = [
  { name: 'terrace-help' },
  { name: 'terrace-version' },
  { name: 'terrace-init', help: 'terrace init' },
  { name: 'terrace-agents-install-global', help: 'terrace agents install-global' },
  { name: 'terrace-new-project', help: 'terrace new-project <name> --prd <file>|--paste-prd' },
  { name: 'terrace-prd-import', help: 'terrace prd import <feature> --file <file>|--paste' },
  { name: 'terrace-doctor', help: 'terrace doctor' },
  { name: 'terrace-spec-validate', help: 'terrace spec validate' },
  { name: 'terrace-spec-hash', help: 'terrace spec hash --file <path>' },
  { name: 'terrace-audit', help: 'terrace audit' },
  { name: 'terrace-ci-check', help: 'terrace ci check [files...]' },
  { name: 'terrace-security-check', help: 'terrace security check' },
  { name: 'terrace-corpus-run', help: 'terrace corpus run' },
  { name: 'terrace-corpus-report', help: 'terrace corpus report' },
  { name: 'terrace-adoption-status', help: 'terrace adoption status' },
  { name: 'terrace-port-gsd-dry-run', help: 'terrace port gsd [--dry-run|--compare|--verify-parity|--import-roadmap]' },
  { name: 'terrace-port-gsd-import-roadmap', help: 'terrace port gsd [--dry-run|--compare|--verify-parity|--import-roadmap]' },
  { name: 'terrace-port-gsd', help: 'terrace port gsd [--dry-run|--compare|--verify-parity|--import-roadmap]' },
  { name: 'terrace-planning-refresh', help: 'terrace planning refresh' },
  { name: 'terrace-next', help: 'terrace next' },
  { name: 'terrace-resume', help: 'terrace resume' },
  { name: 'terrace-history', help: 'terrace history' },
  { name: 'terrace-do', help: 'terrace do <intent>' },
  { name: 'terrace-autonomous', help: 'terrace autonomous' },
  { name: 'terrace-execute-phase-complete', help: 'terrace execute-phase-complete <id>' },
  { name: 'terrace-settings-show', help: 'terrace settings show' },
  { name: 'terrace-settings-effort', help: 'terrace settings effort <fast|standard|thorough>' },
  { name: 'terrace-commands-discover', help: 'terrace commands discover' },
  { name: 'terrace-align', help: 'terrace align <feature>' },
  { name: 'terrace-interrogate', help: 'terrace interrogate <feature>' },
  { name: 'terrace-map-codebase', help: 'terrace map-codebase' },
  { name: 'terrace-design', help: 'terrace design <feature>' },
  { name: 'terrace-test-plan', help: 'terrace test-plan <feature>' },
  { name: 'terrace-observe', help: 'terrace observe <feature>' },
  { name: 'terrace-validate-prod', help: 'terrace validate-prod <feature>' },
  { name: 'terrace-cleanup', help: 'terrace cleanup <feature>' },
  { name: 'terrace-ui-import-stitch', help: 'terrace ui import-stitch <feature>' },
  { name: 'terrace-ui-plan-refresh', help: 'terrace ui plan-refresh <feature>' },
  { name: 'terrace-ui-diff', help: 'terrace ui diff <feature>' },
  { name: 'terrace-phase-list', help: 'terrace phase list' },
  { name: 'terrace-phase-show', help: 'terrace phase show <id>' },
  { name: 'terrace-phase-plan', help: 'terrace phase plan <id>' },
  { name: 'terrace-phase-execute', help: 'terrace phase execute <id>' },
  { name: 'terrace-phase-validate', help: 'terrace phase validate <id>' },
  { name: 'terrace-phase-review', help: 'terrace phase review <id>' },
  { name: 'terrace-phase-complete', help: 'terrace phase complete <id>' },
  { name: 'terrace-quick-list', help: 'terrace quick list' },
  { name: 'terrace-quick-show', help: 'terrace quick show <id>' },
  { name: 'terrace-quick-plan', help: 'terrace quick plan <title>' },
  { name: 'terrace-quick-execute', help: 'terrace quick execute <id>' },
  { name: 'terrace-quick-complete', help: 'terrace quick complete <id>' },
  { name: 'terrace-backlog-list', help: 'terrace backlog list' },
  { name: 'terrace-backlog-add', help: 'terrace backlog add <title>' },
  { name: 'terrace-ship-check', help: 'terrace ship check' },
  { name: 'terrace-ship-prepare', help: 'terrace ship prepare' },
  { name: 'terrace-release-preflight', help: 'terrace release-preflight' },
  { name: 'terrace-report', help: 'terrace report [update|open|history|ceremony]' },
  { name: 'terrace-handoff-create', help: 'terrace handoff create [--feature <id>] [--for codex|claude|generic]' },
  { name: 'terrace-debt', help: 'terrace debt add|list|audit|resolve' },
  { name: 'terrace-preflight', help: 'terrace preflight <feature>' },
  { name: 'terrace-docu', help: 'terrace docu <feature>' },
  { name: 'terrace-test-eval', help: 'terrace test eval' },
  { name: 'terrace-review-ai', help: 'terrace review ai --mode <mode>' },
  { name: 'terrace-rule-add', help: 'terrace rule add <domain> <rule-id>' },
  { name: 'terrace-rule-audit', help: 'terrace rule audit' },
  { name: 'terrace-waive', help: 'terrace waive <gate>' },
  { name: 'terrace-backfill', help: 'terrace backfill' },
  { name: 'terrace-workstreams-plan', help: 'terrace workstreams plan <feature>' },
  { name: 'terrace-workbench-status', help: 'terrace workbench status [--feature <id>]' },
  { name: 'terrace-workbench-prepare', help: 'terrace workbench prepare <feature> [--tier small|medium|large] [--for codex|claude|generic]' },
  { name: 'terrace-design-source-import', help: 'terrace design-source import <source> <feature> <ref>' },
  { name: 'terrace-plan-phase', help: 'terrace plan-phase <id>' },
  { name: 'terrace-execute-phase', help: 'terrace execute-phase <id>' },
  { name: 'terrace-validate-phase', help: 'terrace validate-phase <id>' },
  { name: 'terrace-review-phase', help: 'terrace review-phase <id>' },
  { name: 'terrace-complete-phase', help: 'terrace complete-phase <id>' },
  { name: 'terrace-rule-list', help: 'terrace rule list' },
  { name: 'terrace-rule-explain', help: 'terrace rule explain <id>' },
  { name: 'terrace-preset-list', help: 'terrace preset list' },
  { name: 'terrace-preset-install', help: 'terrace preset install <id>' }
];

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
    expect(releaseDocs).toContain('trusted_publishing');
    expect(releaseDocs).toContain('@jakyeamos33/terrace@0.2.0');
    expect(releaseDocs).not.toContain('pnpm whoami');
    expect(releaseDocs).not.toContain('run `pnpm publish');
    expect(readme).toContain('npm trusted publishing with OIDC');
  });

  it('records explicit Compass contract metadata', () => {
    const compassPath = path.join(repoRoot, '.project-compass', 'contract.json');
    const compass = JSON.parse(fs.readFileSync(compassPath, 'utf8'));

    expect(compass.schema_version).toBe(1);
    expect(compass.project.name).toBe('Terrace');
    expect(compass.source_layers.verified.length).toBeGreaterThan(0);
    expect(compass.drift.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(repoRoot, '.tracker', 'PROJECT_TRUTH.md'))).toBe(false);
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
      expect(claudeTerraceEntrypoint).toContain('terrace do "$ARGUMENTS"');
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
