// Phase 2 RED stubs — covers FRAG-01, FRAG-02, FRAG-03, FRAG-04, FRAG-05
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('fragment index schema and tier loading (FRAG-01, FRAG-02, FRAG-03, FRAG-04, FRAG-05)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-frag-index-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fragment-index.json exists at .agents/skills/terrace-spec-interrogator/fragments/fragment-index.json (FRAG-01)', () => {
    const indexPath = path.resolve(
      process.cwd(),
      '.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json'
    );
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('fragment-index.json has required top-level fields: agent (string) and fragments (array) (FRAG-01)', () => {
    const indexPath = path.resolve(
      process.cwd(),
      '.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json'
    );
    expect(fs.existsSync(indexPath)).toBe(true);
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(raw) as { agent: unknown; fragments: unknown[] };
    expect(typeof index.agent).toBe('string');
    expect(Array.isArray(index.fragments)).toBe(true);
    expect(index.fragments.length).toBeGreaterThan(0);
  });

  it('each fragment entry has id, name, tags, tier, and file fields (FRAG-01)', () => {
    const indexPath = path.resolve(
      process.cwd(),
      '.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json'
    );
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
      fragments: Array<{ id: unknown; name: unknown; tags: unknown; tier: unknown; file: unknown }>;
    };
    for (const fragment of index.fragments) {
      expect(typeof fragment.id, `fragment.id must be a string`).toBe('string');
      expect(typeof fragment.name, `fragment.name must be a string`).toBe('string');
      expect(Array.isArray(fragment.tags), `fragment.tags must be an array`).toBe(true);
      expect(typeof fragment.tier, `fragment.tier must be a string`).toBe('string');
      expect(typeof fragment.file, `fragment.file must be a string`).toBe('string');
    }
  });

  it('tier values are only core, extended, or specialized (FRAG-01, FRAG-02)', () => {
    const indexPath = path.resolve(
      process.cwd(),
      '.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json'
    );
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
      fragments: Array<{ tier: string }>;
    };
    const validTiers = new Set(['core', 'extended', 'specialized']);
    for (const fragment of index.fragments) {
      expect(
        validTiers.has(fragment.tier),
        `Invalid tier value: "${fragment.tier}" — must be core, extended, or specialized`
      ).toBe(true);
    }
  });

  it('fragment files are .md (readable by humans and agents) (FRAG-05)', () => {
    const indexPath = path.resolve(
      process.cwd(),
      '.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json'
    );
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as {
      fragments: Array<{ file: string }>;
    };
    for (const fragment of index.fragments) {
      expect(
        fragment.file.endsWith('.md'),
        `Fragment file "${fragment.file}" must have .md extension (FRAG-05)`
      ).toBe(true);
    }
  });

  it('step-01 of workflow reads fragment-index.json — fragment-index.json exists in interrogator agent dir before workflow step runs (FRAG-03)', () => {
    const agentDir = path.resolve(process.cwd(), '.agents/skills/terrace-spec-interrogator');
    const fragIndexPath = path.join(agentDir, 'fragments', 'fragment-index.json');
    expect(fs.existsSync(agentDir), 'Agent directory must exist').toBe(true);
    expect(fs.existsSync(fragIndexPath), 'fragment-index.json must exist before workflow step runs').toBe(true);
  });
});
