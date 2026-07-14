import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { evaluateDebt } = require('../packages/terrace-core/src/debt-assessment.cjs');
const { createDefaultState, saveState } = require('../packages/terrace-core/src/state.cjs');
const { debtShipCheck, reportRead } = require('../packages/terrace-core/src/lifecycle.cjs');
const { workbenchStatus } = require('../packages/terrace-core/src/workbench.cjs');

describe('debt assessment', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrace-debt-assessment-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('evaluates unresolved owner, expiry, and ship-permission policy', () => {
    const entries = [
      { id: 'debt-1', feature_id: 'billing', status: 'open', owner: null, expiry_condition: null, cleanup_trigger: null, allowed_to_ship: false },
      { id: 'debt-2', feature_id: 'billing', status: 'open', owner: 'release-owner', expiry_condition: 'after rollout', cleanup_trigger: null, allowed_to_ship: true },
      { id: 'debt-3', feature_id: 'billing', status: 'resolved', owner: null, expiry_condition: null, cleanup_trigger: null, allowed_to_ship: false }
    ];

    expect(evaluateDebt(entries)).toEqual({
      open_count: 2,
      entries: [entries[0], entries[1]],
      blockers: [
        {
          code: 'DEBT_OWNER_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no owner: debt-1',
          remediation: 'Resolve the debt or add an owner.'
        },
        {
          code: 'DEBT_EXPIRY_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no expiry condition or cleanup trigger: debt-1',
          remediation: 'Add an expiry condition or cleanup trigger.'
        }
      ],
      warnings: [
        {
          code: 'DEBT_NOT_ALLOWED_TO_SHIP',
          id: 'debt-1',
          message: 'Debt is open and not marked as allowed to ship: debt-1'
        }
      ],
      passed: false
    });
  });

  it('scopes assessment to one feature without changing lifecycle or workbench contracts', () => {
    const scopedEntry = { id: 'debt-1', feature_id: 'billing', status: 'open', owner: null, expiry_condition: null, cleanup_trigger: null, allowed_to_ship: false };
    const otherEntry = { id: 'debt-2', feature_id: 'search', status: 'open', owner: 'release-owner', expiry_condition: 'after rollout', cleanup_trigger: null, allowed_to_ship: true };
    const state = createDefaultState({ projectName: 'debt-assessment' });
    saveState(tmpDir, { ...state, debt: [scopedEntry, otherEntry] });

    expect(evaluateDebt([scopedEntry, otherEntry], { featureId: 'billing' })).toEqual({
      open_count: 1,
      entries: [scopedEntry],
      blockers: [
        {
          code: 'DEBT_OWNER_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no owner: debt-1',
          remediation: 'Resolve the debt or add an owner.'
        },
        {
          code: 'DEBT_EXPIRY_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no expiry condition or cleanup trigger: debt-1',
          remediation: 'Add an expiry condition or cleanup trigger.'
        }
      ],
      warnings: [
        { code: 'DEBT_NOT_ALLOWED_TO_SHIP', id: 'debt-1', message: 'Debt is open and not marked as allowed to ship: debt-1' }
      ],
      passed: false
    });
    const lifecycle = debtShipCheck(tmpDir);
    expect(lifecycle).toEqual({
      category: 'debt',
      command: 'terrace debt audit',
      passed: false,
      blocking: [
        {
          code: 'DEBT_OWNER_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no owner: debt-1',
          remediation: 'Resolve the debt or add an owner.'
        },
        {
          code: 'DEBT_EXPIRY_REQUIRED',
          id: 'debt-1',
          message: 'Debt entry has no expiry condition or cleanup trigger: debt-1',
          remediation: 'Add an expiry condition or cleanup trigger.'
        }
      ],
      warnings: [
        { code: 'DEBT_NOT_ALLOWED_TO_SHIP', id: 'debt-1', message: 'Debt is open and not marked as allowed to ship: debt-1' }
      ],
      audit: {
        open_count: 2,
        blockers: [
          {
            code: 'DEBT_OWNER_REQUIRED',
            id: 'debt-1',
            message: 'Debt entry has no owner: debt-1',
            remediation: 'Resolve the debt or add an owner.'
          },
          {
            code: 'DEBT_EXPIRY_REQUIRED',
            id: 'debt-1',
            message: 'Debt entry has no expiry condition or cleanup trigger: debt-1',
            remediation: 'Add an expiry condition or cleanup trigger.'
          }
        ],
        warnings: [
          { code: 'DEBT_NOT_ALLOWED_TO_SHIP', id: 'debt-1', message: 'Debt is open and not marked as allowed to ship: debt-1' }
        ],
        passed: false
      }
    });
    const report = reportRead(tmpDir).report_card;
    expect(report.debt_status).toBe('blocked');
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'debt_health',
      passed: false,
      evidence: {
        open_debt_count: 2,
        blockers: lifecycle.audit.blockers
      }
    }));
    expect(workbenchStatus(tmpDir, { feature: 'billing' }).debt).toEqual({
      open_count: 1,
      entries: [scopedEntry],
      blockers: [
        { code: 'DEBT_OWNER_REQUIRED', id: 'debt-1', message: 'Debt entry has no owner: debt-1' },
        { code: 'DEBT_EXPIRY_REQUIRED', id: 'debt-1', message: 'Debt entry has no expiry condition or cleanup trigger: debt-1' }
      ],
      warnings: [
        { code: 'DEBT_NOT_ALLOWED_TO_SHIP', id: 'debt-1', message: 'Debt is open and not marked as allowed to ship: debt-1' }
      ],
      passed: false
    });
  });
});
