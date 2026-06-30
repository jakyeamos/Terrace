import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { portGsd } = require('../packages/terrace-core/src/index.cjs');

const AMOS_PLANNING = '/Users/jakyeamos/projects/amos-saas/.planning';
const hasAmosPlanning = fs.existsSync(path.join(AMOS_PLANNING, 'HANDOFF.json'));

describe('amos-saas GSD migration smoke', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  (hasAmosPlanning ? it : it.skip)('migrates a temp copy of amos-saas planning without mutating the source project', () => {
    const sourceHandoff = path.join(AMOS_PLANNING, 'HANDOFF.json');
    const beforeHandoff = fs.readFileSync(sourceHandoff, 'utf8');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-amos-saas-smoke-'));
    tempDirs.push(tmpDir);
    fs.cpSync(AMOS_PLANNING, path.join(tmpDir, '.planning'), { recursive: true });

    const result = portGsd(tmpDir, { force: false });
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf8'));

    expect(result.next_command).toMatch(/^terrace phase show phase-11-/);
    expect(result.blockers).toContainEqual(expect.objectContaining({
      code: 'GSD_HANDOFF_BLOCKED_ACTION',
      message: expect.stringContaining('034_prime_notes.sql')
    }));
    expect(state.blocked_actions).toContainEqual(expect.objectContaining({
      description: expect.stringContaining('034_prime_notes.sql'),
      source_ref: '.planning/HANDOFF.json'
    }));
    expect(state.roadmap.phases.some((phase: { title: string; plans?: unknown[] }) => phase.title.includes('Phase 10') && Array.isArray(phase.plans))).toBe(true);
    expect(result.skipped.every((item: { artifact: string; reason: string; suggested_action?: string }) => item.artifact && item.reason && item.suggested_action)).toBe(true);
    expect(fs.readFileSync(sourceHandoff, 'utf8')).toBe(beforeHandoff);
  });
});
