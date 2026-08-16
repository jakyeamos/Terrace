'use strict';

const {
  commandById,
  formatCommandDisplay,
  renderCommandArgv
} = require('./command-catalog.cjs');

function intent(id, commandId, writes, execution, options) {
  const opts = options || {};
  return Object.freeze({
    id,
    command_id: commandId,
    writes: Object.freeze(writes || []),
    execution: Object.freeze(execution || []),
    lock: opts.lock || 'managed'
  });
}

const INTENT_CATALOG = Object.freeze([
  intent('adoption_status', 'adoption.status'),
  intent('workbench_status', 'workbench.status'),
  intent('workbench_prepare', 'workbench.prepare', [
    '.terrace/state.json',
    '.terrace/report-card.json',
    '.terrace/workstreams/{feature_id}.json',
    '.terrace/handoffs/**',
    'docs/terrace/features/{feature_id}/PREFLIGHT.md',
    'docs/terrace/features/{feature_id}/RUNBOOK.md',
    'docs/terrace/features/{feature_id}/WORKSTREAMS.md',
    'docs/terrace/reviews/{feature_id}/release.json',
    'docs/terrace/reviews/{feature_id}/release.md',
    'docs/terrace/handoffs/**',
    'docs/terrace/REPORT-CARD.md',
    'docs/terrace/report-history/**'
  ], [
    'Runs feature activation, production preflight, runbook generation, AI release review, and workstream planning; creates a handoff when a target is requested.'
  ]),
  intent('phase_complete_workflow', 'phase.execute-complete', [
    '.terrace/state.json',
    '.terrace/report-card.json',
    'docs/terrace/phases/{phase_id}/**',
    'docs/terrace/REPORT-CARD.md',
    'docs/terrace/report-history/**'
  ]),
  intent('phase_plan', 'phase.plan', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/PLAN.md'
  ]),
  intent('phase_execute', 'phase.execute', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/EXECUTION.md'
  ]),
  intent('phase_validate', 'phase.validate', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/VALIDATION.md'
  ]),
  intent('phase_review', 'phase.review', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/REVIEW.md'
  ]),
  intent('phase_complete', 'phase.complete', [
    '.terrace/state.json',
    '.terrace/report-card.json',
    'docs/terrace/phases/{phase_id}/SUMMARY.md',
    'docs/terrace/REPORT-CARD.md',
    'docs/terrace/report-history/**'
  ]),
  intent('quick_plan', 'quick.plan', [
    '.terrace/state.json',
    'docs/terrace/quick/<new-task-id>/PLAN.md'
  ]),
  intent('quick_list', 'quick.list'),
  intent('ship_prepare', 'ship.prepare', [
    'docs/terrace/ship/SHIP.md'
  ], [
    'Runs the full ship check, including discovered project quality and dead-code scripts after a clean Git snapshot. Those project scripts are outside Terrace’s artifact boundary and may write arbitrary project files.'
  ], { lock: 'self_managed' }),
  intent('ship_check', 'ship.check'),
  intent('autonomous', 'autonomous', [
    '.terrace/state.json',
    'docs/terrace/phases/<selected-phase>/**'
  ]),
  intent('next', 'next'),
  intent('resume', 'resume'),
  intent('history', 'history')
]);

const INTENT_BY_ID = new Map(INTENT_CATALOG.map((entry) => [entry.id, entry]));

function intentDefinition(id) {
  const entry = INTENT_BY_ID.get(id);
  if (!entry) {
    throw new Error('Unknown natural-language Terrace intent: ' + id);
  }
  return entry;
}

function renderValue(value, parameters) {
  if (typeof value === 'string') {
    return value.replace(/\{([a-z_]+)\}/g, (placeholder, key) => {
      if (!Object.prototype.hasOwnProperty.call(parameters, key)) {
        throw new Error('Missing route parameter ' + key + ' for natural-language intent.');
      }
      return String(parameters[key]);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, parameters));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderValue(item, parameters)]));
  }
  return value;
}

function commandDefinition(commandId) {
  const entry = commandById(commandId);
  if (!entry) {
    throw new Error('Natural-language intent references unknown command catalog id: ' + commandId);
  }
  return entry;
}

function resolveIntentCommand(id, parameters) {
  const entry = intentDefinition(id);
  const values = { ...(parameters || {}) };
  const command = commandDefinition(entry.command_id);
  const argv = renderCommandArgv(entry.command_id, values);
  return {
    id: entry.id,
    command_id: entry.command_id,
    argv,
    command: formatCommandDisplay(argv),
    effect: command.effect,
    writes: renderValue(entry.writes, values),
    execution: renderValue(entry.execution, values),
    lock: entry.lock
  };
}

function listIntentCommands() {
  return INTENT_CATALOG.map((entry) => {
    const command = commandDefinition(entry.command_id);
    return {
      id: entry.id,
      command_id: entry.command_id,
      effect: command.effect,
      writes: [...entry.writes],
      execution: [...entry.execution],
      lock: entry.lock
    };
  });
}

module.exports = {
  listIntentCommands,
  resolveIntentCommand
};
