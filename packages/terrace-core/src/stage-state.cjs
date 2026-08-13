'use strict';

const { appendEvent, readEvents } = require('./events.cjs');
const { loadState, saveState } = require('./state.cjs');

const STAGE_STATE_SCHEMA = 'terrace-stage-state/v1';
const PHASE_STAGE_IDS = ['plan', 'execute', 'validate', 'review', 'complete'];
const LEGAL_STAGE_TRANSITIONS = {
  pending: ['active'],
  active: ['active', 'passed', 'failed', 'blocked'],
  failed: ['active'],
  blocked: ['active'],
  passed: []
};

function createStageRun(options) {
  const opts = options || {};
  const stageIds = Array.isArray(opts.stageIds) && opts.stageIds.length > 0
    ? opts.stageIds
    : PHASE_STAGE_IDS;
  const createdAt = opts.timestamp || new Date().toISOString();
  return {
    schema_version: STAGE_STATE_SCHEMA,
    run_id: opts.runId,
    phase_id: opts.phaseId || null,
    revision: 0,
    created_at: createdAt,
    updated_at: createdAt,
    stop_packet: null,
    stages: stageIds.map((id) => ({
      id,
      status: 'pending',
      attempts: 0,
      started_at: null,
      completed_at: null,
      evidence_refs: []
    }))
  };
}

function stageById(stageRun, stageId) {
  const stage = stageRun.stages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    throw new Error('Unknown workflow stage: ' + stageId);
  }
  return stage;
}

function assertStageTransition(stageRun, stageId, toStatus) {
  const stage = stageById(stageRun, stageId);
  const allowed = LEGAL_STAGE_TRANSITIONS[stage.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error('Illegal stage transition: ' + stageId + ' ' + stage.status + ' -> ' + toStatus);
  }
  if (toStatus === 'active') {
    const stageIndex = stageRun.stages.findIndex((candidate) => candidate.id === stageId);
    const incompletePredecessor = stageRun.stages.slice(0, stageIndex).find((candidate) => candidate.status !== 'passed');
    if (incompletePredecessor) {
      throw new Error('Stage locked: ' + stageId + ' requires ' + incompletePredecessor.id + ' to pass first');
    }
  }
}

function transitionStageRun(stageRun, stageId, toStatus, options) {
  const opts = options || {};
  assertStageTransition(stageRun, stageId, toStatus);
  const timestamp = opts.timestamp || new Date().toISOString();
  return {
    ...stageRun,
    revision: stageRun.revision + 1,
    updated_at: timestamp,
    stop_packet: toStatus === 'blocked' ? (opts.stopPacket || null) : (toStatus === 'active' ? null : stageRun.stop_packet),
    stages: stageRun.stages.map((stage) => {
      if (stage.id !== stageId) {
        return stage;
      }
      return {
        ...stage,
        status: toStatus,
        attempts: toStatus === 'active' ? stage.attempts + 1 : stage.attempts,
        started_at: toStatus === 'active' ? timestamp : stage.started_at,
        completed_at: ['passed', 'failed', 'blocked'].includes(toStatus) ? timestamp : null,
        evidence_refs: Array.from(new Set([...(stage.evidence_refs || []), ...(opts.evidenceRefs || [])]))
      };
    })
  };
}

function stageRunEvent(stageRun, stageId, toStatus, options) {
  const opts = options || {};
  const stage = stageById(stageRun, stageId);
  return {
    event_type: 'stage_transition',
    command: opts.command || null,
    run_id: stageRun.run_id,
    phase_id: stageRun.phase_id,
    revision: stageRun.revision + 1,
    stage_id: stageId,
    from_status: stage.status,
    to_status: toStatus,
    result: toStatus,
    timestamp: opts.timestamp,
    evidence_refs: opts.evidenceRefs || [],
    stop_packet: opts.stopPacket || null
  };
}

function beginPhaseStageRun(cwd, phaseId, options) {
  const opts = options || {};
  const state = loadState(cwd);
  const existing = state.workflow && state.workflow.stage_run;
  const canResume = existing && existing.phase_id === phaseId && existing.stages.some((stage) => stage.status !== 'passed');
  if (canResume) {
    return existing;
  }
  const timestamp = opts.timestamp || new Date().toISOString();
  const runId = opts.runId || 'phase:' + phaseId + ':' + timestamp;
  const stageRun = createStageRun({ runId, phaseId, stageIds: PHASE_STAGE_IDS, timestamp });
  appendEvent(cwd, {
    event_type: 'stage_run_started',
    command: 'terrace execute-phase-complete ' + phaseId,
    run_id: runId,
    phase_id: phaseId,
    revision: 0,
    stage_ids: PHASE_STAGE_IDS,
    timestamp
  });
  saveState(cwd, {
    ...state,
    workflow: {
      ...state.workflow,
      stage_run: stageRun
    }
  });
  return stageRun;
}

function persistStageTransition(cwd, stageId, toStatus, options) {
  const opts = options || {};
  const state = loadState(cwd);
  const stageRun = state.workflow && state.workflow.stage_run;
  if (!stageRun) {
    throw new Error('Missing durable stage run. Start the phase workflow first.');
  }
  assertStageTransition(stageRun, stageId, toStatus);
  const event = stageRunEvent(stageRun, stageId, toStatus, opts);
  const persistedEvent = appendEvent(cwd, event);
  const nextStageRun = transitionStageRun(stageRun, stageId, toStatus, {
    timestamp: persistedEvent.timestamp,
    evidenceRefs: persistedEvent.evidence_refs,
    stopPacket: persistedEvent.stop_packet
  });
  saveState(cwd, {
    ...state,
    workflow: {
      ...state.workflow,
      stage_run: nextStageRun
    }
  });
  return nextStageRun;
}

function replayStageRun(events, runId) {
  const started = events.find((event) => event.event_type === 'stage_run_started' && event.run_id === runId);
  if (!started) {
    throw new Error('Missing stage_run_started event for ' + runId);
  }
  let stageRun = createStageRun({
    runId,
    phaseId: started.phase_id,
    stageIds: started.stage_ids,
    timestamp: started.timestamp
  });
  const transitions = events
    .filter((event) => event.event_type === 'stage_transition' && event.run_id === runId)
    .sort((left, right) => left.revision - right.revision);
  for (const event of transitions) {
    if (event.revision !== stageRun.revision + 1) {
      throw new Error('Stage event revision gap for ' + runId + ': expected ' + (stageRun.revision + 1) + ', received ' + event.revision);
    }
    const current = stageById(stageRun, event.stage_id);
    if (current.status !== event.from_status) {
      throw new Error('Stage event conflict for ' + event.stage_id + ': expected ' + current.status + ', received ' + event.from_status);
    }
    stageRun = transitionStageRun(stageRun, event.stage_id, event.to_status, {
      timestamp: event.timestamp,
      evidenceRefs: event.evidence_refs,
      stopPacket: event.stop_packet
    });
  }
  return stageRun;
}

function recoverStageRun(cwd) {
  const state = loadState(cwd);
  const snapshot = state.workflow && state.workflow.stage_run;
  if (!snapshot) {
    return null;
  }
  const replayed = replayStageRun(readEvents(cwd), snapshot.run_id);
  if (JSON.stringify(replayed) !== JSON.stringify(snapshot)) {
    saveState(cwd, {
      ...state,
      workflow: {
        ...state.workflow,
        stage_run: replayed
      }
    });
  }
  return replayed;
}

module.exports = {
  STAGE_STATE_SCHEMA,
  PHASE_STAGE_IDS,
  LEGAL_STAGE_TRANSITIONS,
  createStageRun,
  assertStageTransition,
  transitionStageRun,
  beginPhaseStageRun,
  persistStageTransition,
  replayStageRun,
  recoverStageRun
};
