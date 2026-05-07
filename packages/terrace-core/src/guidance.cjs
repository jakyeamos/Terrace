'use strict';

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

module.exports = {
  blocker,
  guidanceError,
  topBlockers,
  warning
};
