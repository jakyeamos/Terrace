#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_ARTIFACTS = {
  'docs/prd/PRD.md': [
    '## Problem',
    '## Actors',
    '## Desired Outcomes',
    '## Non-Goals',
    '## Constraints',
    '## Success Criteria',
    '## Open Questions',
  ],
  'docs/spec/COMPILED-SPEC.md': [
    'spec_version:',
    'project:',
    'phase:',
    'requirements:',
    'protected:',
    'last_updated:',
    'source_refs:',
  ],
  'docs/testing/TEST-ARCH.md': [
    '## Requirement-to-Test-Layer Mapping',
    '## Fixture Needs',
    '## Mock Policy',
    '## CI Tier',
  ],
  'docs/spec/DECISION-LOG.md': [
    'decision_id:',
    'date:',
    'author:',
    'spec_ref:',
    'change_type:',
    'rationale:',
    'impact:',
    'status:',
  ],
  '.planning/sessions/SESSION.md': [
    '## Current Phase',
    '## Active Slice',
    '## Files Changed',
    '## Decisions Made',
    '## Risks',
    '## Next Steps',
  ],
};

function writeFile(relPath, content) {
  const fullPath = path.join(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    console.log('SKIPPED ' + relPath + ' (exists)');
    return;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('CREATED ' + relPath);
}

function readTemplate(name) {
  return fs.readFileSync(path.join(__dirname, 'templates', name), 'utf8');
}

function handleInit() {
  writeFile(
    '.terrace/policy.json',
    JSON.stringify(
      {
        version: '1',
        mode: 'lightweight',
        gates: {},
      },
      null,
      2
    ) + '\n'
  );

  writeFile(
    '.terrace/project-state.json',
    JSON.stringify(
      {
        current_phase: 'intake',
        spec_hash: '',
        active_slice: '',
        last_session: '',
        policy_mode: 'lightweight',
      },
      null,
      2
    ) + '\n'
  );

  writeFile('docs/prd/PRD.md', readTemplate('PRD.md'));
  writeFile('docs/spec/COMPILED-SPEC.md', readTemplate('COMPILED-SPEC.md'));
  writeFile('docs/testing/TEST-ARCH.md', readTemplate('TEST-ARCH.md'));
  writeFile('docs/spec/DECISION-LOG.md', readTemplate('DECISION-LOG.md'));
  writeFile('.planning/sessions/SESSION.md', readTemplate('SESSION.md'));
}

function handleValidateSource() {
  let hasErrors = false;
  for (const [relPath, requiredSections] of Object.entries(SOURCE_ARTIFACTS)) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.log('ERROR: ' + relPath + ' is missing');
      hasErrors = true;
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const section of requiredSections) {
      if (!content.includes(section)) {
        console.log('WARN: ' + relPath + ' is missing required section "' + section + '"');
      }
    }
  }
  process.exit(hasErrors ? 1 : 0);
}

function parseNamedArg(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

function handleBaselineProtect(args) {
  const targetPath = args[0] || '';
  const specRef = parseNamedArg(args, '--spec-ref');

  if (!targetPath || targetPath.trim().length === 0) {
    console.error('ERROR: file path is required');
    process.exit(1);
  }
  if (targetPath.includes('..')) {
    console.error('ERROR: file path must not contain path traversal sequences');
    process.exit(1);
  }
  if (!specRef || specRef.trim().length === 0) {
    console.error('ERROR: --spec-ref is required and must be non-empty');
    process.exit(1);
  }
  if (specRef.includes('..')) {
    console.error('ERROR: --spec-ref must not contain path traversal sequences');
    process.exit(1);
  }

  const registryPath = path.join(process.cwd(), '.terrace', 'baseline-registry.json');
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });

  let registry = { version: '1', entries: [] };
  if (fs.existsSync(registryPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (parsed && Array.isArray(parsed.entries)) {
        registry = parsed;
      }
    } catch (_) {
      registry = { version: '1', entries: [] };
    }
  }

  registry.entries.push({
    path: targetPath,
    spec_ref: specRef,
    locked_at: new Date().toISOString(),
    policy_flags: [],
  });

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  console.log('PROTECTED ' + targetPath);
}

function ensureSessionTemplate(sessionPath) {
  if (fs.existsSync(sessionPath)) return;
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, readTemplate('SESSION.md'), 'utf8');
}

function handleSessionStart() {
  const sessionPath = path.join(process.cwd(), '.planning', 'sessions', 'SESSION.md');
  ensureSessionTemplate(sessionPath);
  fs.appendFileSync(
    sessionPath,
    '\n### Session Start\nstarted_at: ' + new Date().toISOString() + '\n',
    'utf8'
  );
  console.log('SESSION STARTED');
}

function handleSessionEnd() {
  const sessionPath = path.join(process.cwd(), '.planning', 'sessions', 'SESSION.md');
  ensureSessionTemplate(sessionPath);
  fs.appendFileSync(
    sessionPath,
    '\n### Session End\nended_at: ' +
      new Date().toISOString() +
      '\nFiles changed:\n- \nNext steps:\n- \n',
    'utf8'
  );
  console.log('SESSION ENDED');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      handleInit();
      return;
    case 'validate-source':
      handleValidateSource(args.slice(1));
      return;
    case 'baseline-protect':
      handleBaselineProtect(args.slice(1));
      return;
    case 'session-start':
      handleSessionStart(args.slice(1));
      return;
    case 'session-end':
      handleSessionEnd(args.slice(1));
      return;
    default:
      console.error('Unknown command: ' + command);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
