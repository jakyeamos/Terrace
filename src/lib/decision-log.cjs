'use strict';

const fs = require('fs');
const path = require('path');

function decisionLogPathFor(cwd) {
  return path.resolve(cwd, 'docs', 'spec', 'DECISION-LOG.md');
}

function addDecision(cwd, options) {
  const opts = options || {};
  const specRef = opts.specRef || opts.spec_ref;
  if (!specRef) {
    throw new Error('decision log requires --spec-ref');
  }

  const filePath = decisionLogPathFor(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const id = opts.id || 'D-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const entry = [
    '',
    '---',
    'decision_id: ' + id,
    'date: ' + new Date().toISOString().slice(0, 10),
    'author: ' + (opts.author || 'terrace'),
    'spec_ref: ' + specRef,
    'change_type: ' + (opts.changeType || opts.change_type || 'update'),
    'rationale: ' + (opts.rationale || 'Recorded governance decision.'),
    'impact: ' + (opts.impact || 'protected baseline alignment'),
    'status: ' + (opts.status || 'active'),
    '---',
    ''
  ].join('\n');

  fs.appendFileSync(filePath, entry, 'utf8');
  return { file: filePath, decision_id: id, spec_ref: specRef };
}

module.exports = {
  addDecision
};
