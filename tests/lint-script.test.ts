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
    for (const fileName of ['sample.cjs', 'sample.ts', 'sample.json', 'sample.md']) {
      fs.writeFileSync(path.join(tmpDir, 'src', fileName), 'first line\r\nsecond line\r\n', 'utf-8');
    }

    const result = spawnSync(NODE_BIN, [LINT_SCRIPT], {
      env: {
        ...process.env,
        TERRACE_LINT_ROOT: tmpDir,
        TERRACE_LINT_DIRS: 'src'
      },
      encoding: 'utf-8'
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CRLF line endings');
    expect(result.stderr).toContain('src/sample.cjs');
    expect(result.stderr).toContain('src/sample.ts');
    expect(result.stderr).toContain('src/sample.json');
    expect(result.stderr).toContain('src/sample.md');
  });
});
