'use strict';

function intent(id, commandTemplate, effect, writes, execution, options) {
  const opts = options || {};
  return Object.freeze({
    id,
    command_template: commandTemplate,
    effect,
    writes: Object.freeze(writes || []),
    execution: Object.freeze(execution || []),
    lock: opts.lock || 'managed'
  });
}

const INTENT_CATALOG = Object.freeze([
  intent('adoption_status', 'terrace adoption status', 'read'),
  intent('workbench_status', 'terrace workbench status{feature_option}', 'read'),
  intent('workbench_prepare', 'terrace workbench prepare {feature_id}{target_option}', 'write', [
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
  intent('phase_complete_workflow', 'terrace execute-phase-complete {phase_id}', 'write', [
    '.terrace/state.json',
    '.terrace/report-card.json',
    'docs/terrace/phases/{phase_id}/**',
    'docs/terrace/REPORT-CARD.md',
    'docs/terrace/report-history/**'
  ]),
  intent('phase_plan', 'terrace phase plan {phase_id}', 'write', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/PLAN.md'
  ]),
  intent('phase_execute', 'terrace phase execute {phase_id}', 'write', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/EXECUTION.md'
  ]),
  intent('phase_validate', 'terrace phase validate {phase_id}', 'write', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/VALIDATION.md'
  ]),
  intent('phase_review', 'terrace phase review {phase_id}', 'write', [
    '.terrace/state.json',
    'docs/terrace/phases/{phase_id}/REVIEW.md'
  ]),
  intent('phase_complete', 'terrace phase complete {phase_id}', 'write', [
    '.terrace/state.json',
    '.terrace/report-card.json',
    'docs/terrace/phases/{phase_id}/SUMMARY.md',
    'docs/terrace/REPORT-CARD.md',
    'docs/terrace/report-history/**'
  ]),
  intent('quick_plan', 'terrace quick plan {title}', 'write', [
    '.terrace/state.json',
    'docs/terrace/quick/<new-task-id>/PLAN.md'
  ]),
  intent('quick_list', 'terrace quick list', 'read'),
  intent('ship_prepare', 'terrace ship prepare', 'write', [
    'docs/terrace/ship/SHIP.md'
  ], [
    'Runs the full ship check, including discovered project quality and dead-code scripts after a clean Git snapshot. Those project scripts are outside Terrace’s artifact boundary and may write arbitrary project files.'
  ], { lock: 'self_managed' }),
  intent('ship_check', 'terrace ship check', 'read'),
  intent('autonomous', 'terrace autonomous', 'write', [
    '.terrace/state.json',
    'docs/terrace/phases/<selected-phase>/**'
  ]),
  intent('next', 'terrace next', 'read'),
  intent('resume', 'terrace resume', 'read'),
  intent('history', 'terrace history', 'read')
]);

const INTENT_BY_ID = new Map(INTENT_CATALOG.map((entry) => [entry.id, entry]));

function intentDefinition(id) {
  const entry = INTENT_BY_ID.get(id);
  if (!entry) {
    throw new Error('Unknown natural-language Terrace intent: ' + id);
  }
  return entry;
}

function renderCommandTemplate(template, parameters) {
  const values = parameters || {};
  return template.replace(/\{([a-z_]+)\}/g, (placeholder, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error('Missing route parameter ' + key + ' for command template: ' + template);
    }
    return String(values[key]);
  });
}

function renderValue(value, parameters) {
  if (typeof value === 'string') {
    return renderCommandTemplate(value, parameters);
  }
  if (Array.isArray(value)) {
    return value.map((item) => renderValue(item, parameters));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderValue(item, parameters)]));
  }
  return value;
}

function resolveIntentCommand(id, parameters) {
  const entry = intentDefinition(id);
  return {
    id: entry.id,
    effect: entry.effect,
    command: renderCommandTemplate(entry.command_template, parameters),
    writes: renderValue(entry.writes, parameters),
    execution: renderValue(entry.execution, parameters),
    lock: entry.lock
  };
}

function listIntentCommands() {
  return INTENT_CATALOG.map((entry) => ({
    id: entry.id,
    command_template: entry.command_template,
    effect: entry.effect,
    writes: [...entry.writes],
    execution: [...entry.execution],
    lock: entry.lock
  }));
}

module.exports = {
  listIntentCommands,
  resolveIntentCommand
};
