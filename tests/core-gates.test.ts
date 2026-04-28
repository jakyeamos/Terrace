import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, saveState, loadState, verifyRedEvidence, verifyGreenEvidence } = require('../packages/terrace-core/src/index.cjs');

describe('RED and GREEN gates', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-gates-'));
    initCore(tmpDir, { projectName: 'demo' });
    const state = loadState(tmpDir);
    state.workflow.status = 'red_required';
    state.active_slice = {
      id: 'auth-login-01',
      spec_refs: ['AUTH-REQ-01'],
      test_intent: [{ protects: 'Invalid credentials never create a session', failure_mode: 'session created for invalid password' }]
    };
    saveState(tmpDir, state);
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'auth.test.ts'), 'test("invalid login", () => {})\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts RED evidence mapped to active slice, spec, contract, and failing command', () => {
    const result = verifyRedEvidence(tmpDir, {
      slice_id: 'auth-login-01',
      test_file: 'tests/auth.test.ts',
      command: 'npm test -- auth',
      exit_code: 1,
      spec_ref: 'AUTH-REQ-01',
      protects: 'Invalid credentials never create a session',
      failure_mode: 'session created for invalid password'
    });
    expect(result.passed).toBe(true);
    expect(loadState(tmpDir).workflow.status).toBe('implementation_allowed');
  });

  it('rejects RED evidence when the test file is missing', () => {
    const result = verifyRedEvidence(tmpDir, {
      slice_id: 'auth-login-01',
      test_file: 'tests/missing.test.ts',
      command: 'npm test -- auth',
      exit_code: 1,
      spec_ref: 'AUTH-REQ-01',
      protects: 'Invalid credentials never create a session',
      failure_mode: 'session created for invalid password'
    });
    expect(result.passed).toBe(false);
    expect(result.blocking[0].code).toBe('MISSING_TEST_FILE');
  });

  it('accepts GREEN evidence only when configured command exits 0', () => {
    const state = loadState(tmpDir);
    state.workflow.status = 'green_required';
    saveState(tmpDir, state);
    const result = verifyGreenEvidence(tmpDir, { command: 'npm test', exit_code: 0, summary: 'all tests passed' });
    expect(result.passed).toBe(true);
    expect(loadState(tmpDir).workflow.status).toBe('protected');
  });
});
