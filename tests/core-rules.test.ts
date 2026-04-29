import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { initCore, loadRules, explainRule, checkRules } = require('../packages/terrace-core/src/index.cjs');

describe('first-class rule domains', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-core-rules-'));
    initCore(tmpDir, { projectName: 'demo' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads security, architecture, pentest, maintainability, and testing-trust domains', () => {
    const rules = loadRules(tmpDir);
    expect(Object.keys(rules).sort()).toEqual(['architecture', 'maintainability', 'pentest', 'security', 'testing-trust']);
    expect(rules.architecture.length).toBeGreaterThan(0);
    expect(rules.maintainability.length).toBeGreaterThan(0);
    expect(rules.pentest.length).toBeGreaterThan(0);
  });

  it('explains the testing-trust rule by id', () => {
    const explanation = explainRule(tmpDir, 'testing-trust');
    expect(explanation.title).toBe('Do Not Treat Test Volume as Trust');
  });

  it('reports unknown rules deterministically', () => {
    expect(() => explainRule(tmpDir, 'missing-rule')).toThrow(/Unknown rule: missing-rule/);
  });

  it('blocks security-critical findings in low-effort mode', () => {
    const result = checkRules(tmpDir, {
      mode: 'low_effort',
      findings: [{ domain: 'security', severity: 'critical', rule_id: 'SEC-CRITICAL', message: 'secret exposed' }]
    });
    expect(result.blocking).toHaveLength(1);
    expect(result.blocking[0].domain).toBe('security');
  });

  it('blocks pentest findings without authorized scope and allows scoped findings as warnings', () => {
    const blocked = checkRules(tmpDir, {
      findings: [{ domain: 'pentest', severity: 'medium', message: 'probe auth boundary' }]
    });
    const allowed = checkRules(tmpDir, {
      findings: [{ domain: 'pentest', severity: 'medium', authorized_scope: 'local fixture only' }]
    });

    expect(blocked.passed).toBe(false);
    expect(blocked.blocking[0].code).toBe('PENTEST_WITHOUT_AUTHORIZED_SCOPE');
    expect(allowed.passed).toBe(true);
    expect(allowed.warnings).toHaveLength(1);
  });
});
