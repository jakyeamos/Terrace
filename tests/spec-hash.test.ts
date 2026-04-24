// Phase 2 RED stubs — covers OPS-03, OPS-04
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const TERRACE_CLI = path.resolve(process.cwd(), 'src/terrace-tools.cjs');
const NODE_BIN = process.execPath;

describe('spec hash computation (OPS-03, OPS-04)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-spec-hash-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('computeSpecHash is callable from src/lib/spec-hash.cjs', () => {
    const { computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: unknown };
    expect(typeof computeSpecHash).toBe('function');
  });

  it('computeSpecHash strips blank lines before hashing (OPS-03, D-18)', () => {
    let computeSpecHash: ((content: string) => string) | undefined;
    try {
      ({ computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: typeof computeSpecHash });
    } catch {
      expect(false, 'spec-hash.cjs does not exist yet — computeSpecHash cannot be called (OPS-03)').toBe(true);
      return;
    }
    const withBlanks = 'line one\n\nline two\n\n\nline three';
    const withoutBlanks = 'line one\nline two\nline three';
    expect(computeSpecHash!(withBlanks)).toBe(computeSpecHash!(withoutBlanks));
  });

  it('computeSpecHash strips trailing whitespace per line (OPS-03, D-18)', () => {
    let computeSpecHash: ((content: string) => string) | undefined;
    try {
      ({ computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: typeof computeSpecHash });
    } catch {
      expect(false, 'spec-hash.cjs does not exist yet — computeSpecHash cannot be called (OPS-03)').toBe(true);
      return;
    }
    const withTrailing = 'line one   \nline two  \nline three\t';
    const withoutTrailing = 'line one\nline two\nline three';
    expect(computeSpecHash!(withTrailing)).toBe(computeSpecHash!(withoutTrailing));
  });

  it('computeSpecHash strips comment-only lines matching /^\\s*<!--.*-->\\s*$/ (OPS-03, D-18)', () => {
    let computeSpecHash: ((content: string) => string) | undefined;
    try {
      ({ computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: typeof computeSpecHash });
    } catch {
      expect(false, 'spec-hash.cjs does not exist yet — computeSpecHash cannot be called (OPS-03)').toBe(true);
      return;
    }
    const withComments = 'line one\n<!-- this is a comment -->\nline two\n  <!-- another comment -->  \nline three';
    const withoutComments = 'line one\nline two\nline three';
    expect(computeSpecHash!(withComments)).toBe(computeSpecHash!(withoutComments));
  });

  it('computeSpecHash excludes the last_updated YAML frontmatter field (OPS-03, D-18)', () => {
    let computeSpecHash: ((content: string) => string) | undefined;
    try {
      ({ computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: typeof computeSpecHash });
    } catch {
      expect(false, 'spec-hash.cjs does not exist yet — computeSpecHash cannot be called (OPS-03)').toBe(true);
      return;
    }
    const withDate1 = '---\nspec_version: 1.0\nlast_updated: 2026-01-01\nproject: foo\n---\n# Content\nSame body.';
    const withDate2 = '---\nspec_version: 1.0\nlast_updated: 2026-12-31\nproject: foo\n---\n# Content\nSame body.';
    expect(computeSpecHash!(withDate1)).toBe(computeSpecHash!(withDate2));
  });

  it('two inputs differing only in whitespace produce the same hash (OPS-03)', () => {
    let computeSpecHash: ((content: string) => string) | undefined;
    try {
      ({ computeSpecHash } = require('../src/lib/spec-hash.cjs') as { computeSpecHash: typeof computeSpecHash });
    } catch {
      expect(false, 'spec-hash.cjs does not exist yet — computeSpecHash cannot be called (OPS-03)').toBe(true);
      return;
    }
    const input1 = '# Title\n\nSection content here.\n\nAnother section.\n';
    const input2 = '# Title\nSection content here.\nAnother section.';
    expect(computeSpecHash!(input1)).toBe(computeSpecHash!(input2));
  });

  it('terrace spec hash --file <path> CLI command is recognized (OPS-04, D-19)', () => {
    // Write a test spec file
    const specFile = path.join(tmpDir, 'COMPILED-SPEC.md');
    fs.writeFileSync(specFile, '---\nspec_version: 1.0\nlast_updated: 2026-01-01\n---\n# Spec\nContent.', 'utf-8');

    // The command should be recognized — it will fail because terrace-tools.cjs doesn't implement spec hash yet
    let cliRecognized = false;
    let output = '';
    try {
      output = execFileSync(NODE_BIN, [TERRACE_CLI, 'spec', 'hash', '--file', specFile], {
        encoding: 'utf-8',
        cwd: tmpDir,
      });
      // If it succeeds, it was recognized
      cliRecognized = true;
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; message?: string };
      const combined = `${execErr.stdout ?? ''} ${execErr.stderr ?? ''} ${execErr.message ?? ''}`;
      // If output contains 'unknown command' or 'unrecognized', it is NOT recognized
      const isUnknown = /unknown command|unrecognized|not found|Usage:/i.test(combined);
      cliRecognized = !isUnknown;
    }
    expect(cliRecognized, 'terrace spec hash --file must be a recognized CLI command (OPS-04)').toBe(true);
  });

  it('terrace spec hash --file <path> prints a 64-character hash', () => {
    const specFile = path.join(tmpDir, 'COMPILED-SPEC.md');
    fs.writeFileSync(specFile, '---\nspec_version: 1.0\nlast_updated: 2026-01-01\n---\n# Spec\nContent.', 'utf-8');

    const output = execFileSync(NODE_BIN, [TERRACE_CLI, 'spec', 'hash', '--file', specFile], {
      encoding: 'utf-8',
      cwd: tmpDir,
    }).trim();

    expect(output).toMatch(/^[a-f0-9]{64}$/);
  });
});
