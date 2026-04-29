import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
  createDefaultState,
  saveState,
  loadState,
  reportRead,
  reportUpdate,
  reportOpen,
  documentationShipCheck,
  testEvalShipCheck,
  aiReviewShipCheck,
  preflightShipCheck,
  ruleAuditShipCheck,
  debtShipCheck,
  addDebt,
  auditDebt,
  preflightFeature,
  docuFeature,
  testEval,
  reviewAi,
  ruleAudit,
  ruleAdd,
  backfill,
  workstreamsPlan,
  designSourceImport,
  designSourceDiff
} = require('../packages/terrace-core/src/index.cjs');

describe('production lifecycle edge coverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-lifecycle-coverage-'));
    saveState(tmpDir, createDefaultState({ projectName: 'lifecycle-coverage' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('computes report status without writing files and writes history only through update', () => {
    const read = reportRead(tmpDir);

    expect(read.artifact).toBe(null);
    expect(read.report_card.status_label).toBe('strong_with_gaps');
    expect(reportOpen(tmpDir)).toMatchObject({ exists: false, command: 'terrace report update' });
    expect(fs.existsSync(path.join(tmpDir, '.terrace', 'report-card.json'))).toBe(false);

    const updated = reportUpdate(tmpDir, { command: 'test command' });

    expect(updated.report_card.last_updated_command).toBe('test command');
    expect(updated.history_ref).toMatch(/^docs\/terrace\/report-history\/.+\.md$/);
    expect(reportOpen(tmpDir)).toMatchObject({ exists: true, artifact: 'docs/terrace/REPORT-CARD.md' });
  });

  it('does not penalize feature-scoped report checks when there is no active feature', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: {
        test: 'vitest run',
        'test:coverage': 'vitest run --coverage'
      }
    }), 'utf8');

    const read = reportRead(tmpDir);

    expect(read.report_card.score).toBeGreaterThanOrEqual(85);
    expect(read.report_card.status_label).toBe('tier_one_ready');
    expect(read.report_card.checks).toContainEqual(expect.objectContaining({
      id: 'production_preflight',
      passed: true,
      evidence: expect.objectContaining({ skipped: true })
    }));
    expect(read.report_card.checks).toContainEqual(expect.objectContaining({
      id: 'documentation',
      passed: true,
      evidence: expect.objectContaining({ skipped: true })
    }));
  });

  it('classifies active feature ship checks by tier and recorded evidence', () => {
    const state = loadState(tmpDir);
    saveState(tmpDir, {
      ...state,
      senior_cycle: {
        active_feature: 'billing-refresh',
        features: {
          'billing-refresh': { feature_id: 'billing-refresh', tier: 'small', artifacts: {} }
        }
      }
    });

    expect(documentationShipCheck(tmpDir)).toMatchObject({ passed: true, warnings: [expect.objectContaining({ code: 'DOCUMENTATION_REQUIRED' })] });
    expect(preflightShipCheck(tmpDir)).toMatchObject({ passed: true, warnings: [expect.objectContaining({ code: 'PREFLIGHT_REQUIRED' })] });
    expect(aiReviewShipCheck(tmpDir)).toMatchObject({ passed: true, warnings: [expect.objectContaining({ code: 'AI_REVIEW_REQUIRED' })] });

    const mediumState = loadState(tmpDir);
    saveState(tmpDir, {
      ...mediumState,
      senior_cycle: {
        active_feature: 'billing-refresh',
        features: {
          'billing-refresh': { feature_id: 'billing-refresh', tier: 'medium', artifacts: {} }
        }
      }
    });

    expect(documentationShipCheck(tmpDir)).toMatchObject({ passed: false, blocking: [expect.objectContaining({ code: 'DOCUMENTATION_REQUIRED' })] });
    expect(preflightShipCheck(tmpDir)).toMatchObject({ passed: false, blocking: [expect.objectContaining({ code: 'PREFLIGHT_REQUIRED' })] });

    docuFeature(tmpDir, 'billing-refresh', { type: 'unknown-doc-kind' });
    preflightFeature(tmpDir, 'billing-refresh', { mode: 'incident' });
    reviewAi(tmpDir, { mode: 'architecture', feature: 'billing-refresh' });

    expect(documentationShipCheck(tmpDir)).toMatchObject({ passed: true, documentation: expect.objectContaining({ artifact: 'docs/terrace/features/billing-refresh/DOCS.md' }) });
    expect(preflightShipCheck(tmpDir)).toMatchObject({ passed: true, preflight: expect.objectContaining({ mode: 'incident' }) });
    expect(aiReviewShipCheck(tmpDir)).toMatchObject({ passed: true, ai_review: expect.objectContaining({ mode: 'architecture' }) });
  });

  it('evaluates tests, rules, debt, backfill, workstreams, and design sources as consumable artifacts', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }), 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'tests', 'unit'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'sample.test.js'), 'test("one", () => {});\n', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'tests', 'unit', 'sample.test.js'), 'test("two", () => {});\n', 'utf8');
    for (let index = 0; index < 6; index += 1) {
      fs.writeFileSync(path.join(tmpDir, 'src', 'view-' + String(index) + '.snap'), 'snapshot\n', 'utf8');
    }

    const evaluation = testEval(tmpDir, { feature: 'billing-refresh', changed: true });

    expect(evaluation.blockers).toEqual([]);
    expect(evaluation.recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'SNAPSHOT_REVIEW' }),
      expect.objectContaining({ code: 'DUPLICATE_TEST_NAMES' })
    ]));
    expect(testEvalShipCheck(tmpDir)).toMatchObject({ passed: true, test_evaluation: expect.objectContaining({ feature_id: 'billing-refresh' }) });

    const debt = addDebt(tmpDir, {
      feature: 'billing-refresh',
      owner: 'release-owner',
      expiry: 'after rollout',
      allowedToShip: true
    });
    expect(auditDebt(tmpDir)).toMatchObject({ passed: true, open_count: 1 });
    expect(debtShipCheck(tmpDir)).toMatchObject({ passed: true, audit: expect.objectContaining({ open_count: 1 }) });
    expect(debt.artifact).toBe('docs/terrace/features/billing-refresh/DEBT.md');

    const rule = ruleAdd(tmpDir, 'typescript', 'no-any-production');
    const rulePath = path.join(tmpDir, rule.artifact);
    const ruleJson = JSON.parse(fs.readFileSync(rulePath, 'utf8'));
    fs.writeFileSync(rulePath, JSON.stringify({ ...ruleJson, owner: 'platform', rationale: 'Production type safety.', review_after: '2026-12-31' }, null, 2), 'utf8');
    fs.writeFileSync(path.join(tmpDir, '.terrace', 'rules', 'broken.json'), '{ invalid', 'utf8');

    const rules = ruleAudit(tmpDir);

    expect(rules.rule_count).toBe(2);
    expect(rules.blockers).toContainEqual(expect.objectContaining({ code: 'RULE_OWNER_REQUIRED' }));
    expect(ruleAuditShipCheck(tmpDir)).toMatchObject({ passed: false, blocking: [expect.objectContaining({ code: 'RULE_OWNER_REQUIRED' })] });

    expect(backfill(tmpDir, { rule: 'no-any-production', feature: 'billing-refresh' })).toMatchObject({ mutates_code: false });
    expect(workstreamsPlan(tmpDir, 'billing-refresh').lanes).toEqual(expect.arrayContaining([expect.objectContaining({ lane: 'data/migrations', parallel: false })]));
    expect(designSourceImport(tmpDir, 'screenshot', 'billing-refresh', '/tmp/screen.png').source).toBe('screenshot');
    expect(designSourceImport(tmpDir, 'unknown-source', 'settings-refresh', null).source).toBe('stitch');
    expect(designSourceDiff(tmpDir, 'existing-ui', 'billing-refresh', '/billing').artifact).toBe('docs/terrace/features/billing-refresh/UI-DIFF.md');
  });
});
