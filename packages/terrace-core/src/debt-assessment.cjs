'use strict';

function openDebtEntries(entries, featureId) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    return entry.status !== 'resolved' && (featureId === undefined || entry.feature_id === featureId);
  });
}

function evaluateDebt(entries, options) {
  const opts = options || {};
  const open = openDebtEntries(entries, opts.featureId);
  const blockers = [];
  const warnings = [];
  for (const entry of open) {
    if (!entry.owner) {
      blockers.push({
        code: 'DEBT_OWNER_REQUIRED',
        id: entry.id,
        message: 'Debt entry has no owner: ' + entry.id,
        remediation: 'Resolve the debt or add an owner.'
      });
    }
    if (!entry.expiry_condition && !entry.cleanup_trigger) {
      blockers.push({
        code: 'DEBT_EXPIRY_REQUIRED',
        id: entry.id,
        message: 'Debt entry has no expiry condition or cleanup trigger: ' + entry.id,
        remediation: 'Add an expiry condition or cleanup trigger.'
      });
    }
    if (!entry.allowed_to_ship) {
      warnings.push({
        code: 'DEBT_NOT_ALLOWED_TO_SHIP',
        id: entry.id,
        message: 'Debt is open and not marked as allowed to ship: ' + entry.id
      });
    }
  }
  return {
    open_count: open.length,
    entries: open,
    blockers,
    warnings,
    passed: blockers.length === 0
  };
}

function auditDebtState(entries) {
  const assessment = evaluateDebt(entries);
  return {
    open_count: assessment.open_count,
    blockers: assessment.blockers,
    warnings: assessment.warnings,
    passed: assessment.passed
  };
}

module.exports = {
  openDebtEntries,
  evaluateDebt,
  auditDebtState
};
