'use strict';

const fs = require('fs');
const path = require('path');

function eventsPathFor(cwd) {
  return path.resolve(cwd, '.terrace', 'events.jsonl');
}

function appendEvent(cwd, event) {
  const filePath = eventsPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = {
    ...event,
    event_id: event.event_id || 'evt_' + Date.now() + '_' + Math.random().toString(16).slice(2),
    timestamp: event.timestamp || new Date().toISOString(),
    command: event.command,
    from_state: event.from_state,
    to_state: event.to_state,
    result: event.result || 'ok',
    evidence_refs: event.evidence_refs || []
  };
  fs.appendFileSync(filePath, JSON.stringify(payload) + '\n', 'utf8');
  return payload;
}

function readEvents(cwd) {
  const filePath = eventsPathFor(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = {
  appendEvent,
  readEvents
};
