import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, newProjectFromPrd, importFeaturePrd } = require('../packages/terrace-core/src/index.cjs');

describe('PRD intake core commands', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-prd-intake-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates project intake artifacts and updates initialized state', () => {
    const result = newProjectFromPrd(tmpDir, {
      name: 'Hoopscout',
      prdText: '# Hoopscout PRD\n\n## Users\n- Coaches upload notes.\n\n## Success\n- Shortlists take under 10 minutes.\n',
      source: { mode: 'paste', path: null }
    });

    expect(result).toMatchObject({
      project_id: 'hoopscout',
      initialized: true,
      next_command: 'terrace interrogate hoopscout'
    });
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf-8')).toContain('Coaches upload notes.');
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf-8'));
    expect(state.workflow.status).toBe('intake_recorded');
    expect(state.project.prd_intake.project_id).toBe('hoopscout');
  });

  it('preserves an advanced workflow state when project intake reruns with force', () => {
    newProjectFromPrd(tmpDir, {
      name: 'First',
      prdText: '# First\n\n- Users can start.\n',
      source: { mode: 'paste', path: null }
    });
    const statePath = path.join(tmpDir, '.terrace', 'state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    state.workflow.status = 'roadmap_ready';
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');

    newProjectFromPrd(tmpDir, {
      name: 'First',
      prdText: '# First\n\n- Users can start again.\n',
      source: { mode: 'paste', path: null },
      force: true
    });

    const nextState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(nextState.workflow.status).toBe('roadmap_ready');
  });

  it('refuses empty PRD input before writing project artifacts', () => {
    expect(() => newProjectFromPrd(tmpDir, {
      name: 'Empty',
      prdText: '   ',
      source: { mode: 'paste', path: null }
    })).toThrow('PRD input is empty.');
    expect(fs.existsSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'))).toBe(false);
  });

  it('imports feature PRDs and records feature state', () => {
    initCore(tmpDir, { projectName: 'Feature Repo' });

    const result = importFeaturePrd(tmpDir, {
      feature: 'Saved Search',
      prdText: [
        '# Saved Search',
        '',
        '## Users',
        '- Users can save prospect filters.',
        '',
        '## Success Metrics',
        '- Success: scouts reuse filters weekly.',
        '',
        '## Risks',
        '- Risk: saved filters may expose private notes.'
      ].join('\n'),
      source: { mode: 'file', path: 'feature-prd.md' }
    });

    expect(result.next_command).toBe('terrace design saved-search');
    expect(fs.readFileSync(path.join(tmpDir, 'docs', 'terrace', 'features', 'saved-search', 'PRD-IMPORT.md'), 'utf-8')).toContain('terrace design saved-search');
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'state.json'), 'utf-8'));
    expect(state.senior_cycle.features['saved-search'].artifacts.test_plan).toBe('docs/terrace/features/saved-search/TEST-PLAN.md');
  });

  it('refuses to overwrite feature PRD artifacts without force', () => {
    initCore(tmpDir, { projectName: 'Feature Repo' });
    importFeaturePrd(tmpDir, {
      feature: 'Saved Search',
      prdText: '# Saved Search\n\n- Users can save filters.\n',
      source: { mode: 'paste', path: null }
    });

    expect(() => importFeaturePrd(tmpDir, {
      feature: 'Saved Search',
      prdText: '# Saved Search\n\n- Users can save filters again.\n',
      source: { mode: 'paste', path: null }
    })).toThrow('Refusing to overwrite docs/terrace/features/saved-search/PRD.md');
  });
});
