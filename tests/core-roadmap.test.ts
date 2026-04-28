import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, loadState, saveState, classifyRoadmapItem, executeRoadmapItem } = require('../packages/terrace-core/src/index.cjs');

describe('low-effort roadmap execution', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-roadmap-'));
    initCore(tmpDir, { projectName: 'demo' });
    const state = loadState(tmpDir);
    state.workflow.status = 'roadmap_ready';
    state.roadmap.phases = [
      {
        id: 'docs-typo',
        goal: 'Fix typo in README',
        success_criteria: ['README spelling corrected'],
        risk_tags: ['low'],
        dependencies: []
      },
      {
        id: 'auth-session',
        goal: 'Change auth session behavior',
        success_criteria: ['sessions expire correctly'],
        risk_tags: ['security', 'protected_behavior'],
        dependencies: []
      }
    ];
    saveState(tmpDir, state);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('classifies bounded low-risk roadmap items as low effort', () => {
    const state = loadState(tmpDir);
    const result = classifyRoadmapItem(state.roadmap.phases[0]);
    expect(result.effort).toBe('low');
  });

  it('classifies security-sensitive items as strict', () => {
    const state = loadState(tmpDir);
    const result = classifyRoadmapItem(state.roadmap.phases[1]);
    expect(result.effort).toBe('strict');
  });

  it('executes a low-risk roadmap item without a full plan document', () => {
    const result = executeRoadmapItem(tmpDir, 'docs-typo');
    expect(result.effort).toBe('low');
    const state = loadState(tmpDir);
    expect(state.workflow.status).toBe('red_required');
    expect(state.active_slice.id).toBe('docs-typo');
    expect(state.active_slice.skipped_gates).toContain('full_plan_document');
  });

  it('refuses direct execution for security-sensitive roadmap items', () => {
    const result = executeRoadmapItem(tmpDir, 'auth-session');
    expect(result.allowed).toBe(false);
    expect(result.required_command).toBe('terrace plan next');
  });
});
