'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { appendEvent } = require('./events.cjs');
const { guidanceError } = require('./guidance.cjs');
const { initCore } = require('./init.cjs');
const { loadState, saveState } = require('./state.cjs');

function normalizeIntakeId(value, label) {
  const id = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || id.split(/[.-]+/).every((part) => part === '')) {
    throw new Error('Usage: terrace ' + label);
  }
  return id;
}

function normalizePrdText(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) {
    throw new Error('PRD input is empty.');
  }
  return text + '\n';
}

function hashText(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeResolve(cwd, relativeFilePath) {
  const root = path.resolve(cwd);
  const resolved = path.resolve(cwd, relativeFilePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('UNSAFE_PATH: generated artifact path is outside the project root');
  }
  return resolved;
}

function assertWritable(cwd, relativeFilePaths, force) {
  if (force) {
    return;
  }
  for (const relativeFilePath of relativeFilePaths) {
    if (fs.existsSync(safeResolve(cwd, relativeFilePath))) {
      const match = relativeFilePath.match(/^docs\/terrace\/features\/([^/]+)\/PRD\.md$/);
      const featureId = match ? match[1] : null;
      const nextCommand = featureId
        ? 'terrace prd import ' + featureId + ' --file <file> --force'
        : 'terrace new-project <name> --prd <file> --force';
      throw guidanceError('Refusing to overwrite ' + relativeFilePath + '. Re-run with --force to replace it.', {
        code: 'PRD_OVERWRITE_REFUSED',
        file: relativeFilePath,
        why_blocked: 'Terrace will not replace an existing PRD without explicit confirmation.',
        next_command: nextCommand,
        remediation: 'Inspect `' + relativeFilePath + '` first. If replacement is intentional, run `' + nextCommand + '`.',
        inspect_command: 'sed -n 1,160p ' + relativeFilePath
      });
    }
  }
}

function writeText(cwd, relativeFilePath, content) {
  const fullPath = safeResolve(cwd, relativeFilePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return relativeFilePath;
}

function writeMarkdown(cwd, relativeFilePath, lines) {
  return writeText(cwd, relativeFilePath, lines.join('\n') + '\n');
}

function featureRef(featureId) {
  return 'docs/terrace/features/' + featureId;
}

function formatSource(source) {
  const src = source || {};
  return {
    mode: src.mode || 'unknown',
    path: src.path || null
  };
}

function sourceHeader(title, source, importedAt, prdHash, prdText) {
  const src = formatSource(source);
  return [
    '# Imported PRD: ' + title,
    '',
    '- Source mode: ' + src.mode,
    '- Source path: ' + (src.path || 'stdin'),
    '- Imported at: ' + importedAt,
    '- SHA-256: ' + prdHash,
    '',
    '---',
    '',
    prdText.trimEnd(),
    ''
  ].join('\n');
}

function extractPrdSignals(prdText) {
  const lines = prdText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, ''));
  const headings = lines.filter((line) => /^#{1,3}\s+/.test(line)).map((line) => line.replace(/^#{1,3}\s+/, ''));
  const lower = prdText.toLowerCase();
  const hasRisks = lower.includes('risk') || lower.includes('constraint') || lower.includes('edge case');
  const hasMetrics = lower.includes('metric') || lower.includes('success') || lower.includes('kpi');
  const hasUsers = lower.includes('user') || lower.includes('customer') || lower.includes('actor');
  return {
    title: headings[0] || 'Imported PRD',
    headings,
    bullets,
    hasRisks,
    hasMetrics,
    hasUsers,
    openQuestions: [
      ...(hasUsers ? [] : ['Which user or customer segment is the primary target?']),
      ...(hasMetrics ? [] : ['Which measurable success metric proves this worked?']),
      ...(hasRisks ? [] : ['Which risks, constraints, or edge cases could change implementation sequencing?'])
    ]
  };
}

function bulletLines(items, fallback) {
  return items.length > 0 ? items.map((item) => '- ' + item) : ['- ' + fallback];
}

function acceptanceLines(signals) {
  if (signals.bullets.length === 0) {
    return ['- Needs clarification: no explicit PRD requirements were detected.'];
  }
  return signals.bullets.map((item) => '- Given the target user, when they need "' + item + '", then the product behavior should satisfy that PRD requirement.');
}

function compiledSpecLines(title, signals, prdHash) {
  return [
    '# Compiled Spec: ' + title,
    '',
    '## Source',
    '- PRD hash: ' + prdHash,
    '',
    '## Problem Statement',
    '- Derived from imported PRD headings and requirements.',
    '',
    '## Target Users',
    ...(signals.hasUsers ? ['- User evidence found in PRD.'] : ['- Needs clarification: primary user segment is not explicit.']),
    '',
    '## Requirements',
    ...bulletLines(signals.bullets, 'Needs clarification: no explicit bullet requirements were detected.'),
    '',
    '## Success Metrics',
    ...(signals.hasMetrics ? ['- Success metric evidence found in PRD.'] : ['- Needs clarification: measurable success metric is not explicit.']),
    '',
    '## Risks And Constraints',
    ...(signals.hasRisks ? ['- Risk or constraint evidence found in PRD.'] : ['- Needs clarification: risks, constraints, and edge cases are not explicit.']),
    '',
    '## Open Questions',
    ...bulletLines(signals.openQuestions, 'None detected by deterministic intake.')
  ];
}

function testPlanLines(title, signals) {
  return [
    '# Test Plan: ' + title,
    '',
    '## Critical Paths',
    ...bulletLines(signals.bullets, 'Needs clarification: no behavior requirements were detected.'),
    '',
    '## Test Layers',
    '- Unit tests for deterministic domain rules and transformations.',
    '- Integration tests for user workflows implied by the PRD.',
    '- End-to-end or acceptance tests for the highest-risk critical path.',
    '',
    '## Missing Evidence',
    ...bulletLines(signals.openQuestions, 'None detected by deterministic intake.'),
    '',
    '## Next Step',
    '- Run `terrace interrogate ' + normalizeIntakeId(title, '<name>') + '` if any missing evidence remains.'
  ];
}

function writeProjectArtifacts(cwd, input) {
  const signals = extractPrdSignals(input.prdText);
  const artifacts = [
    'docs/prd/PRD.md',
    'docs/spec/COMPILED-SPEC.md',
    'docs/spec/ACCEPTANCE-CRITERIA.md',
    'docs/testing/TEST-PLAN.md',
    'docs/terrace/project/INITIALIZATION.md'
  ];
  assertWritable(cwd, artifacts, input.force);
  writeText(cwd, 'docs/prd/PRD.md', sourceHeader(input.name, input.source, input.importedAt, input.prdHash, input.prdText));
  writeMarkdown(cwd, 'docs/spec/COMPILED-SPEC.md', compiledSpecLines(input.name, signals, input.prdHash));
  writeMarkdown(cwd, 'docs/spec/ACCEPTANCE-CRITERIA.md', [
    '# Acceptance Criteria: ' + input.name,
    '',
    '## Criteria',
    ...acceptanceLines(signals),
    '',
    '## Needs Clarification',
    ...bulletLines(signals.openQuestions, 'None detected by deterministic intake.')
  ]);
  writeMarkdown(cwd, 'docs/testing/TEST-PLAN.md', testPlanLines(input.name, signals));
  writeMarkdown(cwd, 'docs/terrace/project/INITIALIZATION.md', [
    '# Project Initialization: ' + input.name,
    '',
    '## Source',
    '- Mode: ' + formatSource(input.source).mode,
    '- Path: ' + (formatSource(input.source).path || 'stdin'),
    '- PRD hash: ' + input.prdHash,
    '',
    '## Artifacts Created',
    ...artifacts.map((artifact) => '- ' + artifact),
    '',
    '## Confidence',
    '- Deterministic intake preserved the source PRD and extracted structured requirements where explicit.',
    '',
    '## Next Command',
    '- terrace interrogate ' + input.projectId
  ]);
  return artifacts;
}

function nextCommandForPrd(prdText, featureId) {
  const signals = extractPrdSignals(prdText);
  return signals.openQuestions.length > 0 ? 'terrace interrogate ' + featureId : 'terrace design ' + featureId;
}

function writeFeatureArtifacts(cwd, input) {
  const base = featureRef(input.featureId);
  const signals = extractPrdSignals(input.prdText);
  const artifacts = [
    base + '/PRD.md',
    base + '/ALIGNMENT.md',
    base + '/ACCEPTANCE-CRITERIA.md',
    base + '/TEST-PLAN.md',
    base + '/PRD-IMPORT.md'
  ];
  assertWritable(cwd, artifacts, input.force);
  writeText(cwd, base + '/PRD.md', sourceHeader(input.featureId, input.source, input.importedAt, input.prdHash, input.prdText));
  writeMarkdown(cwd, base + '/ALIGNMENT.md', [
    '# Alignment: ' + input.featureId,
    '',
    '## Source PRD',
    '- ' + base + '/PRD.md',
    '',
    '## Requirements',
    ...bulletLines(signals.bullets, 'Needs clarification: no explicit bullet requirements were detected.'),
    '',
    '## Success Metrics',
    ...(signals.hasMetrics ? ['- Success metric evidence found in PRD.'] : ['- Needs clarification: measurable success metric is not explicit.']),
    '',
    '## Risks',
    ...(signals.hasRisks ? ['- Risk or constraint evidence found in PRD.'] : ['- Needs clarification: risks, constraints, and edge cases are not explicit.'])
  ]);
  writeMarkdown(cwd, base + '/ACCEPTANCE-CRITERIA.md', [
    '# Acceptance Criteria: ' + input.featureId,
    '',
    '## Criteria',
    ...acceptanceLines(signals),
    '',
    '## Needs Clarification',
    ...bulletLines(signals.openQuestions, 'None detected by deterministic intake.')
  ]);
  writeMarkdown(cwd, base + '/TEST-PLAN.md', testPlanLines(input.featureId, signals));
  writeMarkdown(cwd, base + '/PRD-IMPORT.md', [
    '# PRD Import: ' + input.featureId,
    '',
    '## Source',
    '- Mode: ' + formatSource(input.source).mode,
    '- Path: ' + (formatSource(input.source).path || 'stdin'),
    '- PRD hash: ' + input.prdHash,
    '',
    '## Artifacts Created',
    ...artifacts.map((artifact) => '- ' + artifact),
    '',
    '## Next Command',
    '- ' + nextCommandForPrd(input.prdText, input.featureId)
  ]);
  return artifacts;
}

function newProjectFromPrd(cwd, options) {
  const opts = options || {};
  const projectId = normalizeIntakeId(opts.name, 'new-project <name>');
  const prdText = normalizePrdText(opts.prdText);
  const stateExists = fs.existsSync(path.resolve(cwd, '.terrace', 'state.json'));
  const initialized = stateExists ? { created: [] } : initCore(cwd, { projectName: opts.name });
  const importedAt = new Date().toISOString();
  const prdHash = hashText(prdText);
  const artifacts = writeProjectArtifacts(cwd, {
    projectId,
    name: opts.name,
    prdText,
    prdHash,
    importedAt,
    source: opts.source,
    force: Boolean(opts.force)
  });
  const state = loadState(cwd);
  const nextStatus = state.workflow.status === 'initialized' ? 'intake_recorded' : state.workflow.status;
  const nextState = {
    ...state,
    project: {
      ...state.project,
      name: opts.name,
      prd_intake: {
        project_id: projectId,
        source_mode: formatSource(opts.source).mode,
        source_path: formatSource(opts.source).path,
        prd_hash: prdHash,
        imported_at: importedAt,
        artifacts
      }
    },
    workflow: {
      ...state.workflow,
      status: nextStatus,
      active_feature: projectId
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, {
    command: 'terrace new-project ' + projectId,
    from_state: state.workflow.status,
    to_state: nextStatus,
    evidence_refs: artifacts
  });
  return {
    project_id: projectId,
    initialized: !stateExists,
    init_created: initialized.created,
    artifacts,
    next_command: 'terrace interrogate ' + projectId
  };
}

function importFeaturePrd(cwd, options) {
  const opts = options || {};
  const featureId = normalizeIntakeId(opts.feature, 'prd import <feature>');
  const prdText = normalizePrdText(opts.prdText);
  const state = loadState(cwd);
  const importedAt = new Date().toISOString();
  const prdHash = hashText(prdText);
  const artifacts = writeFeatureArtifacts(cwd, {
    featureId,
    prdText,
    prdHash,
    importedAt,
    source: opts.source,
    force: Boolean(opts.force)
  });
  const features = state.senior_cycle && state.senior_cycle.features ? state.senior_cycle.features : {};
  const existing = features[featureId] || {};
  const nextState = {
    ...state,
    workflow: { ...state.workflow, active_feature: featureId },
    senior_cycle: {
      ...(state.senior_cycle || {}),
      active_feature: featureId,
      features: {
        ...features,
        [featureId]: {
          ...existing,
          feature_id: featureId,
          tier: existing.tier || 'medium',
          prd_intake: {
            source_mode: formatSource(opts.source).mode,
            source_path: formatSource(opts.source).path,
            prd_hash: prdHash,
            imported_at: importedAt
          },
          artifacts: {
            ...(existing.artifacts || {}),
            prd: featureRef(featureId) + '/PRD.md',
            alignment: featureRef(featureId) + '/ALIGNMENT.md',
            acceptance: featureRef(featureId) + '/ACCEPTANCE-CRITERIA.md',
            test_plan: featureRef(featureId) + '/TEST-PLAN.md',
            import_summary: featureRef(featureId) + '/PRD-IMPORT.md'
          }
        }
      }
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, {
    command: 'terrace prd import ' + featureId,
    evidence_refs: artifacts
  });
  return {
    feature_id: featureId,
    artifacts,
    next_command: nextCommandForPrd(prdText, featureId)
  };
}

module.exports = {
  newProjectFromPrd,
  importFeaturePrd
};
