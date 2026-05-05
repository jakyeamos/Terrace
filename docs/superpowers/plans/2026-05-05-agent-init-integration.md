# Agent Init Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `terrace init` install non-overwriting Codex and Claude Code agent bootstrap assets by default.

**Architecture:** Add a focused `packages/terrace-core/src/agents.cjs` module that owns template definitions, safe writes, asset status detection, and manifest writing. `initCore` calls this module after core Terrace state/rules are created and returns an `agents` result while preserving the existing `created` array contract. CLI JSON output gets the new object automatically because `terrace init` already prints the `initCore` result.

**Tech Stack:** CommonJS runtime, Node `fs`/`path`, Vitest, npm package allowlist through `package.json#files`.

---

## File Structure

- Create `packages/terrace-core/src/agents.cjs`: agent asset templates, content comparison, safe non-overwriting writes, manifest generation.
- Modify `packages/terrace-core/src/index.cjs`: export the new module.
- Modify `packages/terrace-core/src/init.cjs`: call `installAgentBootstrap` and append written manifest/assets to `created`.
- Modify `tests/core-init.test.ts`: core tests for fresh init, preservation, idempotence, and manifest contents.
- Modify `tests/init.test.ts`: relax the old allowed-path assertion to include `AGENTS.md`, `CLAUDE.md`, and `.claude/skills`.
- Modify `tests/json-mode.test.ts`: assert `terrace init --json` includes agent asset results.
- Modify `README.md`: document the default agent bootstrap behavior.
- Modify `.tracker/PROJECT_TRUTH.md`: record the implementation and current verification after the implementation commit.

### Task 1: Core Agent Bootstrap Module

**Files:**
- Create: `packages/terrace-core/src/agents.cjs`
- Modify: `packages/terrace-core/src/index.cjs`
- Test: `tests/core-init.test.ts`

- [ ] **Step 1: Write failing core tests**

Add these tests to `tests/core-init.test.ts` after the existing init artifact test:

```ts
  it('initCore installs default agent bootstrap assets in a fresh repo', () => {
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { enabled: boolean; manifest_path: string; assets: Array<{ path: string; type: string; status: string }> };
    };
    expect(result.agents.enabled).toBe(true);
    expect(result.agents.manifest_path).toBe('.terrace/agents/manifest.json');
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', type: 'codex-instructions', status: 'written' }),
      expect.objectContaining({ path: 'CLAUDE.md', type: 'claude-instructions', status: 'written' }),
      expect.objectContaining({ path: '.claude/skills/terrace-next/SKILL.md', type: 'claude-skill', status: 'written' }),
      expect.objectContaining({ path: '.terrace/agents/manifest.json', type: 'manifest', status: 'written' })
    ]));
    expect(result.created).toContain('AGENTS.md');
    expect(result.created).toContain('CLAUDE.md');
    expect(result.created).toContain('.terrace/agents/manifest.json');
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toContain('terrace next');
    expect(fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8')).toContain('terrace do "<intent>"');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-ship', 'SKILL.md'), 'utf-8')).toContain('description: Run Terrace release readiness');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, '.terrace', 'agents', 'manifest.json'), 'utf-8')) as {
      schema_version: string;
      assets: Array<{ path: string; status: string }>;
    };
    expect(manifest.schema_version).toBe('1.0');
    expect(manifest.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'written' })
    ]));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core-init.test.ts -- --runInBand`

Expected: FAIL because `result.agents` is undefined and agent files do not exist.

- [ ] **Step 3: Implement `agents.cjs`**

Create `packages/terrace-core/src/agents.cjs` with:

```js
'use strict';

const fs = require('fs');
const path = require('path');

const AGENT_SCHEMA_VERSION = '1.0';

function lines(items) {
  return items.join('\n') + '\n';
}

const AGENTS_MD = lines([
  '# Terrace Agent Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Start by running `terrace next` when the next workflow step is unclear.',
  '- Route plain-language workflow requests through `terrace do "<intent>"`.',
  '- Use `terrace quick plan`, `terrace quick execute`, and `terrace quick complete` for small scoped work.',
  '- Use `terrace phase plan`, `terrace phase execute`, `terrace phase validate`, `terrace phase review`, and `terrace phase complete` for roadmap phase work.',
  '- Run `terrace ship check` before treating protected work as ready to ship.',
  '- Preserve spec and test evidence before changing protected implementation behavior.',
  '- Do not bypass repository quality gates or Terrace governance state.',
  '- Keep changes scoped, recoverable, and tied to the command output Terrace reports.'
]);

const CLAUDE_MD = lines([
  '# Terrace Claude Code Instructions',
  '',
  'Use Terrace as the workflow authority for this repository.',
  '',
  '- Run `terrace next` to identify the next workflow action.',
  '- Route natural-language requests through `terrace do "<intent>"` when a stable Terrace command is not obvious.',
  '- Use `/terrace-next`, `/terrace-plan`, `/terrace-execute`, `/terrace-quick`, and `/terrace-ship` when available.',
  '- Preserve spec intent, behavior-first tests, validation evidence, and release gates.',
  '- Do not overwrite Terrace state or bypass `terrace ship check` for protected work.',
  '- Keep edits scoped to the active Terrace task and stop at blockers reported by Terrace.'
]);

function skillContent(description, bodyLines) {
  return lines([
    '---',
    'description: ' + description,
    '---',
    '',
    ...bodyLines
  ]);
}

const CLAUDE_SKILLS = [
  {
    path: '.claude/skills/terrace-next/SKILL.md',
    description: 'Find and follow the next Terrace workflow action.',
    body: [
      '# Terrace Next',
      '',
      'Run `terrace next` and inspect the result.',
      '',
      'If Terrace reports a next command, explain it briefly and ask before making protected changes. If it reports blockers, stop and surface the blockers.'
    ]
  },
  {
    path: '.claude/skills/terrace-plan/SKILL.md',
    description: 'Plan Terrace-governed phase or quick-task work.',
    body: [
      '# Terrace Plan',
      '',
      'Use `terrace do "$ARGUMENTS"` when arguments are provided. If no arguments are provided, run `terrace next` first.',
      '',
      'Prefer `terrace phase plan <id>` for phase work and `terrace quick plan <title>` for small scoped work. Do not proceed to implementation until Terrace reports the plan is ready.'
    ]
  },
  {
    path: '.claude/skills/terrace-execute/SKILL.md',
    description: 'Execute Terrace-governed work within recorded gates.',
    body: [
      '# Terrace Execute',
      '',
      'Use `terrace do "$ARGUMENTS"` when arguments are provided. If no arguments are provided, run `terrace next` and follow the reported execution command.',
      '',
      'Respect RED, GREEN, validation, and review gates. Stop at blockers instead of bypassing Terrace governance.'
    ]
  },
  {
    path: '.claude/skills/terrace-quick/SKILL.md',
    description: 'Run Terrace quick-task planning, execution, and completion.',
    body: [
      '# Terrace Quick',
      '',
      'For a new quick task, run `terrace quick plan "$ARGUMENTS"`.',
      '',
      'For an existing quick task, use `terrace quick execute <id>` and `terrace quick complete <id>` only after the required evidence exists. Run `terrace quick list` when the id is unknown.'
    ]
  },
  {
    path: '.claude/skills/terrace-ship/SKILL.md',
    description: 'Run Terrace release readiness and shipping checks.',
    body: [
      '# Terrace Ship',
      '',
      'Run `terrace ship check` and inspect blockers and warnings.',
      '',
      'If release readiness passes and the user wants a written artifact, run `terrace ship prepare`. Do not claim work is ready when Terrace reports blockers.'
    ]
  }
];

function templateAssets() {
  return [
    { path: 'AGENTS.md', type: 'codex-instructions', content: AGENTS_MD },
    { path: 'CLAUDE.md', type: 'claude-instructions', content: CLAUDE_MD },
    ...CLAUDE_SKILLS.map((skill) => ({
      path: skill.path,
      type: 'claude-skill',
      content: skillContent(skill.description, skill.body)
    }))
  ];
}

function writeAsset(cwd, asset) {
  const target = path.resolve(cwd, asset.path);
  if (!target.startsWith(path.resolve(cwd) + path.sep)) {
    throw new Error('Agent asset path escapes repository: ' + asset.path);
  }
  if (fs.existsSync(target)) {
    const existing = fs.readFileSync(target, 'utf8');
    return {
      path: asset.path,
      type: asset.type,
      status: existing === asset.content ? 'unchanged' : 'skipped'
    };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, asset.content, 'utf8');
  return { path: asset.path, type: asset.type, status: 'written' };
}

function writeManifest(cwd, assetResults) {
  const relPath = '.terrace/agents/manifest.json';
  const target = path.resolve(cwd, relPath);
  const manifest = {
    schema_version: AGENT_SCHEMA_VERSION,
    generated_by: 'terrace init',
    assets: assetResults
  };
  const content = JSON.stringify(manifest, null, 2) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const status = fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content ? 'unchanged' : 'written';
  fs.writeFileSync(target, content, 'utf8');
  return { path: relPath, type: 'manifest', status };
}

function installAgentBootstrap(cwd) {
  const assetResults = templateAssets().map((asset) => writeAsset(cwd, asset));
  const manifestResult = writeManifest(cwd, assetResults);
  return {
    enabled: true,
    manifest_path: manifestResult.path,
    assets: [...assetResults, manifestResult]
  };
}

module.exports = {
  installAgentBootstrap,
  templateAssets
};
```

- [ ] **Step 4: Export the module**

Add this line to `packages/terrace-core/src/index.cjs`:

```js
  ...require('./agents.cjs'),
```

- [ ] **Step 5: Wire bootstrap into init**

In `packages/terrace-core/src/init.cjs`, add:

```js
const { installAgentBootstrap } = require('./agents.cjs');
```

Then before the final `return`, add:

```js
  const agents = installAgentBootstrap(cwd);
  for (const asset of agents.assets) {
    if (asset.status === 'written') {
      created.push(asset.path);
    }
  }
```

Change the return to:

```js
  return { created, agents };
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/core-init.test.ts -- --runInBand`

Expected: PASS for `tests/core-init.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/terrace-core/src/agents.cjs packages/terrace-core/src/index.cjs packages/terrace-core/src/init.cjs tests/core-init.test.ts
git commit -m "Add agent bootstrap assets to init"
```

### Task 2: Preservation And Idempotence

**Files:**
- Modify: `tests/core-init.test.ts`
- Modify: `packages/terrace-core/src/agents.cjs`

- [ ] **Step 1: Write preservation and idempotence tests**

Add these tests to `tests/core-init.test.ts`:

```ts
  it('initCore preserves existing user-owned agent files', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Custom Codex guidance\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'custom skill\n', 'utf-8');
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { assets: Array<{ path: string; status: string }> };
    };
    expect(fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf-8')).toBe('# Custom Codex guidance\n');
    expect(fs.readFileSync(path.join(tmpDir, '.claude', 'skills', 'terrace-next', 'SKILL.md'), 'utf-8')).toBe('custom skill\n');
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'skipped' }),
      expect.objectContaining({ path: '.claude/skills/terrace-next/SKILL.md', status: 'skipped' })
    ]));
    expect(result.created).not.toContain('AGENTS.md');
    expect(result.created).not.toContain('.claude/skills/terrace-next/SKILL.md');
  });

  it('initCore reports unchanged agent assets on repeated init', () => {
    initCore(tmpDir, { projectName: 'demo' });
    const result = initCore(tmpDir, { projectName: 'demo' }) as {
      created: string[];
      agents: { assets: Array<{ path: string; status: string }> };
    };
    expect(result.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'unchanged' }),
      expect.objectContaining({ path: 'CLAUDE.md', status: 'unchanged' }),
      expect.objectContaining({ path: '.claude/skills/terrace-ship/SKILL.md', status: 'unchanged' })
    ]));
    expect(result.created).not.toContain('AGENTS.md');
    expect(result.created).not.toContain('CLAUDE.md');
  });
```

- [ ] **Step 2: Run focused test**

Run: `npm test -- tests/core-init.test.ts -- --runInBand`

Expected: PASS.

- [ ] **Step 3: Tighten manifest status if needed**

If the repeated-init test exposes manifest churn, keep manifest status as `written` when prior results differ from current results. Do not force manifest into `unchanged`; the manifest records latest run statuses and should update when statuses change from `written` to `unchanged`.

- [ ] **Step 4: Commit**

```bash
git add packages/terrace-core/src/agents.cjs tests/core-init.test.ts
git commit -m "Preserve existing agent bootstrap files"
```

### Task 3: CLI JSON And Existing Init Assertions

**Files:**
- Modify: `tests/json-mode.test.ts`
- Modify: `tests/init.test.ts`

- [ ] **Step 1: Update JSON mode test**

In `tests/json-mode.test.ts`, update the init JSON test to include:

```ts
    expect(parsed.agents.enabled).toBe(true);
    expect(parsed.agents.manifest_path).toBe('.terrace/agents/manifest.json');
    expect(parsed.agents.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'AGENTS.md', status: 'written' }),
      expect.objectContaining({ path: 'CLAUDE.md', status: 'written' }),
      expect.objectContaining({ path: '.terrace/agents/manifest.json', status: 'written' })
    ]));
```

- [ ] **Step 2: Update path-boundary assertion**

In `tests/init.test.ts`, change the old allowed path assertion to allow the new repo-root and `.claude` assets:

```ts
      const inTerrace = resolved.startsWith(path.join(tmpDir, '.terrace'));
      const inDocs = resolved.startsWith(path.join(tmpDir, 'docs'));
      const inClaude = resolved.startsWith(path.join(tmpDir, '.claude'));
      const isAgentRootFile = resolved === path.join(tmpDir, 'AGENTS.md') || resolved === path.join(tmpDir, 'CLAUDE.md');
      expect(inTerrace || inDocs || inClaude || isAgentRootFile, `init wrote outside allowed paths: ${entry}`).toBe(true);
```

- [ ] **Step 3: Run focused tests**

Run: `npm test -- tests/json-mode.test.ts tests/init.test.ts -- --runInBand`

Expected: PASS for both files.

- [ ] **Step 4: Commit**

```bash
git add tests/json-mode.test.ts tests/init.test.ts
git commit -m "Cover agent init CLI output"
```

### Task 4: README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document generated files**

In README `What Terrace Creates`, add:

```md
- `AGENTS.md` when absent
- `CLAUDE.md` when absent
- `.claude/skills/terrace-*/SKILL.md` when absent
- `.terrace/agents/manifest.json`
```

- [ ] **Step 2: Add an Agent Integration section**

Add this section after `What Terrace Creates`:

```md
## Agent Integration

`terrace init` makes a repository ready for Codex and Claude Code by default. It writes repo-local agent guidance only when the target file is missing, and preserves existing user or team guidance.

- Codex reads `AGENTS.md`, which points agents to `terrace next`, `terrace do "<intent>"`, phase commands, quick-task commands, and `terrace ship check`.
- Claude Code reads `CLAUDE.md` and gets project skills under `.claude/skills/`, including `/terrace-next`, `/terrace-plan`, `/terrace-execute`, `/terrace-quick`, and `/terrace-ship`.
- `.terrace/agents/manifest.json` records which assets were written, skipped, or unchanged during the latest init run.

If `AGENTS.md`, `CLAUDE.md`, or a matching Claude skill already exists, Terrace does not overwrite it. Merge the generated guidance manually if your project already has custom agent instructions.
```

- [ ] **Step 3: Run package dry-run**

Run: `npm run package:dry-run`

Expected: PASS and packed files include `packages/terrace-core/src/agents.cjs`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document init agent integration"
```

### Task 5: Full Verification And Truth File

**Files:**
- Modify: `.tracker/PROJECT_TRUTH.md`

- [ ] **Step 1: Run focused verification**

Run: `npm test -- tests/core-init.test.ts tests/init.test.ts tests/json-mode.test.ts -- --runInBand`

Expected: PASS.

- [ ] **Step 2: Run quality gates**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run package:dry-run`

Expected: PASS.

- [ ] **Step 3: Update project truth**

Update `.tracker/PROJECT_TRUTH.md` to say `terrace init` now installs non-overwriting Codex and Claude Code bootstrap assets by default. Update `lastUpdated`, `lastVerifiedCommand`, `lastVerifiedAt`, `Recent Progress`, and `Next Concrete Steps`.

- [ ] **Step 4: Commit truth update**

```bash
git add .tracker/PROJECT_TRUTH.md
git commit -m "Record agent init integration implementation"
```

- [ ] **Step 5: Final status check**

Run: `git status --short --branch`

Expected: clean working tree on `codex/agent-init-integration`.

## Self-Review

Spec coverage:

- Fresh init assets: Task 1.
- Existing file preservation: Task 2.
- Claude slash-invokable workflows: Task 1 skill templates.
- Codex project instructions: Task 1 `AGENTS.md`.
- Idempotent re-run: Task 2.
- JSON output: Task 3.
- Package and README coverage: Task 4.
- Truth file and verification: Task 5.

Placeholder scan: no placeholder markers or unresolved implementation steps remain.

Type consistency: result shape uses `agents.enabled`, `agents.manifest_path`, and `agents.assets[]` consistently across implementation and tests.
