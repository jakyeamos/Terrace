'use strict';

const path = require('path');
const { appendManagedJsonLine, readManagedJsonLines } = require('./managed-artifacts.cjs');

function eventsPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'events.jsonl');
}

function appendEvent(cwd, event) {
  const payload = {
    event_id: event.event_id || 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    timestamp: event.timestamp || new Date().toISOString(),
    command: event.command,
    from_state: event.from_state,
    to_state: event.to_state,
    result: event.result || 'ok',
    evidence_refs: event.evidence_refs || []
  };
  appendManagedJsonLine(cwd, 'events.jsonl', payload);
  return payload;
}

function readEvents(cwd) {
  return readManagedJsonLines(cwd, 'events.jsonl');
}

module.exports = {
  appendEvent,
  readEvents
};
