'use strict';

const { loadState, saveState } = require('./state.cjs');
const { appendEvent } = require('./events.cjs');

function classifyRoadmapItem(item) {
  const tags = item.risk_tags || [];
  const missingShape = !item.goal || !Array.isArray(item.success_criteria) || item.success_criteria.length === 0;
  if (missingShape) {
    return { effort: 'strict', reasons: ['missing_goal_or_success_criteria'] };
  }
  if (tags.includes('security') || tags.includes('architecture') || tags.includes('protected_behavior')) {
    return { effort: 'strict', reasons: tags };
  }
  if (tags.includes('low')) {
    return { effort: 'low', reasons: ['bounded_low_risk'] };
  }
  return { effort: 'standard', reasons: ['default_standard'] };
}

function executeRoadmapItem(cwd, itemId) {
  const state = loadState(cwd);
  const item = state.roadmap.phases.find((phase) => phase.id === itemId);
  if (!item) {
    throw new Error('Unknown roadmap item: ' + itemId);
  }

  const classification = classifyRoadmapItem(item);
  if (classification.effort !== 'low') {
    return {
      allowed: false,
      effort: classification.effort,
      reasons: classification.reasons,
      required_command: 'terrace plan next'
    };
  }

  const nextState = {
    ...state,
    workflow: {
      ...state.workflow,
      status: 'red_required',
      mode: 'low_effort'
    },
    active_slice: {
      id: item.id,
      goal: item.goal,
      spec_refs: item.spec_refs || [],
      success_criteria: item.success_criteria,
      test_intent: [],
      skipped_gates: ['full_plan_document']
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, {
    command: 'terrace roadmap execute ' + itemId,
    from_state: state.workflow.status,
    to_state: 'red_required',
    evidence_refs: ['.terrace/state.json']
  });

  return {
    allowed: true,
    effort: 'low',
    next_action: 'Agent writes RED tests or evidence for active slice.'
  };
}

module.exports = {
  classifyRoadmapItem,
  executeRoadmapItem
};
