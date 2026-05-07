import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';

const repoRoot = path.resolve(__dirname, '..');
const cliPath = path.join(repoRoot, 'src', 'terrace-tools.cjs');
const windowsShell = process.platform === 'win32';

function npmExec(args: string[], options: { cwd: string; encoding: BufferEncoding; timeout?: number }) {
  return execFileSync('npm', args, { ...options, shell: windowsShell });
}

function terraceExec(terraceBin: string, args: string[], options: { cwd: string; encoding: BufferEncoding }) {
  return execFileSync(terraceBin, args, { ...options, shell: windowsShell });
}

describe('tier-one product readiness', () => {
  it('exposes npm metadata for a publishable CLI package', () => {
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
    expect(pkg.repository.type).toBe('git');
    expect(pkg.exports['.']).toBe('./packages/terrace-core/src/index.cjs');
  });

  it('documents install, quickstart, command reference, workflow examples, and troubleshooting', () => {
    const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');

    for (const heading of ['Install', 'Quickstart', 'What Terrace Creates', 'Release Readiness', 'Command Reference', 'Workflow Example', 'Troubleshooting']) {
      expect(readme).toContain('## ' + heading);
    }
    expect(readme).toContain('terrace report` is read-only');
    expect(readme).toContain('npm audit --audit-level=moderate');
  });

  it('prints top-level CLI help and version without requiring a Terrace state file', () => {
    const help = execFileSync('node', [cliPath, '--help'], { cwd: repoRoot, encoding: 'utf8' });
    const version = execFileSync('node', [cliPath, '--version'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(help).toContain('Usage: terrace <command>');
    expect(help).toContain('terrace init');
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

  it('records explicit truth-file verification metadata', () => {
    const truth = fs.readFileSync(path.join(repoRoot, '.tracker', 'PROJECT_TRUTH.md'), 'utf8');

    expect(truth).toMatch(/^lastVerifiedCommand: .+$/m);
    expect(truth).toMatch(/^lastVerifiedAt: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-04:00"$/m);
  });

  it('runs the packed CLI from a fresh consumer project', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-packed-consumer-'));
    const packDir = path.join(tmpRoot, 'pack');
    const consumerDir = path.join(tmpRoot, 'consumer');
    fs.mkdirSync(packDir, { recursive: true });
    fs.mkdirSync(consumerDir, { recursive: true });

    try {
      const packOutput = npmExec(['pack', '--pack-destination', packDir, '--cache', path.join(tmpRoot, 'npm-cache')], {
        cwd: repoRoot,
        encoding: 'utf8'
      }).trim();
      const tarballPath = path.join(packDir, packOutput.split(/\r?\n/).pop() || '');

      fs.writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({ name: 'terrace-consumer', private: true }), 'utf8');
      npmExec(['install', '--ignore-scripts', '--prefer-offline', '--cache', path.join(tmpRoot, 'npm-cache'), tarballPath], {
        cwd: consumerDir,
        encoding: 'utf8',
        timeout: 60000
      });

      const terraceBin = path.join(consumerDir, 'node_modules', '.bin', 'terrace');
      const help = terraceExec(terraceBin, ['--help'], { cwd: consumerDir, encoding: 'utf8' });
      const version = terraceExec(terraceBin, ['--version'], { cwd: consumerDir, encoding: 'utf8' }).trim();
      const init = JSON.parse(terraceExec(terraceBin, ['init', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const doctor = JSON.parse(terraceExec(terraceBin, ['doctor', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const audit = JSON.parse(terraceExec(terraceBin, ['audit', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const report = JSON.parse(terraceExec(terraceBin, ['report', '--json'], { cwd: consumerDir, encoding: 'utf8' }));
      const reportPath = path.join(consumerDir, '.terrace', 'report-card.json');
      const reportMtime = fs.statSync(reportPath).mtimeMs;
      const ship = spawnSync(terraceBin, ['ship', 'check', '--json'], { cwd: consumerDir, encoding: 'utf8', shell: windowsShell });

      expect(help).toContain('Usage: terrace <command>');
      expect(version).toBe(JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version);
      expect(init.created).toContain('.terrace/state.json');
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
