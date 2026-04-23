// Phase 2 RED stubs — covers FRAG-02, FRAG-03, FRAG-04
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('fragment loader runtime behavior (FRAG-02, FRAG-03, FRAG-04)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-frag-loader-test-'));
    // Set up a minimal fragment directory structure in tmpDir
    const fragDir = path.join(tmpDir, 'fragments');
    fs.mkdirSync(fragDir, { recursive: true });

    // Two core fragments (~100 chars each)
    fs.writeFileSync(
      path.join(fragDir, 'core-01.md'),
      '# Core Fragment 1\n\nThis is the first core fragment for the agent. It contains essential context.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(fragDir, 'core-02.md'),
      '# Core Fragment 2\n\nThis is the second core fragment for the agent. It contains essential rules.\n',
      'utf-8'
    );
    // Four extended fragments (~100 chars each)
    fs.writeFileSync(
      path.join(fragDir, 'extended-01.md'),
      '# Extended Fragment 1\n\nThis is the first extended fragment loaded on-demand based on phase.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(fragDir, 'extended-02.md'),
      '# Extended Fragment 2\n\nThis is the second extended fragment loaded on-demand based on config.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(fragDir, 'extended-03.md'),
      '# Extended Fragment 3\n\nThis is the third extended fragment loaded on-demand based on stack.\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(fragDir, 'extended-04.md'),
      '# Extended Fragment 4\n\nThis is the fourth extended fragment loaded on-demand for specialized needs.\n',
      'utf-8'
    );

    const fragmentIndex = {
      agent: 'test-agent',
      fragments: [
        { id: 'FRG-01', name: 'Core Fragment 1', tags: ['core'], tier: 'core', file: 'core-01.md' },
        { id: 'FRG-02', name: 'Core Fragment 2', tags: ['core'], tier: 'core', file: 'core-02.md' },
        { id: 'FRG-03', name: 'Extended Fragment 1', tags: ['extended'], tier: 'extended', file: 'extended-01.md' },
        { id: 'FRG-04', name: 'Extended Fragment 2', tags: ['extended'], tier: 'extended', file: 'extended-02.md' },
        { id: 'FRG-05', name: 'Extended Fragment 3', tags: ['extended'], tier: 'extended', file: 'extended-03.md' },
        { id: 'FRG-06', name: 'Extended Fragment 4', tags: ['extended'], tier: 'extended', file: 'extended-04.md' },
      ],
    };
    fs.writeFileSync(
      path.join(fragDir, 'fragment-index.json'),
      JSON.stringify(fragmentIndex, null, 2),
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadFragments is callable from src/lib/fragment-loader.cjs (RED — module does not exist yet)', () => {
    let threwExpectedError = false;
    try {
      require('../src/lib/fragment-loader.cjs');
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'MODULE_NOT_FOUND') {
        threwExpectedError = true;
      }
    }
    expect(threwExpectedError).toBe(true);
  });

  it('loadFragments(agentDir, {tier: core}) returns only core-tier fragment contents (FRAG-02)', () => {
    // RED: module does not exist; this test documents the expected behavior
    let loadFragments: ((agentDir: string, opts: { tier: string }) => { contents: string[]; tokenCount: number }) | undefined;
    try {
      ({ loadFragments } = require('../src/lib/fragment-loader.cjs') as { loadFragments: typeof loadFragments });
    } catch {
      // Module not found — test is RED
      expect(false, 'fragment-loader.cjs does not exist yet — loadFragments cannot be called (FRAG-02)').toBe(true);
      return;
    }
    const result = loadFragments!(tmpDir, { tier: 'core' });
    expect(result.contents).toHaveLength(2);
    for (const content of result.contents) {
      expect(content).toContain('Core Fragment');
    }
  });

  it('loadFragments(agentDir, {tier: all}) returns all tier fragments (FRAG-02)', () => {
    let loadFragments: ((agentDir: string, opts: { tier: string }) => { contents: string[]; tokenCount: number }) | undefined;
    try {
      ({ loadFragments } = require('../src/lib/fragment-loader.cjs') as { loadFragments: typeof loadFragments });
    } catch {
      expect(false, 'fragment-loader.cjs does not exist yet — loadFragments cannot be called (FRAG-02)').toBe(true);
      return;
    }
    const result = loadFragments!(tmpDir, { tier: 'all' });
    expect(result.contents).toHaveLength(6);
  });

  it('core-only load has at least 40% fewer tokens than loading all fragments (FRAG-04, MET-ERG-07)', () => {
    let loadFragments: ((agentDir: string, opts: { tier: string }) => { contents: string[]; tokenCount: number }) | undefined;
    try {
      ({ loadFragments } = require('../src/lib/fragment-loader.cjs') as { loadFragments: typeof loadFragments });
    } catch {
      expect(false, 'fragment-loader.cjs does not exist yet — ratio check cannot be performed (FRAG-04)').toBe(true);
      return;
    }
    const coreResult = loadFragments!(tmpDir, { tier: 'core' });
    const allResult = loadFragments!(tmpDir, { tier: 'all' });
    expect(allResult.tokenCount).toBeGreaterThan(0);
    const savedRatio = 1 - coreResult.tokenCount / allResult.tokenCount;
    expect(
      savedRatio,
      `Context reduction ratio ${savedRatio.toFixed(2)} is less than required 0.40 (40%) (FRAG-04)`
    ).toBeGreaterThanOrEqual(0.40);
  });
});
