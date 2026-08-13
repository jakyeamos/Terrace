'use strict';

const STOP_PACKET_SCHEMA = 'terrace-stop-packet/v1';
const DEFAULT_FORBIDDEN_BYPASS = 'Do not mark the stage passed, skip later stages, or edit Terrace state or event history by hand.';

function blocker(input) {
  const item = { ...input };
  if (!item.code) {
    item.code = 'BLOCKED';
  }
  if (!item.message) {
    item.message = 'Terrace gate is blocked.';
  }
  if (!item.why_blocked) {
    item.why_blocked = 'Terrace needs this evidence before the workflow can safely continue.';
  }
  if (!item.remediation) {
    item.remediation = item.next_command ? 'Run `' + item.next_command + '` and recheck.' : 'Resolve the blocker and recheck.';
  }
  return item;
}

function warning(input) {
  return blocker(input);
}

function guidanceError(message, details) {
  const error = new Error(message);
  error.details = details || null;
  if (details) {
    error.next_command = details.next_command || null;
    error.remediation = details.remediation || null;
    error.file = details.file || null;
    error.why_blocked = details.why_blocked || null;
  }
  return error;
}

function topBlockers(blockers, limit) {
  return (blockers || []).slice(0, limit || 3).map((item) => ({
    code: item.code,
    message: item.message,
    file: item.file || item.artifact || null,
    next_command: item.next_command || null,
    remediation: item.remediation || null
  }));
}

function evidenceRefs(item) {
  return Array.from(new Set([
    item.file,
    item.artifact,
    item.source_ref,
    item.evidence_ref,
    ...(Array.isArray(item.evidence_refs) ? item.evidence_refs : [])
  ].filter(Boolean)));
}

function createStopPacket(blockers, options) {
  const opts = options || {};
  const normalized = (blockers || []).map((item) => {
    const normalizedBlocker = blocker({
      ...item,
      code: item.code || 'BLOCKED_ACTION',
      message: item.message || item.description,
      owner: item.owner || opts.owner || 'workflow_operator',
      next_command: item.next_command || null
    });
    return {
      code: normalizedBlocker.code,
      message: normalizedBlocker.message,
      evidence_refs: evidenceRefs(normalizedBlocker),
      owner: normalizedBlocker.owner,
      safe_next_step: normalizedBlocker.remediation || opts.requiredAction || ('Resolve the blocker, then rerun `' + opts.command + '`.'),
      next_command: normalizedBlocker.next_command,
      forbidden_bypass: normalizedBlocker.forbidden_bypass || DEFAULT_FORBIDDEN_BYPASS
    };
  });
  const owners = Array.from(new Set(normalized.map((item) => item.owner)));
  return {
    schema_version: STOP_PACKET_SCHEMA,
    status: 'blocked',
    phase_id: opts.phaseId || null,
    stage_id: opts.stageId || null,
    command: opts.command || null,
    evidence_refs: Array.from(new Set(normalized.flatMap((item) => item.evidence_refs))),
    owner: owners.length === 1 ? owners[0] : 'workflow_operator',
    safe_next_step: opts.requiredAction || (normalized[0] && normalized[0].safe_next_step) || 'Resolve the blocker and rerun the blocked command.',
    forbidden_bypass: DEFAULT_FORBIDDEN_BYPASS,
    blockers: normalized
  };
}

module.exports = {
  STOP_PACKET_SCHEMA,
  DEFAULT_FORBIDDEN_BYPASS,
  blocker,
  createStopPacket,
  guidanceError,
  topBlockers,
  warning
};
