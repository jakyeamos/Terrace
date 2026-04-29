import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const NODE_BIN = process.execPath;
const LINT_SCRIPT = path.resolve(process.cwd(), 'scripts/lint.cjs');

describe('lint script line-ending guardrails', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const tmpDir of tmpDirs.splice(0)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails explicitly when audited text files use CRLF line endings', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-lint-crlf-'));
    tmpDirs.push(tmpDir);
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.cjs'), 'module.exports = 1;\r\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.ts'), 'export const value = 1;\r\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.json'), '{"value":1}\r\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample.md'), '# Sample\r\n', 'utf-8');

    const result = spawnSync(NODE_BIN, [LINT_SCRIPT], {
      env: {
        ...process.env,
        TERRACE_LINT_ROOT: tmpDir,
        TERRACE_LINT_DIRS: 'src'
      },
      encoding: 'utf-8'
    });

    expect(result.status).toBe(1);
    const stderr = result.stderr.replace(/\\/g, '/');
    expect(stderr).toContain('CRLF line endings');
    expect(stderr).toContain('src/sample.cjs');
    expect(stderr).toContain('src/sample.ts');
    expect(stderr).toContain('src/sample.json');
    expect(stderr).toContain('src/sample.md');
  });
});
