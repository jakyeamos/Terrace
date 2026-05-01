# Terrace PRD Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `terrace new-project` and `terrace prd import` so users can turn pasted or file-based PRDs into durable Terrace artifacts.

**Architecture:** Add a focused CommonJS core module for PRD intake and keep CLI concerns in `src/terrace-tools.cjs`. The core module receives already-read PRD text, writes source and derived artifacts with overwrite guards, updates `.terrace/state.json`, and appends events.

**Tech Stack:** Node.js CommonJS, built-in `fs/path/crypto`, Vitest CLI tests, Terrace markdown artifacts under `docs/`.

---

## File Structure

- Create `packages/terrace-core/src/prd-intake.cjs`: owns PRD validation, slug normalization, deterministic artifact generation, overwrite checks, state updates, and events for `new-project` and `prd import`.
- Modify `packages/terrace-core/src/index.cjs`: exports the new PRD intake functions.
- Modify `src/terrace-tools.cjs`: adds help text, parses `new-project` and `prd import`, reads file/stdin input, passes `--force`, and preserves JSON output behavior.
- Modify `README.md`: documents both commands and heredoc paste examples.
- Modify `tests/core-cli.test.ts`: adds end-to-end CLI tests using temp repos and stdin.
- Modify `.tracker/PROJECT_TRUTH.md`: records the new planning/implementation state after verification.

### Task 1: Core PRD Intake Module

**Files:**
- Create: `packages/terrace-core/src/prd-intake.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Write failing tests for deterministic artifact creation helpers**

Add tests near the strict core CLI tests that create a PRD file, run the future command, and assert the artifacts do not exist yet because the command is not implemented.

```ts
it('initializes a new project from a PRD file', () => {
  const prdPath = path.join(tmpDir, 'input-prd.md');
  fs.writeFileSync(prdPath, [
    '# Hoopscout PRD',
    '',
    '## Problem',
    'Coaches need a faster way to evaluate players.',
    '',
    '## Users',
    '- Basketball coaches',
    '',
    '## Requirements',
    '- Upload player notes.',
    '- Rank prospects by fit.',
    '',
    '## Success Metrics',
    '- Coaches produce a shortlist in under 10 minutes.'
  ].join('\n'), 'utf-8');

  const result = runTerrace(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

  expect(result.project_id).toBe('hoopscout');
  expect(result.artifacts).toContain('docs/prd/PRD.md');
  expect(result.artifacts).toContain('docs/spec/COMPILED-SPEC.md');
  expect(result.next_command).toBe('terrace interrogate hoopscout');
  expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf-8')).toContain('Upload player notes.');
});
```

Run: `npx vitest run tests/core-cli.test.ts --reporter=verbose`

Expected before implementation: FAIL because `terrace new-project` is unknown.

- [ ] **Step 2: Create `prd-intake.cjs` with safe primitives**

Implement a focused module with these exported functions:

```js
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { appendEvent } = require('./events.cjs');
const { initCore } = require('./init.cjs');
const { loadState, saveState } = require('./state.cjs');

function normalizeIntakeId(value, label) {
  const id = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!id || id.split(/[.-]+/).every((part) => part === '')) {
    throw new Error('Usage: terrace ' + label);
  }
  return id;
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

function writeText(cwd, relativeFilePath, content, options) {
  const opts = options || {};
  const fullPath = safeResolve(cwd, relativeFilePath);
  if (!opts.force && fs.existsSync(fullPath)) {
    throw new Error('Refusing to overwrite ' + relativeFilePath + '. Re-run with --force to replace it.');
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return relativeFilePath;
}
```

Keep these helpers local to avoid widening public API before there is a second caller.

- [ ] **Step 3: Add deterministic PRD extraction and markdown rendering**

Implement simple deterministic extraction that preserves ambiguity:

```js
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
```

Use the signals to generate `COMPILED-SPEC.md`, `ACCEPTANCE-CRITERIA.md`, `TEST-PLAN.md`, `INITIALIZATION.md`, `ALIGNMENT.md`, feature `TEST-PLAN.md`, and `PRD-IMPORT.md`. Bullets from the PRD become candidate requirements; unclear items go under "Needs Clarification."

- [ ] **Step 4: Export the module**

Update `packages/terrace-core/src/index.cjs`:

```js
module.exports = {
  ...require('./state.cjs'),
  ...require('./events.cjs'),
  ...require('./config.cjs'),
  ...require('./rules.cjs'),
  ...require('./init.cjs'),
  ...require('./prd-intake.cjs'),
  // existing exports continue below
};
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/core-cli.test.ts --reporter=verbose`

Expected after this task: still FAIL at CLI routing, but module imports should not throw syntax errors.

### Task 2: `terrace new-project` Core Behavior

**Files:**
- Modify: `packages/terrace-core/src/prd-intake.cjs`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Implement `newProjectFromPrd(cwd, options)`**

Add a function with this contract:

```js
function newProjectFromPrd(cwd, options) {
  const opts = options || {};
  const projectId = normalizeIntakeId(opts.name, 'new-project <name>');
  const prdText = normalizePrdText(opts.prdText);
  const stateExists = fs.existsSync(path.resolve(cwd, '.terrace', 'state.json'));
  const initialized = stateExists ? { created: [] } : initCore(cwd, { projectName: opts.name });
  const importedAt = new Date().toISOString();
  const prdHash = hashText(prdText);
  const artifacts = writeProjectArtifacts(cwd, { projectId, name: opts.name, prdText, prdHash, importedAt, source: opts.source, force: opts.force });
  const state = loadState(cwd);
  const nextState = {
    ...state,
    project: {
      ...state.project,
      name: opts.name,
      prd_intake: {
        project_id: projectId,
        source_mode: opts.source && opts.source.mode ? opts.source.mode : 'unknown',
        source_path: opts.source && opts.source.path ? opts.source.path : null,
        prd_hash: prdHash,
        imported_at: importedAt,
        artifacts
      }
    },
    workflow: {
      ...state.workflow,
      status: state.workflow.status === 'initialized' ? 'intake_recorded' : state.workflow.status,
      active_feature: projectId
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, {
    command: 'terrace new-project ' + projectId,
    from_state: state.workflow.status,
    to_state: nextState.workflow.status,
    evidence_refs: artifacts
  });
  return { project_id: projectId, initialized: !stateExists, init_created: initialized.created, artifacts, next_command: 'terrace interrogate ' + projectId };
}
```

If a repo is already beyond `initialized`, do not downgrade state. Preserve the existing workflow status and only update project intake metadata.

- [ ] **Step 2: Preserve source PRD with generated header**

Project `docs/prd/PRD.md` should begin:

```md
# Imported PRD: Hoopscout

- Source mode: file
- Source path: input-prd.md
- Imported at: 2026-05-01T00:00:00.000Z
- SHA-256: <hash>

---

<original PRD body unchanged>
```

Tests should assert the original PRD bullet content is present after the header.

- [ ] **Step 3: Add overwrite guard coverage**

Add a test:

```ts
it('refuses to overwrite an existing project PRD without force', () => {
  const prdPath = path.join(tmpDir, 'input-prd.md');
  fs.writeFileSync(prdPath, '# PRD\n\n- First requirement.\n', 'utf-8');
  runTerrace(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

  const second = runTerraceResult(tmpDir, ['new-project', 'Hoopscout', '--prd', prdPath, '--json']);

  expect(second.status).toBe(1);
  expect(second.json.error).toContain('Refusing to overwrite docs/prd/PRD.md');
});
```

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/core-cli.test.ts --reporter=verbose`

Expected: tests still FAIL until CLI routing passes PRD text into the core function.

### Task 3: `terrace prd import` Core Behavior

**Files:**
- Modify: `packages/terrace-core/src/prd-intake.cjs`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Add tests for feature import**

Add:

```ts
it('imports a feature PRD into an initialized Terrace project', () => {
  runTerrace(tmpDir, ['init', '--json']);
  const prdPath = path.join(tmpDir, 'feature-prd.md');
  fs.writeFileSync(prdPath, '# Saved Search PRD\n\n- Users can save prospect filters.\n- Success: scouts reuse filters weekly.\n', 'utf-8');

  const result = runTerrace(tmpDir, ['prd', 'import', 'Saved Search', '--file', prdPath, '--json']);

  expect(result.feature_id).toBe('saved-search');
  expect(result.artifacts).toContain('docs/terrace/features/saved-search/PRD.md');
  expect(result.artifacts).toContain('docs/terrace/features/saved-search/TEST-PLAN.md');
  expect(result.next_command).toBe('terrace interrogate saved-search');
});
```

Add failure coverage:

```ts
it('requires initialization before feature PRD import', () => {
  const prdPath = path.join(tmpDir, 'feature-prd.md');
  fs.writeFileSync(prdPath, '# Feature PRD\n\n- Requirement.\n', 'utf-8');

  const result = runTerraceResult(tmpDir, ['prd', 'import', 'Saved Search', '--file', prdPath, '--json']);

  expect(result.status).toBe(1);
  expect(result.json.error).toContain('Missing .terrace/state.json');
});
```

- [ ] **Step 2: Implement `importFeaturePrd(cwd, options)`**

Use this contract:

```js
function importFeaturePrd(cwd, options) {
  const opts = options || {};
  const featureId = normalizeIntakeId(opts.feature, 'prd import <feature>');
  const prdText = normalizePrdText(opts.prdText);
  const state = loadState(cwd);
  const importedAt = new Date().toISOString();
  const prdHash = hashText(prdText);
  const artifacts = writeFeatureArtifacts(cwd, { featureId, prdText, prdHash, importedAt, source: opts.source, force: opts.force });
  const features = state.senior_cycle && state.senior_cycle.features ? state.senior_cycle.features : {};
  const nextState = {
    ...state,
    workflow: { ...state.workflow, active_feature: featureId },
    senior_cycle: {
      ...(state.senior_cycle || {}),
      active_feature: featureId,
      features: {
        ...features,
        [featureId]: {
          ...(features[featureId] || {}),
          feature_id: featureId,
          tier: features[featureId] && features[featureId].tier ? features[featureId].tier : 'medium',
          prd_intake: {
            source_mode: opts.source && opts.source.mode ? opts.source.mode : 'unknown',
            source_path: opts.source && opts.source.path ? opts.source.path : null,
            prd_hash: prdHash,
            imported_at: importedAt
          },
          artifacts: {
            ...((features[featureId] && features[featureId].artifacts) || {}),
            prd: 'docs/terrace/features/' + featureId + '/PRD.md',
            alignment: 'docs/terrace/features/' + featureId + '/ALIGNMENT.md',
            acceptance: 'docs/terrace/features/' + featureId + '/ACCEPTANCE-CRITERIA.md',
            test_plan: 'docs/terrace/features/' + featureId + '/TEST-PLAN.md',
            import_summary: 'docs/terrace/features/' + featureId + '/PRD-IMPORT.md'
          }
        }
      }
    }
  };
  saveState(cwd, nextState);
  appendEvent(cwd, { command: 'terrace prd import ' + featureId, evidence_refs: artifacts });
  return { feature_id: featureId, artifacts, next_command: nextCommandForPrd(prdText, featureId) };
}
```

- [ ] **Step 3: Implement next-command completeness rule**

Use deterministic signals:

```js
function nextCommandForPrd(prdText, featureId) {
  const signals = extractPrdSignals(prdText);
  return signals.openQuestions.length > 0 ? 'terrace interrogate ' + featureId : 'terrace design ' + featureId;
}
```

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run tests/core-cli.test.ts --reporter=verbose`

Expected: tests still FAIL until CLI routing and input parsing exist.

### Task 4: CLI Routes, Input Parsing, And Help

**Files:**
- Modify: `src/terrace-tools.cjs`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Import the new core functions**

Add to the destructured import:

```js
  newProjectFromPrd,
  importFeaturePrd,
```

- [ ] **Step 2: Add input readers near existing option helpers**

Add:

```js
function readFileInput(cwd, filePath) {
  if (!filePath) {
    fail('Missing PRD file path', { json: false });
  }
  const resolved = path.resolve(cwd, filePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error('PRD file not found: ' + filePath);
  }
  return fs.readFileSync(resolved, 'utf8');
}

function readStdinInput() {
  return fs.readFileSync(0, 'utf8');
}
```

Do not read stdin unless `--paste-prd` or `--paste` is present.

- [ ] **Step 3: Add `new-project` routing before `init`**

Add a switch case:

```js
    case 'new-project': {
      const name = args[1];
      const prdFile = optionValue(rawArgs, '--prd');
      const paste = hasFlag(rawArgs, '--paste-prd');
      if (!name || (!prdFile && !paste)) {
        fail('Usage: terrace new-project <name> --prd <file> | --paste-prd', { json });
      }
      const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
      output(newProjectFromPrd(cwd, {
        name,
        prdText,
        force,
        source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
      }), { json });
      return;
    }
```

- [ ] **Step 4: Add `prd import` routing**

Add:

```js
    case 'prd': {
      const sub = args[1];
      if (sub === 'import') {
        const feature = args[2];
        const prdFile = optionValue(rawArgs, '--file');
        const paste = hasFlag(rawArgs, '--paste');
        if (!feature || (!prdFile && !paste)) {
          fail('Usage: terrace prd import <feature> --file <file> | --paste', { json });
        }
        const prdText = paste ? readStdinInput() : readFileInput(cwd, prdFile);
        output(importFeaturePrd(cwd, {
          feature,
          prdText,
          force,
          source: paste ? { mode: 'paste', path: null } : { mode: 'file', path: prdFile }
        }), { json });
        return;
      }
      fail('Unknown prd subcommand: ' + sub + '. Use: import', { json });
      return;
    }
```

- [ ] **Step 5: Add stdin test helper**

Add a helper beside `runTerraceResult`:

```ts
function runTerraceWithInput(tmpDir: string, args: string[], input: string) {
  const result = spawnSync(NODE_BIN, [TERRACE_CLI, ...args], { cwd: tmpDir, encoding: 'utf-8', input });
  return {
    status: result.status,
    json: JSON.parse(result.stdout)
  };
}
```

Then test paste mode:

```ts
it('initializes a new project from pasted PRD stdin', () => {
  const result = runTerraceWithInput(tmpDir, ['new-project', 'Paste App', '--paste-prd', '--json'], '# Paste App\n\n- Users paste PRDs.\n');

  expect(result.status).toBe(0);
  expect(result.json.project_id).toBe('paste-app');
  expect(fs.readFileSync(path.join(tmpDir, 'docs', 'prd', 'PRD.md'), 'utf-8')).toContain('Users paste PRDs.');
});
```

- [ ] **Step 6: Update help text**

Add these lines to `HELP_TEXT`:

```js
  '  terrace new-project <name> --prd <file>|--paste-prd',
  '  terrace prd import <feature> --file <file>|--paste',
```

- [ ] **Step 7: Run focused tests**

Run: `npx vitest run tests/core-cli.test.ts --reporter=verbose`

Expected: PASS for new PRD intake cases and existing CLI cases.

### Task 5: Documentation And Release Hygiene

**Files:**
- Modify: `README.md`
- Modify: `.tracker/PROJECT_TRUTH.md`
- Delete: `jakyeamos33-terrace-0.1.0.tgz`
- Test: `tests/core-cli.test.ts`

- [ ] **Step 1: Update README command reference**

Add to the command reference:

```md
- `terrace new-project <name> --prd <file>` or `--paste-prd` initializes Terrace from a source PRD and writes project artifacts.
- `terrace prd import <feature> --file <file>` or `--paste` imports a feature PRD into an existing Terrace project.
```

Add a short "PRD Intake" section:

````md
## PRD Intake

Start a new project from a PRD file:

```sh
terrace new-project hoopscout --prd docs/input/HOOPSCOUT-PRD.md
```

Start a new project from pasted PRD content:

```sh
terrace new-project hoopscout --paste-prd <<'PRD'
# Hoopscout PRD

- Coaches need a faster way to evaluate prospects.
PRD
```

Import a later feature PRD:

```sh
terrace prd import saved-search --file docs/input/SAVED-SEARCH-PRD.md
```
````

- [ ] **Step 2: Remove generated tarball**

Delete `jakyeamos33-terrace-0.1.0.tgz`; it is a local package artifact and should not be committed.

- [ ] **Step 3: Update project truth**

Update `.tracker/PROJECT_TRUTH.md`:

- `summary`: mention PRD intake commands when implementation lands.
- `nextStep`: point to publishing a patch version after verification.
- `lastUpdated`: today's date.
- `lastVerifiedCommand`: include the commands actually run.
- Quality notes: add focused PRD intake tests and full CI results.

- [ ] **Step 4: Run focused verification**

Run:

```sh
npx vitest run tests/core-cli.test.ts --reporter=verbose
npm run typecheck
npm run lint
```

Expected: all pass.

### Task 6: Full Verification And Publish Prep

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Bump patch version without creating a git tag**

Because the workspace may contain uncommitted planning artifacts, use:

```sh
npm version patch --no-git-tag-version
```

Expected: `package.json` and `package-lock.json` move from `0.1.0` to `0.1.1`.

- [ ] **Step 2: Run full checks**

Run:

```sh
npm run ci
npm pack --dry-run
node src/terrace-tools.cjs new-project sample --paste-prd --json <<'PRD'
# Sample PRD

- Users can initialize from a PRD.
- Success: generated artifacts exist.
PRD
```

Expected:

- `npm run ci` passes.
- `npm pack --dry-run` shows `@jakyeamos33/terrace@0.1.1`.
- The smoke command exits 0 and prints `project_id: "sample"`.

- [ ] **Step 3: Publish command for the human**

After verification, provide the user:

```sh
npm publish --access public
npm install --global @jakyeamos33/terrace@0.1.1
terrace new-project sample --paste-prd <<'PRD'
# Sample PRD

- Users can initialize from a PRD.
PRD
```

Do not run publish without explicit user confirmation at that point.

### Verification

- [ ] `npx vitest run tests/core-cli.test.ts --reporter=verbose`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run ci`
- [ ] `npm pack --dry-run`
- [ ] local CLI smoke for `new-project --paste-prd`
- [ ] local CLI smoke for `prd import --file`
