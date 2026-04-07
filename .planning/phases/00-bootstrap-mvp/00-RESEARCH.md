# Phase 0: Bootstrap MVP - Research

**Researched:** 2026-04-07
**Domain:** Node.js CLI tooling, TDD with Vitest, filesystem-based governance artifacts, fixture-based integration testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Vitest from day one — Phase 0's TDD wave (00-01 RED stubs) uses Vitest. No test runner migration cost. Phase 0's test suite must remain GREEN throughout Phase 1 execution.
- **D-02:** Minimal viable fixtures — just enough scaffolding to exercise the CLI commands. Not meant to be buildable or runnable projects.
  - `fixtures/ts-monorepo`: package.json + packages/ structure (multi-package workspace skeleton)
  - `fixtures/script-repo`: a few script files, no framework, no test runner
  - `fixtures/no-tests`: src/ directory with source files but no test files
  - `fixtures/gsd-modified`: .claude/ + GSD configuration files to simulate existing GSD setup
- **D-03:** Fixture repos live inside the Terrace repo at `fixtures/`. No git submodules or external repos. Tests reference them by relative path.
- **D-04:** "Minimal intake" in Phase 0 means file scaffold only — no `terrace intake` CLI command. Intake step = creating `docs/prd/PRD.md` from the template (manually or as side-effect of `terrace init`).
- **D-05:** `terrace init` uses plain text line-per-file output in Phase 0: `CREATED .terrace/policy.json`, `SKIPPED docs/prd/PRD.md (exists)`.
- **D-06:** `terrace spec validate` uses `ERROR:` / `WARN:` prefixes in plain text output. Non-zero exit for errors, zero for warnings-only.
- **D-07:** Minimal `terrace-tools.cjs` commands: `init`, `validate-source`, `baseline-protect`, `session-start`, `session-end`. Node.js CJS, stdlib only, single file.
- **D-08:** Five source artifact templates only: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md. Templates at "minimal spec" — required sections present, YAML frontmatter, no prose.
- **D-09:** Minimal `terrace init`: creates `.terrace/` skeleton and `docs/` directory structure; installs five source templates; prints manifest.
- **D-10:** Minimal `terrace spec validate`: validates presence and required sections of source artifacts only (the five templates).
- **D-11:** Minimal `terrace baseline protect <file> --spec-ref <ID>`: writes entry to `baseline-registry.json`, refuses to register without valid spec_ref.
- **D-12:** Minimal `terrace session start` / `terrace session end`: writes and appends SESSION.md. Must record: current phase, active slice, files changed, next steps.

### Claude's Discretion

- Exact YAML frontmatter fields for minimal-spec templates (follow REQUIREMENTS.md schema where specified; minimally: required sections only)
- Vitest configuration (coverage reporter, thresholds — keep minimal in Phase 0)
- Exact content of each fixture repo beyond what's needed to exercise the CLI commands
- Internal structure of `terrace-tools.cjs` (simple switch/case acceptable in Phase 0 — Phase 1 refactors to command registry)
- `.terrace/` skeleton structure beyond what success criteria require

### Deferred Ideas (OUT OF SCOPE)

- `terrace intake` CLI command — Phase 2 scope
- Table output as default — later in development; Phase 0 ships plain text only
- `--json` flag support — Phase 1 (CLI-12 requirement; not Phase 0)
- Full `terrace spec validate` (all 13 artifacts) — Phase 4 scope
- Doctor, preset, steering, phase-set CLI commands — Phase 1 scope
- Pre-commit hook — Phase 3 scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | PRD.md template with standard sections: problem, actors, desired outcomes, non-goals, constraints, success criteria, open questions | YAML frontmatter + section headings pattern; minimal spec in Phase 0 |
| TMPL-02 | COMPILED-SPEC.md template with YAML frontmatter (spec_version, project, phase, requirements, protected, last_updated, source_refs) | Required frontmatter fields locked; section structure at minimal spec |
| TMPL-03 | TEST-ARCH.md template with requirement-to-test-layer mapping, rationale, fixture needs, mock policy, CI tier | Section headings pattern; minimal spec in Phase 0 |
| TMPL-04 | DECISION-LOG.md template with fields: decision_id, date, author, spec_ref, change_type, rationale, impact, status | Required fields locked in REQUIREMENTS.md |
| TMPL-05 | SESSION.md template for recording session start state, current phase, files changed, decisions made, risks, next slice | Template structure drives session-start/end commands |
| TMPL-12 | .terrace/project-state.json schema with current phase, current spec hash, active slice, last session, active policy mode | JSON schema — minimal Phase 0 fields; extended in Phase 1 |
| TERR-10 | Fixture repos exist for: ts-monorepo, script-repo, no-tests, gsd-modified | Fixture scaffolding approach documented |
| TERR-11 | Fixture-based tests verify session reconstruction and artifact validation (partial in Phase 0) | Integration test pattern against `fixtures/` |
| OPS-08 | Terrace must work even when repo has no existing tests | `no-tests` fixture exercises this; validate command must not assume test files |
| OPS-09 | Terrace is language-agnostic in governance layer — cannot assume TypeScript-only execution | terrace-tools.cjs uses Node stdlib only; no TypeScript assumptions in CLI logic |
| DEV-01 | No production code committed without a prior failing test | TDD wave 1 (RED) in plan 00-01 before any implementation |
| DEV-02 | Every plan begins with test stubs before implementation code | Plan 00-01 = RED stubs; 00-02/03 = implementation; 00-04 = GREEN |
| DEV-03 | Plan not complete unless all tests pass and no implementation exists without a test | Full suite GREEN gate in plan 00-04 |
| DEV-04 | Terrace's own pre-commit hook enforces protected-baseline rules on its own test suite | Out of scope for Phase 0 (pre-commit hook is Phase 3); Phase 0 enforces via Vitest only |

</phase_requirements>

---

## Summary

Phase 0 is a walking skeleton built with a Node.js CommonJS single-file CLI, five minimal governance artifact templates, and a Vitest test suite that exercises the CLI against four in-repo fixture directories. The entire implementation is a single `terrace-tools.cjs` file following the `gsd-tools.cjs` pattern already present in `terrace-research/get-shit-done/get-shit-done/bin/gsd-tools.cjs`. No external dependencies beyond Vitest are needed.

The main technical challenge is correctly structuring Vitest to test a CommonJS CLI tool in a project that does not yet have a `package.json`. Phase 0 must create the project's `package.json` and Vitest config as part of Wave 2 (00-02). The test suite uses `execFileSync` to spawn the CLI in a subprocess and asserts against stdout, exit code, and filesystem state — the same integration-test pattern the GSD source uses, adapted from Node native test runner to Vitest.

The five source artifact templates are structured documents with YAML frontmatter and required section headings. The "minimal spec" in Phase 0 means required sections are present but contain only a comment or placeholder, not prose. Templates follow GSD's file-as-contract pattern: the file's structure is the contract between the CLI and downstream agents.

**Primary recommendation:** Copy `gsd-tools.cjs` dispatch and `execFileSync` integration-test patterns directly. Build `terrace-tools.cjs` as a single CJS file with a `switch` on `process.argv[2]`. Use Vitest with `pool: 'forks'` for CJS test files that spawn child processes.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.2 | Test runner for Phase 0 TDD suite | Locked by D-01; same runner as Phase 1; no migration cost |
| Node.js (stdlib) | >=22.0.0 | fs, path, child_process — everything terrace-tools.cjs needs | CJS stdlib-only constraint locked by D-07 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/coverage-v8 | 4.x (matches vitest) | Coverage reporting during CI | Optional in Phase 0; add only if coverage gate is needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Node native test runner (as GSD uses) | GSD uses `node --test` + `.cjs` files; Phase 0 uses Vitest per D-01. Vitest requires TypeScript test files OR explicit `pool: 'forks'` config for CJS subprocess tests |
| Single CJS file (terrace-tools.cjs) | Compiled TypeScript bundle | TypeScript bundle adds build step; D-07 locks stdlib-only CJS. Phase 1 refactors internals, not the module format |

**Installation (once package.json is created in Wave 2):**
```bash
npm install --save-dev vitest@4.1.2
```

**Version verification:** [VERIFIED: npm registry] `vitest@4.1.2` is current latest as of 2026-04-07. Engines: `{ node: '^20.0.0 || ^22.0.0 || >=24.0.0' }`. Node 24.12.0 is installed on this machine — compatible. [VERIFIED: npm view]

---

## Architecture Patterns

### Recommended Project Structure

```
/                                    # Terrace repo root
├── terrace-tools.cjs                # Single CJS CLI entry point (D-07)
├── package.json                     # Created in Phase 0 Wave 2
├── vitest.config.ts                 # Minimal Vitest config
├── fixtures/                        # D-03: fixture repos inside Terrace repo
│   ├── ts-monorepo/                 # D-02: package.json + packages/ skeleton
│   ├── script-repo/                 # D-02: a few script files, no framework
│   ├── no-tests/                    # D-02: src/ files, no test files
│   └── gsd-modified/                # D-02: .claude/ + GSD config files
├── tests/                           # Vitest test files (unit + integration)
│   ├── init.test.ts                 # terrace init command tests
│   ├── validate.test.ts             # terrace spec validate tests
│   ├── baseline.test.ts             # terrace baseline protect tests
│   ├── session.test.ts              # terrace session start/end tests
│   ├── templates.test.ts            # source artifact template structure tests
│   ├── fixtures.test.ts             # fixture repo existence tests
│   └── helpers.ts                   # Shared test utilities
└── .planning/
    └── phases/00-bootstrap-mvp/
```

### Pattern 1: CJS CLI Dispatch (switch/case)

**What:** Single `async function main()` reads `process.argv[2]` as command name, dispatches to inline handlers via switch/case. No command registry needed in Phase 0 (Phase 1 refactors this).

**When to use:** Phase 0 only — acceptable for 5 commands. Phase 1 migrates to command registry map.

**Example:**
```javascript
// Pattern: gsd-tools.cjs dispatch structure
// Source: terrace-research/get-shit-done/get-shit-done/bin/gsd-tools.cjs
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      return handleInit(args.slice(1));
    case 'validate-source':
      return handleValidateSource(args.slice(1));
    case 'baseline-protect':
      return handleBaselineProtect(args.slice(1));
    case 'session-start':
      return handleSessionStart(args.slice(1));
    case 'session-end':
      return handleSessionEnd(args.slice(1));
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
```

[ASSUMED] — Pattern derived from gsd-tools.cjs structure; terrace-tools.cjs does not yet exist.

### Pattern 2: Idempotent Init with Manifest Output

**What:** `terrace init` checks each target path before writing. Prints `CREATED` or `SKIPPED` for every file. Creates `.terrace/` and `docs/` subtrees.

**When to use:** Always — D-05 requires line-per-file manifest, D-09 requires idempotency.

**Example:**
```javascript
// Source: D-05, D-09 decisions; CREATED/SKIPPED format from CONTEXT.md
function writeFile(targetPath, content) {
  if (fs.existsSync(targetPath)) {
    console.log(`SKIPPED ${targetPath} (exists)`);
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`CREATED ${targetPath}`);
}
```

[ASSUMED] — Implementation not yet written; pattern is prescribed by decisions.

### Pattern 3: Integration Tests via execFileSync Subprocess Spawn

**What:** Vitest test files invoke `terrace-tools.cjs` via `execFileSync(process.execPath, [TOOLS_PATH, ...args], { cwd: tmpDir })`. Assert on stdout, stderr, exit code, and filesystem state. Create/destroy tmpDir per test using `beforeEach` / `afterEach`.

**When to use:** All CLI command tests. This is the correct pattern for testing a Node.js CLI tool with Vitest — subprocess spawn keeps test isolation clean and matches real-world invocation.

**Example:**
```typescript
// Source: GSD tests/phase.test.cjs pattern adapted to Vitest TypeScript
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

const TOOLS_PATH = path.resolve(__dirname, '../terrace-tools.cjs');

function runTerrace(args: string[], cwd: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execFileSync(process.execPath, [TOOLS_PATH, ...args], {
      cwd,
      encoding: 'utf8',
    });
    return { stdout, stderr: '', code: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.status ?? 1 };
  }
}

describe('terrace init', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), 'terrace-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .terrace/ skeleton and prints CREATED for each file', () => {
    const result = runTerrace(['init'], tmpDir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('CREATED .terrace/policy.json');
    expect(existsSync(path.join(tmpDir, '.terrace', 'policy.json'))).toBe(true);
  });

  it('prints SKIPPED for files that already exist', () => {
    runTerrace(['init'], tmpDir); // first run
    const result = runTerrace(['init'], tmpDir); // second run
    expect(result.stdout).toContain('SKIPPED');
    expect(result.stdout).not.toContain('CREATED');
  });
});
```

[ASSUMED] — Exact Vitest configuration not yet written; pattern is standard for CLI tool testing.

### Pattern 4: validate-source ERROR/WARN Output

**What:** `validate-source` scans for required artifact files. Missing file = `ERROR:` line. Present file with malformed sections = `WARN:` line. Exits non-zero if any ERRORs, zero if only WARNs.

**When to use:** Required by D-06; success criteria 3 requires `ERROR:` / `WARN:` distinction in output.

**Example:**
```javascript
// Source: D-06 decision; error/warn prefix pattern
function validateSource(repoRoot) {
  const requiredFiles = {
    'docs/prd/PRD.md': ['## Problem', '## Actors'],
    'docs/spec/COMPILED-SPEC.md': ['spec_version:', 'project:'],
    // ... etc
  };
  let hasErrors = false;
  for (const [relPath, requiredSections] of Object.entries(requiredFiles)) {
    const fullPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(fullPath)) {
      console.log(`ERROR: ${relPath} is missing`);
      hasErrors = true;
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const section of requiredSections) {
        if (!content.includes(section)) {
          console.log(`WARN: ${relPath} is missing required section "${section}"`);
        }
      }
    }
  }
  process.exit(hasErrors ? 1 : 0);
}
```

[ASSUMED] — Implementation not yet written; pattern prescribed by decisions.

### Pattern 5: Vitest Config for CJS CLI Tests

**What:** Vitest defaults to `pool: 'threads'` (worker threads). Testing a CJS CLI tool by spawning child processes should use `pool: 'forks'` (worker processes) to avoid potential V8 context sharing issues in worker threads.

**When to use:** Required when test files spawn subprocesses via `execFileSync`.

**Example:**
```typescript
// vitest.config.ts — minimal Phase 0 config
// Source: Vitest documentation pattern [ASSUMED from training knowledge]
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',  // Use worker processes, not worker threads
    include: ['tests/**/*.test.ts'],
  },
});
```

[ASSUMED] — Vitest `pool: 'forks'` is documented behavior; not verified against Context7 in this session.

### Pattern 6: baseline-registry.json Entry Format

**What:** `terrace baseline protect <file> --spec-ref <ID>` reads `.terrace/baseline-registry.json` (or creates it), appends a new entry, and writes back. Requires file path to exist and spec_ref to be non-empty.

**When to use:** Required by D-11; success criteria 4 requires valid entry with spec_ref and refusal without it.

**Example:**
```javascript
// baseline-registry.json structure
// Source: D-11, ENF-04 (spec_ref, locked_at, policy_flags)
{
  "version": "1",
  "entries": [
    {
      "path": "tests/baseline/core.test.ts",
      "spec_ref": "SPEC-01",
      "locked_at": "2026-04-07T00:00:00.000Z",
      "policy_flags": []
    }
  ]
}
```

[ASSUMED] — Schema derived from ENF-04 requirement and D-11 decision; exact field names are Claude's Discretion.

### Anti-Patterns to Avoid

- **Spawning `terrace` as a global binary in tests:** Tests must invoke `node terrace-tools.cjs` directly by path, not via a globally installed `terrace` command. The tool is not installed globally in Phase 0.
- **Using `require()` in Vitest test files:** Test files are `.ts`, transpiled by Vitest. Use ESM `import` syntax in tests even though `terrace-tools.cjs` is CJS.
- **Writing to the real repo root in tests:** Every test must operate in a `mkdtempSync`-created tmpDir, not the actual project directory. Filesystem state from one test must not bleed into another.
- **Assuming section presence by filename:** `validate-source` must read file content to check for required section headings — not just check file existence. Both checks are required.
- **Hardcoding absolute paths in terrace-tools.cjs:** The CLI must resolve all output paths relative to `process.cwd()` (the target repo root), not the CLI file's location (`__dirname`).
- **Creating package.json with `type: "module"`:** `terrace-tools.cjs` is CommonJS. The Terrace project's `package.json` should not set `type: "module"` — that would break `require()` in the tool.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex frontmatter parser | Inline string matching with `---` sentinel (Phase 0 only) | Phase 0 validates required fields by substring search, not full YAML parse. A real YAML parser (js-yaml) is Phase 1+ if needed — don't add a dependency for Phase 0 substring checks |
| Temp directory cleanup | Custom cleanup tracker | `fs.rmSync(dir, { recursive: true, force: true })` in `afterEach` | Node 14.14+ stdlib; no need for a custom solution |
| Test fixture creation | Complex fixture factories | Direct `fs.mkdirSync` + `fs.writeFileSync` calls inline | Fixtures are static scaffolding (D-02); minimal and stable |
| JSON schema validation | Custom JSON schema validator | Inline field presence check (`typeof data.field !== 'undefined'`) | Phase 0 validates only 3-5 fields on `project-state.json`; full JSON Schema is Phase 1+ |
| Timestamp formatting | date-fns or similar | `new Date().toISOString()` | ISO-8601 from stdlib is sufficient for `locked_at` fields |

**Key insight:** Phase 0's "minimal spec" constraint means every validation and output operation can be implemented with Node stdlib string operations and the `fs` module. Reach for a dependency only if the stdlib equivalent would take more than 10 lines — and even then, wait for Phase 1.

---

## Common Pitfalls

### Pitfall 1: Vitest Thread Pool vs Fork Pool for CLI Tests

**What goes wrong:** Vitest defaults to `pool: 'threads'` (worker threads). When test code spawns subprocesses, worker threads can share V8 memory in ways that cause spurious failures — especially when the subprocess writes files and the test reads them back in the same tick.

**Why it happens:** Worker threads share the same V8 isolate; process spawning within threads can hit race conditions on macOS with high concurrency.

**How to avoid:** Set `pool: 'forks'` in `vitest.config.ts`. Tests run in separate worker processes instead.

**Warning signs:** Tests pass individually but fail under `vitest run`; filesystem assertions pass on first run but fail on re-run.

[ASSUMED] — Pattern observed in Node.js CLI testing contexts; not verified against Vitest 4.x changelog in this session.

### Pitfall 2: `terrace session end` Writing Wrong File Path

**What goes wrong:** `session-end` is called from within the target fixture repo. If the CLI resolves `SESSION.md` relative to the CLI file's location instead of `process.cwd()`, the file lands in the Terrace repo root instead of `.planning/sessions/` inside the fixture.

**Why it happens:** `__dirname` refers to the CLI file's directory; `process.cwd()` refers to where the command was invoked.

**How to avoid:** All output path construction must use `path.resolve(process.cwd(), '.planning', 'sessions', ...)`, never `path.join(__dirname, ...)`.

**Warning signs:** SESSION.md appears in the wrong directory; end-to-end fixture test fails to find SESSION.md at expected path.

[ASSUMED] — Common Node.js CLI authoring mistake; applies directly to this codebase.

### Pitfall 3: `baseline protect` Accepting Falsy spec_ref Values

**What goes wrong:** An empty string (`""`) or whitespace-only string passes a truthy check in JavaScript. Success criteria 4 requires refusing to register without a valid spec_ref — an empty `--spec-ref ""` argument must be rejected.

**Why it happens:** `if (specRef)` passes for `"  "` (whitespace); `args.includes('--spec-ref')` is true even if the value is empty.

**How to avoid:** Validate with `specRef && specRef.trim().length > 0`. Print `ERROR: --spec-ref is required and must be non-empty` and exit 1.

**Warning signs:** baseline-protect test passes with empty spec_ref; test `refuses to register without valid spec_ref` is GREEN when it should be RED.

[ASSUMED] — JavaScript truthy gotcha; applies directly to this codebase.

### Pitfall 4: Fixture Repos Polluting Each Other Across Tests

**What goes wrong:** Integration tests that run `terrace init` against `fixtures/ts-monorepo` leave `.terrace/` directories in the actual fixture on disk. Subsequent test runs find pre-existing files and produce SKIPPED output instead of CREATED, causing test assertions to fail.

**Why it happens:** Fixture repos live in the git-tracked `fixtures/` directory. Writing to them during tests creates untracked files in the repo.

**How to avoid:** Tests must copy fixture contents to a `mkdtempSync` tmpDir before running CLI commands against them. Never run CLI commands against the `fixtures/` directory directly. The fixtures are templates, not live test environments.

**Warning signs:** `git status` shows untracked files under `fixtures/`; tests produce different results on first vs. second run.

[ASSUMED] — Common fixture-testing mistake; critical for this project given the fixture-in-repo approach.

### Pitfall 5: Template Frontmatter Field Names Drifting from Validator

**What goes wrong:** TMPL-02 requires specific YAML frontmatter fields (`spec_version`, `project`, `phase`, `requirements`, `protected`, `last_updated`, `source_refs`). If the template has different field names, `validate-source` will emit WARNs on a freshly initialized repo, causing the end-to-end test (success criterion 6) to require "manual file repair" which is explicitly forbidden.

**Why it happens:** Template content is written as freeform markdown; frontmatter field names drift from the validation logic.

**How to avoid:** Write templates and validation logic together in the same plan. The template's frontmatter fields must exactly match what `validate-source` checks for. Write the validator test first (RED) referencing specific field names, then write the template to match.

**Warning signs:** End-to-end test (00-04) fails on validate-source step with WARN output for a freshly initialized repo.

[ASSUMED] — Derived from success criterion 6 ("completes without manual file repair") and the TMPL-02 field list.

### Pitfall 6: Vitest Not Installed When RED Test Wave Runs

**What goes wrong:** Plan 00-01 writes RED test stubs. If the test runner is not installed until Plan 00-02, the test stubs cannot be executed to verify they fail. The TDD mandate (DEV-01) requires RED tests to be runnable and confirmed failing before implementation.

**Why it happens:** `package.json` and `vitest` installation are infrastructure work that feels like "implementation" but must happen before the RED wave.

**How to avoid:** Plan 00-01 must include creating `package.json` and installing Vitest as the first two tasks before writing test stubs. Alternatively, 00-01 can be split: infrastructure setup first task, RED stubs second task. The test stubs must be confirmed failing (not just written) before 00-01 is marked complete.

**Warning signs:** RED stubs committed without a `package.json`; no way to run `npx vitest` in the repo; DEV-02 violated.

[ASSUMED] — TDD bootstrapping order problem; applies to any project starting from an empty root.

---

## Code Examples

### Template YAML Frontmatter — COMPILED-SPEC.md (minimal spec)

```markdown
---
spec_version: "0.1"
project: ""
phase: ""
requirements: []
protected: false
last_updated: ""
source_refs: []
---

## Overview

<!-- Required section: brief description of the compiled spec -->

## Acceptance Criteria

<!-- Required section: list acceptance criteria with requirement IDs -->

## Invariants

<!-- Required section: list system invariants -->
```

Source: TMPL-02 field list (REQUIREMENTS.md §6) [VERIFIED: read from REQUIREMENTS.md]; section structure is Claude's Discretion at minimal spec level.

### Template YAML Frontmatter — DECISION-LOG.md (minimal spec)

```markdown
---
decision_id: ""
date: ""
author: ""
spec_ref: ""
change_type: ""
rationale: ""
impact: ""
status: ""
---

## Decision

<!-- Required section: what was decided -->

## Context

<!-- Required section: why this decision was made -->
```

Source: TMPL-04 field list (REQUIREMENTS.md §6) [VERIFIED: read from REQUIREMENTS.md].

### project-state.json Minimal Schema

```json
{
  "phase": "intake",
  "spec_hash": "",
  "active_slice": "",
  "last_session": "",
  "policy_mode": "standard"
}
```

Source: TMPL-12 required fields (REQUIREMENTS.md §6) [VERIFIED: read from REQUIREMENTS.md]. Phase 1 extends this schema.

### baseline-registry.json Initial Format

```json
{
  "version": "1",
  "entries": []
}
```

Created by `terrace init`, written to by `baseline-protect`. [ASSUMED] — schema derived from ENF-04.

### Fixture: ts-monorepo Minimum Structure

```
fixtures/ts-monorepo/
├── package.json         # { "name": "ts-monorepo", "workspaces": ["packages/*"] }
└── packages/
    ├── core/
    │   └── package.json # { "name": "@ts-monorepo/core" }
    └── utils/
        └── package.json # { "name": "@ts-monorepo/utils" }
```

Source: D-02 (CONTEXT.md) [VERIFIED: read from CONTEXT.md]; exact filenames are Claude's Discretion.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Node native test runner (`node --test`) | Vitest | D-01 locked; same as Phase 1 | Vitest requires `package.json`, Vite-based transpilation; enables TypeScript test files |
| Handcrafted YAML frontmatter | Standard YAML frontmatter (--- delimiters) | Established pattern from GSD source | Both readable by humans and parseable by tools |
| Multiple CLI files | Single `terrace-tools.cjs` file | D-07 locked | Simpler distribution; Phase 1 can refactor internals without changing entry point |

**Note:** GSD's own test suite uses Node's native test runner with `.cjs` test files (not Vitest). The Terrace project diverges from GSD here by using Vitest with TypeScript test files per D-01. This means Terrace tests can use TypeScript syntax while `terrace-tools.cjs` itself stays CommonJS.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest `pool: 'forks'` is required for execFileSync-heavy integration tests | Architecture Patterns (Pattern 5), Pitfall 1 | Tests pass in CI but fail locally or vice versa; or tests run fine with default `pool: 'threads'` — risk is LOW, easy to fix |
| A2 | `terrace-tools.cjs` switch/case dispatch pattern mirrors gsd-tools.cjs exactly | Architecture Patterns (Pattern 1) | gsd-tools.cjs uses modular require() structure internally (lib/); Phase 0 can use simpler inline handlers without that complexity |
| A3 | Fixture repos must be copied to tmpDir before tests; writing to `fixtures/` directly causes pollution | Common Pitfalls (Pitfall 4) | If tests clean up `.terrace/` after themselves, writing directly to fixtures/ is safe — but tmpDir copy is safer and avoids git noise |
| A4 | Empty `--spec-ref ""` passes JavaScript truthy check | Common Pitfalls (Pitfall 3) | Low risk to verify; `.trim().length > 0` is the correct guard regardless |
| A5 | Phase 0 project-state.json fields are exactly: phase, spec_hash, active_slice, last_session, policy_mode | Code Examples | TMPL-12 field list in REQUIREMENTS.md confirmed these; risk is LOW |

---

## Open Questions

1. **Does `terrace init` write to `fixtures/` directly or to a copy in tests?**
   - What we know: Tests must not pollute fixture directories (Pitfall 4). The end-to-end success criteria say "runs on all four fixture repos" without specifying copy-first.
   - What's unclear: Whether "runs on all four fixture repos" means the tests use a tmpDir copy or invoke against the actual `fixtures/` path.
   - Recommendation: Use tmpDir copies in automated tests. Reserve direct fixture writes for the manual end-to-end walkthrough documented in success criterion 6.

2. **Where does SESSION.md go: `.planning/sessions/` or repo root?**
   - What we know: SESS-04 says "session artifacts are committed under `.planning/sessions/`". Session success criteria say "produces SESSION.md on disk."
   - What's unclear: Whether Phase 0's minimal session command writes to `.planning/sessions/SESSION.md` (the permanent path) or a simpler location.
   - Recommendation: Write directly to `.planning/sessions/SESSION-{timestamp}.md` from day one — this matches SESS-04 and avoids a schema migration in Phase 1.

3. **Does `validate-source` operate on a path argument or always CWD?**
   - What we know: The command is called from within a target repo CWD in end-to-end tests.
   - What's unclear: Whether the command accepts an explicit path argument or always uses `process.cwd()`.
   - Recommendation: Default to `process.cwd()`. Path argument can be added in Phase 1. This keeps Phase 0 command surface minimal.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | terrace-tools.cjs runtime | ✓ | 24.12.0 | — |
| npm | Vitest installation | ✓ | 11.6.2 | — |
| vitest | Test runner (D-01) | ✗ (not yet installed) | — | Must install in Wave 1 before RED stubs |
| git | Repo operations | ✓ (implied by git repo) | — | — |

**Missing dependencies with no fallback:**
- `vitest` — must be installed as first task in plan 00-01 (before RED test stubs can be confirmed failing).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` — created in plan 00-01 (Wave 1) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-01 | PRD.md template has all required sections | unit | `npx vitest run tests/templates.test.ts` | ❌ Wave 0 |
| TMPL-02 | COMPILED-SPEC.md template has all required frontmatter fields | unit | `npx vitest run tests/templates.test.ts` | ❌ Wave 0 |
| TMPL-03 | TEST-ARCH.md template has required section headings | unit | `npx vitest run tests/templates.test.ts` | ❌ Wave 0 |
| TMPL-04 | DECISION-LOG.md template has required frontmatter fields | unit | `npx vitest run tests/templates.test.ts` | ❌ Wave 0 |
| TMPL-05 | SESSION.md template has required sections | unit | `npx vitest run tests/templates.test.ts` | ❌ Wave 0 |
| TMPL-12 | project-state.json has required fields | unit | `npx vitest run tests/init.test.ts` | ❌ Wave 0 |
| D-09 | `terrace init` creates .terrace/ + docs/ skeleton, prints CREATED manifest | integration | `npx vitest run tests/init.test.ts` | ❌ Wave 0 |
| D-05 | `terrace init` prints SKIPPED for existing files | integration | `npx vitest run tests/init.test.ts` | ❌ Wave 0 |
| D-10 | `terrace spec validate` distinguishes ERROR (missing) from WARN (malformed) | integration | `npx vitest run tests/validate.test.ts` | ❌ Wave 0 |
| D-06 | `terrace spec validate` exits non-zero for errors, zero for warn-only | integration | `npx vitest run tests/validate.test.ts` | ❌ Wave 0 |
| D-11 | `terrace baseline protect` writes valid entry with spec_ref | integration | `npx vitest run tests/baseline.test.ts` | ❌ Wave 0 |
| D-11 | `terrace baseline protect` refuses without valid spec_ref | integration | `npx vitest run tests/baseline.test.ts` | ❌ Wave 0 |
| D-12 | `terrace session start` writes SESSION.md with required fields | integration | `npx vitest run tests/session.test.ts` | ❌ Wave 0 |
| D-12 | `terrace session end` appends to SESSION.md | integration | `npx vitest run tests/session.test.ts` | ❌ Wave 0 |
| TERR-10 | All four fixture repos exist on disk | unit | `npx vitest run tests/fixtures.test.ts` | ❌ Wave 0 |
| OPS-08 | `terrace init` succeeds in no-tests fixture | integration | `npx vitest run tests/init.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before plan 00-04 begins

### Wave 0 Gaps

All test infrastructure and test files must be created in plan 00-01 (RED wave):

- [ ] `package.json` — project root; includes `vitest` as devDependency and `"test": "vitest run"` script
- [ ] `vitest.config.ts` — minimal config with `pool: 'forks'`
- [ ] `tests/init.test.ts` — covers D-09, D-05, TMPL-12, OPS-08
- [ ] `tests/validate.test.ts` — covers D-10, D-06
- [ ] `tests/baseline.test.ts` — covers D-11
- [ ] `tests/session.test.ts` — covers D-12
- [ ] `tests/templates.test.ts` — covers TMPL-01 through TMPL-05
- [ ] `tests/fixtures.test.ts` — covers TERR-10
- [ ] `tests/helpers.ts` — shared `runTerrace()` helper and tmpDir utilities
- [ ] Framework install: `npm install` (run after `package.json` is created as first task in 00-01)

---

## Security Domain

> `security_enforcement` is not set in `.planning/config.json`; treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CLI tool with no auth surface in Phase 0 |
| V3 Session Management | no | Session here means governance session, not HTTP session |
| V4 Access Control | no | No multi-user surface in Phase 0 |
| V5 Input Validation | yes | Validate `--spec-ref` arg; validate CLI subcommand names; guard file path args |
| V6 Cryptography | no | No cryptographic operations in Phase 0 |

### Known Threat Patterns for Node.js CLI Tools

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `--spec-ref` or file args | Tampering | Validate that file paths passed to `baseline-protect` are relative; reject `..` sequences or absolute paths pointing outside CWD |
| Arbitrary file write via `terrace init` CWD | Tampering | All writes use `path.resolve(process.cwd(), ...)` — CWD is the user's intended target; no additional restriction needed |
| Subprocess injection via subcommand arg | Tampering | Never pass user-provided args to shell-spawning functions; all subprocesses use `execFileSync` with explicit args array, not shell string interpolation |
| Corrupt JSON write to baseline-registry.json | Tampering | Read existing registry, parse, validate, write back; wrap in try/catch with informative error message |

**Note:** Phase 0 has a minimal attack surface (local CLI tool, no network, no auth). Primary security concern is path traversal in file arguments. [ASSUMED]

---

## Sources

### Primary (HIGH confidence)

- `/Users/jakyeamos/projects/Terrace/.planning/phases/00-bootstrap-mvp/00-CONTEXT.md` — All Phase 0 locked decisions (D-01 through D-12)
- `/Users/jakyeamos/projects/Terrace/.planning/REQUIREMENTS.md` — TMPL-01 through TMPL-05, TMPL-12, TERR-10, OPS-08, OPS-09, DEV-01 through DEV-04 requirements text [VERIFIED: read directly]
- `/Users/jakyeamos/projects/Terrace/terrace-research/get-shit-done/get-shit-done/bin/gsd-tools.cjs` — Direct pattern source for terrace-tools.cjs CJS CLI structure [VERIFIED: read directly]
- `/Users/jakyeamos/projects/Terrace/terrace-research/get-shit-done/package.json` — GSD package.json: Node >=22, Vitest ^4.1.2 as devDependency [VERIFIED: read directly]
- `npm view vitest@4.1.2` — [VERIFIED: npm registry] current latest version; engines `node ^20.0.0 || ^22.0.0 || >=24.0.0`

### Secondary (MEDIUM confidence)

- GSD `tests/phase.test.cjs` — execFileSync + tmpDir integration test pattern (verified by reading source, adapted to Vitest)
- GSD `scripts/run-tests.cjs` — confirms GSD uses Node native test runner for its own `.cjs` tests (Terrace diverges here by design per D-01)

### Tertiary (LOW confidence)

- Vitest `pool: 'forks'` recommendation — based on training knowledge of Vitest behavior with subprocess-heavy tests; not verified against Vitest 4.x changelog in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Vitest version verified via npm; Node stdlib-only constraint locked by decisions
- Architecture: MEDIUM — Patterns derived from GSD source code (verified) + implementation decisions (locked); actual implementation does not yet exist
- Pitfalls: MEDIUM — Derived from common Node.js CLI testing patterns and specific project constraints; several are [ASSUMED]

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Vitest 4.x is stable; GSD patterns are stable)
