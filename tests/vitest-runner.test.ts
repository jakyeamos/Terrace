import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '..');
const testRunner = path.join(repoRoot, 'scripts', 'vitest-run.cjs');
const windowsShell = process.platform === 'win32';

describe('Vitest script runner', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const tmpDir of tmpDirs.splice(0)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('strips pnpm script separators so focused test invocations do not run the whole suite', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-focused-test-'));
    tmpDirs.push(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'terrace-focused-test-fixture',
        private: true,
        scripts: {
          test: 'node ' + JSON.stringify(testRunner)
        }
      }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'vitest.config.mjs'),
      "export default { test: { include: ['tests/**/*.test.js'], globals: true } };\n",
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'tests', 'focused.test.js'),
      "describe('focused file', () => { it('runs when requested', () => { expect(true).toBe(true); }); });\n",
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'tests', 'full-suite-only.test.js'),
      "describe('full-suite-only file', () => { it('fails if the whole suite runs', () => { expect('unfiltered').toBe('filtered'); }); });\n",
      'utf8'
    );

    const result = spawnSync('pnpm', ['test', '--', 'tests/focused.test.js'], {
      cwd: tmpDir,
      encoding: 'utf8',
      shell: windowsShell,
      timeout: 30000
    });
    const output = result.stdout + result.stderr;

    expect(result.status).toBe(0);
    expect(output).toContain('tests/focused.test.js');
    expect(output).not.toContain('full-suite-only');
  });
});
