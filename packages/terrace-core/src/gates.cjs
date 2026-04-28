'use strict';

const fs = require('fs');
const path = require('path');
const { loadState, saveState } = require('./state.cjs');
const { appendEvent } = require('./events.cjs');

function verifyRedEvidence(cwd, evidence) {
  const state = loadState(cwd);
  const blocking = [];

  if (state.workflow.status !== 'red_required') {
    blocking.push({ code: 'INVALID_STATE', message: 'RED evidence requires red_required state' });
  }
  if (!state.active_slice || evidence.slice_id !== state.active_slice.id) {
    blocking.push({ code: 'SLICE_MISMATCH', message: 'RED evidence must match active slice' });
  }
  if (!fs.existsSync(path.resolve(cwd, evidence.test_file || ''))) {
    blocking.push({ code: 'MISSING_TEST_FILE', message: 'RED test file does not exist' });
  }
  if (!evidence.spec_ref || !state.active_slice || !state.active_slice.spec_refs.includes(evidence.spec_ref)) {
    blocking.push({ code: 'SPEC_REF_MISMATCH', message: 'RED evidence must reference active spec_ref' });
  }
  if (evidence.exit_code === 0) {
    blocking.push({ code: 'RED_DID_NOT_FAIL', message: 'RED command must fail before implementation' });
  }
  if (!evidence.protects || !evidence.failure_mode) {
    blocking.push({ code: 'WEAK_TESTING_TRUST_EVIDENCE', message: 'RED evidence must name protected behavior and failure mode' });
  }

  if (blocking.length > 0) {
    return { passed: false, blocking };
  }

  state.red_gate = { status: 'passed', evidence: [evidence] };
  state.workflow.status = 'implementation_allowed';
  saveState(cwd, state);
  appendEvent(cwd, {
    command: 'terrace red verify',
    from_state: 'red_required',
    to_state: 'implementation_allowed',
    evidence_refs: [evidence.test_file]
  });
  return { passed: true, blocking: [] };
}

function verifyGreenEvidence(cwd, evidence) {
  const state = loadState(cwd);
  const blocking = [];

  if (state.workflow.status !== 'green_required') {
    blocking.push({ code: 'INVALID_STATE', message: 'GREEN evidence requires green_required state' });
  }
  if (evidence.exit_code !== 0) {
    blocking.push({ code: 'GREEN_COMMAND_FAILED', message: 'GREEN command must pass' });
  }

  if (blocking.length > 0) {
    return { passed: false, blocking };
  }

  state.green_gate = { status: 'passed', evidence: [evidence] };
  state.workflow.status = 'protected';
  saveState(cwd, state);
  appendEvent(cwd, {
    command: 'terrace green verify',
    from_state: 'green_required',
    to_state: 'protected',
    evidence_refs: []
  });
  return { passed: true, blocking: [] };
}

module.exports = {
  verifyRedEvidence,
  verifyGreenEvidence
};
