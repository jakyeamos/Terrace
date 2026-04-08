# Phase 1: Foundation - Research

**Researched:** 2026-04-05
**Domain:** Node.js CLI tooling, JSON Schema validation, governance template design, npm package scaffolding
**Confidence:** HIGH

## Summary

Phase 1 builds the installable skeleton of Terrace: a Node.js CJS CLI tool (`terrace-tools.cjs`) modeled directly on `gsd-tools.cjs`, 13 governance artifact templates in YAML-frontmatter + terse-directive format, a JSON Schema for `project-state.json` (draft-07), a machine-readable preset registry, a security model document, and a GSD-pattern documentation file. The CLI scaffold covers `terrace init`, `terrace doctor`, `terrace spec validate`, `terrace phase set`, `terrace preset install/list`, and `terrace steering`. Every piece of production code is TDD-first with Vitest. Terrace now also treats automatic effort routing and usage intelligence as first-class foundation work, so the cheap path is encoded alongside the governance artifacts instead of being bolted on later.

The GSD pattern (file-as-message-bus, CLI-as-structured-write-path, stdlib-only CJS) is the direct template for everything in this phase. Terrace extends that pattern with a local analyzer first / AI escalator second posture: route classification, delta loading, and usage reporting are part of the core architecture, not optional ergonomics.

**Primary recommendation:** Model `terrace-tools.cjs` exactly on `gsd-tools.cjs` structure (single file, CJS, stdlib only, output function abstraction, `--json` flag), then layer deterministic route classification and usage reporting on top. Implement templates in parallel with CLI scaffold. Write failing Vitest tests before every production function.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All 13 templates use machine-precision format — YAML frontmatter for machine-readable metadata, terse structured directives, field-level annotations in agent-readable format (e.g., `spec_ref: SPEC-XX`). No prose explanations. Optimize for token efficiency, not human readability.
- **D-02:** Templates are rich in structure and coverage — every field defined, every section present, agent hints embedded as comments or metadata. "Rich" means comprehensive coverage, not verbose language.
- **D-03:** The 13 templates: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md, EDGE-CASES.md, STATE-MACHINES.md, REGRESSIONS.md, project-state.json, steering.md — all receive equal treatment under D-01/D-02.
- **D-04:** YAML frontmatter (version, project, phase, policy_mode) + terse structured directive sections. Sections: `intent`, `non_negotiables`, `agent_rules`, `scope_boundaries`, `change_control`. Each directive is one line — no paragraph prose.
- **D-05:** steering.md is the first context item any Terrace agent loads. Token budget for this file is a hard constraint — keep total under 500 tokens in the template.
- **D-06:** `terrace init` installs Terrace's own files only: `.terrace/` directory, `docs/prd/`, `docs/spec/`, `docs/testing/`, governance templates, `project-state.json`. Does not touch, read, or depend on GSD configuration.
- **D-07:** Idempotent — re-running produces the same result. On conflict (file already exists), reports exactly what would be overwritten and requires explicit `--force` to proceed.
- **D-08:** Prints a manifest of every file created or skipped. No silent writes.
- **D-09:** GSD-01–07 requirements are documentation of adopted patterns, not runtime integration. Deliver as: a `docs/architecture/GSD-PATTERNS.md` that names each borrowed pattern (file-as-message-bus, workflow-as-orchestrator, CLI-as-structured-write-path, subagent isolation, template-as-file-contract) and explicitly states what Terrace extends vs departs from.
- **D-10:** `terrace-tools.cjs` follows gsd-tools.cjs pattern exactly: Node.js CJS, stdlib only, single file, structured write path for `.terrace/` state files.
- **D-11:** `project-state.json` fields for Phase 1: `phase`, `spec_hash`, `active_slice`, `last_session`, `policy_mode`. Machine-readable JSON schema (JSON Schema draft-07) shipped alongside the template.
- **D-12:** `terrace phase set <phase>` validates transitions against a hardcoded legal-transitions table in Phase 1; the table is externalized to a JSON config in a later phase if needed.
- **D-13:** `.terrace/presets/registry.json` schema in Phase 1: `{ version, presets: [{ id, name, version, installed_at, conflicts: [] }] }`. Idempotent install — duplicate id = conflict surfaced, not silently overwritten.
- **D-14:** `terrace preset install` in Phase 1 is scaffold-only (register + conflict check). Actual preset capability loading is Phase 2+.
- **D-15:** SEC-01–07 delivered as `.terrace/SECURITY-MODEL.md` — a machine-readable policy doc listing: files Terrace may write, files Terrace may read, files Terrace will never modify, hook conflict detection rules, and explicit failure behavior when a GSD file cannot be safely patched.
- **D-16:** Vitest for all Terrace unit and integration tests. Dev dependency only — not shipped in the framework itself.
- **D-17:** TDD mandate is non-negotiable: every plan in Phase 1 writes failing tests first. No production code committed without a prior failing test.

### Claude's Discretion

- Exact YAML frontmatter field names for each template (follow REQUIREMENTS.md schema where specified)
- Vitest configuration (coverage thresholds, reporter format)
- File layout within `.terrace/` beyond what REQUIREMENTS.md specifies
- `terrace doctor` output format and remediation message wording

### Deferred Ideas (OUT OF SCOPE)

- Live GSD integration (wiring Terrace into GSD settings.json, registering skills) — explicitly out of scope. Terrace is standalone.
- Human-readable template documentation — deferred if needed at all; machine precision is the priority.
- policy.json gate enumeration — Phase 1 creates known fields (policy_mode); full gate set defined in Phase 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | PRD.md template with standard sections | Template structure pattern from D-01/D-02; sections defined in REQUIREMENTS.md §6 |
| TMPL-02 | COMPILED-SPEC.md template with YAML frontmatter fields | YAML frontmatter schema defined in REQUIREMENTS.md §6; field names at planner discretion |
| TMPL-03 | TEST-ARCH.md template with requirement-to-test-layer mapping | Template pattern from D-01/D-02 |
| TMPL-04 | DECISION-LOG.md template with defined fields | Field names specified in REQUIREMENTS.md §6 |
| TMPL-05 | SESSION.md template for session state | Template pattern from D-01/D-02 |
| TMPL-06 | INVARIANTS.md template with invariant ID/scope/severity | Template pattern from D-01/D-02 |
| TMPL-07 | ACCEPTANCE-CRITERIA.md template tied to requirement IDs | Template pattern from D-01/D-02 |
| TMPL-08 | PERMISSIONS-MATRIX.md template | Template pattern from D-01/D-02 |
| TMPL-09 | EDGE-CASES.md template with failure mode/severity | Template pattern from D-01/D-02 |
| TMPL-10 | STATE-MACHINES.md template with transition tables | Template pattern from D-01/D-02 |
| TMPL-11 | REGRESSIONS.md template with root cause/test fields | Template pattern from D-01/D-02 |
| TMPL-12 | project-state.json schema with lifecycle fields | D-11: fields defined; JSON Schema draft-07 |
| TMPL-13 | steering.md template as project constitution | D-04/D-05: YAML frontmatter + 5 sections; hard 500-token budget |
| VAL-01 | `terrace spec validate` checks required sections and schema fields | CLI command in terrace-tools.cjs; reads artifacts, validates against schema |
| VAL-02 | Validation distinguishes blocking errors from warnings | Output format design decision; JSON mode required (CLI-12) |
| VAL-03 | Validation detects missing refs and metadata | Walks artifact files, checks YAML frontmatter fields |
| VAL-04 | Validation reports artifact freshness issues | Compares session state spec_hash to current |
| VAL-05 | Validation supports custom file name mapping via config | .terrace/policy.json config mapping |
| CLI-07 | `terrace init` installs Terrace artifacts and hooks | D-06/D-07/D-08: idempotent, self-contained, manifest output |
| CLI-10 | `terrace doctor` diagnoses broken installs | Checks file presence, config validity, hook conflicts; explicit remediation |
| CLI-12 | All CLI commands support `--json` output mode | Output abstraction layer in terrace-tools.cjs |
| CLI-13 | `terrace preset install <id>` scaffold | D-14: registers + conflict check only; capability loading in Phase 2+ |
| CLI-14 | `terrace preset list` shows installed/available presets | Reads registry.json; D-13 schema |
| CLI-15 | `terrace steering` opens or creates steering.md | Creates from TMPL-13 if absent; opens file path |
| INST-01 | Single-step local install path | npm script or single command |
| INST-02 | `terrace init` is idempotent | D-07 |
| INST-03 | Install does not overwrite user files silently | D-07: --force required |
| INST-04 | Install reports exactly what was created/modified | D-08: manifest output |
| INST-05 | Terrace works in Claude Code after install | File-based, no runtime deps |
| INST-06 | Install supports repos with preexisting GSD config | D-06: Terrace does not touch GSD files |
| INST-07 | Uninstall/disable path is documented | .terrace/SECURITY-MODEL.md + README |
| INST-08 | Install can run in non-interactive mode | --yes / --force flags |
| GSD-01–07 | GSD modification policy and pattern documentation | D-09: delivered as docs/architecture/GSD-PATTERNS.md |
| SEC-01–07 | Security and trust model | D-15: .terrace/SECURITY-MODEL.md |
| LIFE-01 | Every workstream has a single current phase | project-state.json.phase field |
| LIFE-02 | Phase stored in machine-readable state file | project-state.json |
| LIFE-03 | Session start surfaces current phase | CLI-01 (Phase 5), but state file must exist in Phase 1 |
| LIFE-04 | Phase transitions recorded in session artifacts | `terrace phase set` writes to project-state.json |
| LIFE-05 | Phase cannot complete if blocking outputs missing | Transition validator in `terrace phase set` |
| LIFE-06 | Adversarial-review blocking gaps prevent completion unless deferred | Transition validator |
| PRST-01 | .terrace/presets/registry.json exists | D-13 schema |
| PRST-02 | Each preset entry declares id/version/category/effect/agents/workflows/fragments/flags | D-13 + PRST-02 field set |
| PRST-03 | Preset categories defined | governance/testing/frontend/security/integration |
| PRST-04 | Preset install is idempotent | D-14 |
| PRST-05 | Preset install does not overwrite user files without confirmation | Conflict check before write |
| PRST-06 | Preset uninstall removes components without orphans | Phase 1 scaffold; full uninstall later |
| PRST-07 | Conflicting presets surface warning, not silent overwrite | D-13: conflicts[] field surfaced |
| PRST-12 | Each preset defines typed config flags in manifest | manifest schema design |
| PRST-13 | Flags stored in .terrace/policy.json under namespaced key | policy.json schema design |
| PRST-14 | Flag values drive conditional workflow behavior | policy.json read path |
| OPS-08 | Terrace works in repos with no existing tests | init checks for test presence but does not require it |
| OPS-09 | Language-agnostic governance layer | No language assumptions in templates or CLI |
| OPS-10 | TypeScript strict-mode guidance optional | Optional flag in policy.json |
| OPS-11 | Custom repo structures supported via config mapping | VAL-05 config mapping |
| OPS-12 | Pre-commit hook merges safely with existing hooks | Hook conflict detection in terrace doctor |
| OPS-13 | Existing settings entries preserved | Terrace init reads before writing |
| OPS-14 | Failed installs are reversible | Atomic write strategy; rollback on error |
| ROUTE-01 | Automatic effort routing signals and local preprocessing | Terrace route classifier and deterministic pre-pass are first-class foundation behavior |
| EFF-01 | Effort ceilings by command class | Default routing policy must be encoded before later workflow layers depend on it |
| DELTA-01 | Delta-context packet generation and stale/impacted regeneration | Session continuity and reload policy need foundation-level schema support |
| TRIG-01 | Trigger-based deep governance | Deep governance must be represented as conditional behavior, not a default path |
| USG-01 | Usage reporting and why explanations | Usage visibility must be present before expensive workflows proliferate |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js (built-in) | 24.12.0 (env) | CJS runtime, fs/path/child_process | Stdlib-only constraint from D-10; already installed |
| Vitest | 4.1.2 | Unit and integration testing | D-16 locked decision; fastest TS-native test runner |
| TypeScript | 5.x (if needed) | Type safety for CLI code | Global CLAUDE.md: strict mode, no `any` in production; but terrace-tools.cjs is CJS — see note below |

**Note on TypeScript vs CJS:** `gsd-tools.cjs` is plain JavaScript (no TypeScript compilation step). D-10 specifies "single file, Node stdlib only." For the CLI entry point (`terrace-tools.cjs`), plain JS with JSDoc types is the correct pattern. TypeScript with compilation applies to any separate helper modules where type safety is valuable. The planner must decide whether to split CLI entry point (JS) from tested logic modules (TS). This is a discretion area.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.18.0 | JSON Schema draft-07 validation | Validating project-state.json and registry.json against shipped schemas; VAL-01 |
| ajv-formats | 3.0.1 | AJV format validators (date-time, uri, etc.) | When schemas use `format` keywords |

**Installation (dev / test only):**
```bash
npm install --save-dev vitest
npm install --save-dev ajv ajv-formats
```

**Version verification:** Verified 2026-04-05 against npm registry.
- vitest: 4.1.2 (latest)
- ajv: 8.18.0 (latest)
- ajv-formats: 3.0.1 (latest)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Vitest is locked by D-16; Jest has no advantage here |
| AJV | Zod | Zod (4.3.6) works but requires TS compilation; AJV validates pure JSON schema files, which is better for a language-agnostic tool |
| Plain JS CJS | TypeScript compiled | TS adds build step; single-file CJS avoids it and matches the gsd-tools.cjs pattern exactly |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── terrace-tools.cjs        # CLI entry point — single file, Node stdlib + minimal deps
├── lib/
│   ├── core.cjs             # Config loading, path utilities, output helpers
│   ├── init.cjs             # terrace init logic
│   ├── validate.cjs         # terrace spec validate logic
│   ├── lifecycle.cjs        # terrace phase set / transition table
│   ├── preset.cjs           # terrace preset install/list
│   └── doctor.cjs           # terrace doctor diagnostics
├── templates/               # Governance artifact templates (Markdown + YAML frontmatter)
│   ├── PRD.md
│   ├── COMPILED-SPEC.md
│   ├── TEST-ARCH.md
│   ├── DECISION-LOG.md
│   ├── SESSION.md
│   ├── INVARIANTS.md
│   ├── ACCEPTANCE-CRITERIA.md
│   ├── PERMISSIONS-MATRIX.md
│   ├── EDGE-CASES.md
│   ├── STATE-MACHINES.md
│   ├── REGRESSIONS.md
│   └── steering.md
├── schemas/
│   ├── project-state.schema.json     # JSON Schema draft-07
│   └── preset-registry.schema.json   # JSON Schema draft-07
└── docs/
    └── architecture/
        └── GSD-PATTERNS.md           # D-09 artifact
tests/
├── init.test.ts
├── validate.test.ts
├── lifecycle.test.ts
├── preset.test.ts
└── doctor.test.ts
```

**Note:** The `src/terrace-tools.cjs` is the main entry point that dispatches commands. The `lib/` modules contain the testable logic. Tests import from `lib/` modules directly — not from the CLI entry point.

### Pattern 1: CLI-as-Structured-Write-Path (from GSD)

**What:** All writes to `.terrace/` state files go through a single CLI tool. No agent, workflow, or template writes state directly. This is the file-as-message-bus pattern from GSD.

**When to use:** Any operation that mutates `.terrace/project-state.json`, `.terrace/presets/registry.json`, or `.terrace/policy.json`.

**Example (modeled on gsd-tools.cjs core pattern):**
```javascript
// terrace-tools.cjs — output abstraction (same pattern as gsd-tools.cjs)
function output(data, raw) {
  if (raw || typeof data === 'string') {
    process.stdout.write(String(data) + '\n');
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}

function error(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}
```

### Pattern 2: Idempotent Init with Manifest Output

**What:** Before writing any file, `terrace init` checks if it already exists. On conflict without `--force`, it reports the conflict and exits without writing. With `--force`, it overwrites. Every operation (create/skip/overwrite) is printed to stdout.

**When to use:** `terrace init` and any install/scaffold command.

**Example:**
```javascript
function writeWithManifest(filePath, content, force, results) {
  const exists = fs.existsSync(filePath);
  if (exists && !force) {
    results.push({ file: filePath, action: 'skipped', reason: 'exists (use --force to overwrite)' });
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  results.push({ file: filePath, action: exists ? 'overwritten' : 'created' });
}
```

### Pattern 3: JSON Schema Validation for Governance Artifacts

**What:** `terrace spec validate` loads each governance artifact, parses YAML frontmatter, and validates required fields against a schema. Errors are classified as blocking (missing required fields) or warnings (stale timestamps, missing optional refs).

**When to use:** VAL-01 through VAL-05.

**Example:**
```javascript
// validate.cjs
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function validateArtifact(artifactPath, schema) {
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const data = parseFrontmatter(artifactPath);
  const valid = validate(data);
  return {
    valid,
    errors: validate.errors || [],
    blocking: (validate.errors || []).filter(e => isBlockingError(e)),
    warnings: (validate.errors || []).filter(e => !isBlockingError(e))
  };
}
```

### Pattern 4: Legal Transition Table for Phase Lifecycle

**What:** `terrace phase set <phase>` validates that the requested transition is in a hardcoded table. Illegal transitions fail with explicit error. The table is a constant in `lifecycle.cjs`.

**When to use:** LIFE-01–06, CLI-09 (deferred to Phase 5 for full session integration, but state file management is Phase 1).

**Example:**
```javascript
// lifecycle.cjs
const LEGAL_TRANSITIONS = {
  'intake':            ['interrogation'],
  'interrogation':     ['spec-compilation', 'intake'],
  'spec-compilation':  ['test-architecture', 'interrogation'],
  'test-architecture': ['baseline-protection', 'spec-compilation'],
  'baseline-protection': ['implementation', 'test-architecture'],
  'implementation':    ['adversarial-review', 'baseline-protection'],
  'adversarial-review': ['regression-capture', 'implementation'],
  'regression-capture': ['handoff', 'adversarial-review'],
  'handoff':           ['intake']
};
```

### Pattern 5: steering.md Token Budget Enforcement

**What:** steering.md template must stay under 500 tokens. This is a hard constraint (D-05). The template uses YAML frontmatter + 5 terse sections, each with single-line directives only.

**When to use:** TMPL-13 implementation.

**Counting method:** Rough estimate: 500 tokens ≈ 375 words at typical LLM tokenization. Count words in template draft before committing.

### Pattern 6: Automatic Effort Routing

**What:** Terrace classifies tasks locally before it spends model effort. Command class, changed-file count, protected-artifact touches, active slice freshness, and safety-critical domain determine the default effort ceiling.

**When to use:** ROUTE-01, EFF-01–05, DELTA-01–03, TRIG-01–03.

**Example:** inspect / classify / usage commands stay low-effort by default, session start loads a delta packet first, and deeper governance only runs when the route says the task is ambiguous or risky.

### Pattern 7: Usage Intelligence

**What:** Terrace records a compact route summary and usage log so `/terrace-usage` and `/terrace-why` can explain why tokens were spent and where the expensive workflows are repeating.

**When to use:** USG-01–04.

**Example:** `terrace-usage` identifies repeated expensive workflows and token sinks; `terrace-why` reports the signals that caused the current effort level and the deeper steps that were skipped.

### Anti-Patterns to Avoid

- **Prose templates:** Templates are machine-readable first. No explanatory paragraphs inside templates. All explanation belongs in tests or separate documentation.
- **Silent writes:** Any file creation without manifest output violates D-08. Even `.gitkeep` or directory creation should be reported.
- **Touching GSD files in `terrace init`:** D-06 is absolute. The init command must not read or write any GSD-owned path.
- **Importing external npm packages in terrace-tools.cjs:** D-10 requires stdlib only for the CLI entry point. AJV is only used in the `lib/validate.cjs` module, never in the entry file itself.
- **Monolithic CLI file:** While gsd-tools.cjs is a single file, Terrace's CLI should dispatch to `lib/` modules. The entry file itself stays minimal. This makes testing tractable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom field-presence checker | AJV with draft-07 schema | Edge cases: type coercion, `$ref`, `allOf`, format validators |
| YAML frontmatter parsing | Custom regex parser | Standard gray-matter or frontmatter parse | Edge cases with nested YAML, multiline strings, special chars |
| Test framework | Assertion library | Vitest (locked) | D-16; no need to evaluate |

**Key insight:** The only non-stdlib dependency in production code is the shipped JSON Schema files. Validation logic in dev/test uses AJV. The CLI itself uses `fs.readFileSync` + a small frontmatter parser. This is deliberately minimal.

**On YAML frontmatter parsing:** `gsd-tools.cjs` has its own frontmatter parser in `lib/frontmatter.cjs`. Terrace should examine that implementation and reuse the same approach (stdlib regex + manual parse) rather than importing a third-party library, to stay consistent with D-10.

---

## Runtime State Inventory

> Not applicable — this is a greenfield phase. No existing runtime state to audit.

None — verified by greenfield status confirmed in CONTEXT.md §Existing Code Insights.

---

## Common Pitfalls

### Pitfall 1: terrace init Touching the Wrong Paths

**What goes wrong:** Init writes to paths like `~/.claude/settings.json` or `.planning/` (GSD-owned paths), violating D-06.
**Why it happens:** Confusing "Terrace as GSD extension" with "Terrace as standalone." Terrace is standalone (D-06).
**How to avoid:** Whitelist allowed write paths explicitly in init.cjs. Fail with explicit error if a resolved path is outside `.terrace/` or `docs/`.
**Warning signs:** Any `path.resolve` call in init.cjs that resolves outside the target repo's `.terrace/` or `docs/` directories.

### Pitfall 2: Non-Idempotent Init Corrupting Partial State

**What goes wrong:** An interrupted `terrace init` leaves partial directories. Re-running overwrites what was there without the `--force` flag.
**Why it happens:** Directories created before files; failure mid-run leaves half-initialized state.
**How to avoid:** Collect all files to write, check existence of all before writing any, then write atomically. On failure, report exactly what was not written.
**Warning signs:** Tests for `terrace init` don't include "interrupted after first file" scenario.

### Pitfall 3: Template Token Budget Violation in steering.md

**What goes wrong:** steering.md template exceeds 500 tokens because developers add helpful comments or examples.
**Why it happens:** Natural tendency to document fields inline.
**How to avoid:** Write the template first, count tokens (rough: 500 tokens ≈ 375 words), trim. Treat the 500-token limit as a test assertion — write a test that loads the template and counts approximate tokens.
**Warning signs:** Template file larger than ~2KB.

### Pitfall 4: Preset Registry Schema Drift Between Phase 1 and Phase 2

**What goes wrong:** Phase 1 defines registry.json with `{ version, presets: [{ id, name, version, installed_at, conflicts: [] }] }` (D-13). Phase 2 adds fields. If Phase 1 validates the registry too strictly, Phase 2 additions fail validation.
**Why it happens:** JSON Schema `additionalProperties: false` blocks future extension.
**How to avoid:** Phase 1 schema allows additional properties at the preset entry level. Only enforce the Phase 1 required fields. Use `required` to lock the minimum, not `additionalProperties: false`.
**Warning signs:** VAL-01 tests fail after Phase 2 adds `agents` or `workflows` fields to registry.

### Pitfall 5: TDD Discipline Breaking Down on Templates

**What goes wrong:** Templates are "just files" so developers write them without tests. Then validation logic has no test coverage.
**Why it happens:** Templates feel like documentation, not code.
**How to avoid:** Every template must have a corresponding test that: (a) loads the file, (b) parses its YAML frontmatter, (c) asserts required fields are present. These tests count as the "failing test first" for TMPL-01 through TMPL-13.
**Warning signs:** Tests directory has no template validation tests.

### Pitfall 6: --json Output Mode Inconsistency

**What goes wrong:** Some commands output pretty-printed JSON, others output raw strings, others mix formats. CLI-12 requires machine-readable JSON in `--json` mode for ALL commands.
**Why it happens:** Each command author implements output differently.
**How to avoid:** All output goes through the same `output(data, raw)` function (Pattern 1). Tests in `--json` mode call `JSON.parse(stdout)` and assert shape.
**Warning signs:** Tests that use `.toContain()` on raw stdout strings instead of parsing JSON.

---

## Code Examples

Verified patterns from GSD source in terrace-research:

### gsd-tools.cjs Output Pattern (direct model for terrace-tools.cjs)
```javascript
// Source: terrace-research/get-shit-done/get-shit-done/bin/gsd-tools.cjs (pattern)
// Core output abstraction — all stdout goes through this
function output(data, raw) {
  if (raw || typeof data === 'string') {
    process.stdout.write(String(data) + '\n');
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}
function error(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}
```

### GSD Lib Module Pattern (direct model for terrace lib/ modules)
```javascript
// Source: terrace-research/get-shit-done/get-shit-done/bin/lib/init.cjs (pattern)
// Each lib module exports named functions; entry file dispatches to them
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadConfig, output, error } = require('./core.cjs');

function cmdInit(cwd, options) {
  const results = [];
  // ... write files with manifest ...
  output(results);
}

module.exports = { cmdInit };
```

### JSON Schema draft-07 for project-state.json
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TeraceProjectState",
  "type": "object",
  "required": ["phase", "spec_hash", "active_slice", "last_session", "policy_mode"],
  "properties": {
    "phase": {
      "type": "string",
      "enum": ["intake","interrogation","spec-compilation","test-architecture",
               "baseline-protection","implementation","adversarial-review",
               "regression-capture","handoff"]
    },
    "spec_hash": { "type": ["string", "null"] },
    "active_slice": { "type": ["string", "null"] },
    "last_session": { "type": ["string", "null"], "format": "date-time" },
    "policy_mode": { "type": "string", "enum": ["strict", "standard", "lightweight"] }
  },
  "additionalProperties": true
}
```

### Vitest Test Structure for TDD (failing test first)
```typescript
// tests/lifecycle.test.ts — write this BEFORE implementing lifecycle.cjs
import { describe, it, expect } from 'vitest';
import { setPhase, isLegalTransition } from '../src/lib/lifecycle.cjs';

describe('lifecycle transitions', () => {
  it('allows intake -> interrogation', () => {
    expect(isLegalTransition('intake', 'interrogation')).toBe(true);
  });

  it('blocks intake -> implementation', () => {
    expect(isLegalTransition('intake', 'implementation')).toBe(false);
  });

  it('returns error when transition is illegal', () => {
    expect(() => setPhase({ phase: 'intake' }, 'implementation'))
      .toThrow('illegal transition');
  });
});
```

### steering.md Template Structure (under 500 tokens)
```markdown
---
version: "1.0"
project: "{{PROJECT_NAME}}"
phase: "{{CURRENT_PHASE}}"
policy_mode: standard
---

## intent
# One-line project goal.

## non_negotiables
# - invariant_01: description
# - invariant_02: description

## agent_rules
# - rule_01: description
# - rule_02: description

## scope_boundaries
# in_scope: [item, item]
# out_of_scope: [item, item]

## change_control
# protected_files: []
# decision_log_required: true
# spec_ref_required: true
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest for Node CLI tests | Vitest | 2023+ | Vitest 4.x is now the standard; Jest has no advantage for this project |
| JSON Schema draft-04/06 | JSON Schema draft-07 | 2018 | AJV 8.x defaults to draft-07; `if/then/else` and `$comment` supported |
| Monolithic CLI files | Dispatching entry + lib/ modules | N/A | Testability: lib modules are imported directly by tests |

**Deprecated/outdated:**
- `tv4` / `jsonschema` npm packages: superseded by AJV 8.x for draft-07 validation; do not use.
- `gray-matter` npm package: viable but adds a dependency; prefer implementing frontmatter parsing with a small regex function following the gsd-tools.cjs frontmatter.cjs pattern.

---

## Open Questions

1. **TypeScript compilation for lib/ modules**
   - What we know: D-10 requires terrace-tools.cjs to be CJS stdlib-only; global CLAUDE.md requires TypeScript strict mode for production code
   - What's unclear: Should lib/ modules be TypeScript compiled to CJS, or plain JS like gsd-tools.cjs?
   - Recommendation: Treat as planner's discretion. Both approaches work. If TypeScript, add a `tsconfig.json` and build step; tests can use `vitest` with the TypeScript plugin directly. If plain JS, use JSDoc types for IDE support. The planner should pick one and document it.

2. **`terrace init` hook installation**
   - What we know: CLI-07 says init "installs hooks"; D-06 says init does not touch GSD; OPS-12 requires safe merge with existing hooks
   - What's unclear: Phase 1 scope for hook installation is minimal — the pre-commit hook for baseline enforcement is Phase 3. Does Phase 1 install any hook at all?
   - Recommendation: Phase 1 init should create the hook file structure (`.terrace/hooks/`) and document what hooks will be installed, but not activate any hook that depends on Phase 3 enforcement logic. This avoids broken partial-hook states.

3. **`docs/architecture/GSD-PATTERNS.md` depth**
   - What we know: D-09 names 5 patterns: file-as-message-bus, workflow-as-orchestrator, CLI-as-structured-write-path, subagent isolation, template-as-file-contract
   - What's unclear: How detailed should each pattern description be? The GSD-01–07 requirements reference modification policy, not just pattern documentation
   - Recommendation: The document should be machine-readable and terse (consistent with D-01). One section per pattern: pattern name, source origin (gsd-tools.cjs or workflows/), how Terrace adopts it, how Terrace departs. GSD-04/05/06/07 concerns (modification safety, idempotency, failure modes) go in a separate "modification policy" section of the same document.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | terrace-tools.cjs runtime | Yes | v24.12.0 | — |
| npm | Package install | Yes | 11.6.2 | — |
| git | Atomic commits in tests | Yes (assumed — git repo confirmed) | — | — |
| Vitest | Test suite | Installable | 4.1.2 | — |
| AJV | Schema validation | Installable | 8.18.0 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all required tools are available or installable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts — Wave 0 creation required |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-01–13 | Template files exist and have valid YAML frontmatter | unit | `npx vitest run tests/templates.test.ts -t templates` | No — Wave 0 |
| TMPL-05 (steering) | steering.md template is under 500 tokens | unit | `npx vitest run tests/templates.test.ts -t steering-token-budget` | No — Wave 0 |
| TMPL-12 | project-state.json schema validates correct and incorrect state objects | unit | `npx vitest run tests/schemas.test.ts` | No — Wave 0 |
| VAL-01–05 | `terrace spec validate` returns blocking errors and warnings | unit | `npx vitest run tests/validate.test.ts` | No — Wave 0 |
| CLI-07 | `terrace init` creates all expected files in clean repo | integration | `npx vitest run tests/init.test.ts -t clean-repo` | No — Wave 0 |
| CLI-07 | `terrace init` is idempotent (re-run same result) | integration | `npx vitest run tests/init.test.ts -t idempotent` | No — Wave 0 |
| CLI-07 | `terrace init` refuses to overwrite without --force | integration | `npx vitest run tests/init.test.ts -t conflict-without-force` | No — Wave 0 |
| CLI-07 | `terrace init` prints manifest of every file | integration | `npx vitest run tests/init.test.ts -t manifest` | No — Wave 0 |
| CLI-10 | `terrace doctor` reports missing files and hook conflicts | unit | `npx vitest run tests/doctor.test.ts` | No — Wave 0 |
| CLI-12 | All CLI commands produce valid JSON in --json mode | integration | `npx vitest run tests/json-mode.test.ts` | No — Wave 0 |
| CLI-13–14 | Preset install/list are idempotent, surface conflicts | unit | `npx vitest run tests/preset.test.ts` | No — Wave 0 |
| LIFE-01–06 | Phase transition validator allows legal, blocks illegal | unit | `npx vitest run tests/lifecycle.test.ts` | No — Wave 0 |
| PRST-01–07 | Registry schema enforced on write | unit | `npx vitest run tests/schemas.test.ts -t registry` | No — Wave 0 |
| OPS-12–14 | Init merges hooks safely, preserves existing entries, is reversible | integration | `npx vitest run tests/init.test.ts -t hook-conflicts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — framework config with coverage provider
- [ ] `tests/templates.test.ts` — covers TMPL-01–13 template existence and structure
- [ ] `tests/schemas.test.ts` — covers TMPL-12 (project-state) and PRST-01 (registry) JSON Schema
- [ ] `tests/init.test.ts` — covers CLI-07, INST-01–08, OPS-12–14
- [ ] `tests/validate.test.ts` — covers VAL-01–05
- [ ] `tests/lifecycle.test.ts` — covers LIFE-01–06
- [ ] `tests/preset.test.ts` — covers CLI-13–14, PRST-01–07
- [ ] `tests/doctor.test.ts` — covers CLI-10
- [ ] `tests/json-mode.test.ts` — covers CLI-12
- [ ] `package.json` — project init with vitest dev dependency

---

## Sources

### Primary (HIGH confidence)

- `terrace-research/get-shit-done/get-shit-done/bin/gsd-tools.cjs` — direct pattern model verified by reading source
- `terrace-research/get-shit-done/get-shit-done/bin/lib/` — lib module structure verified by reading directory and init.cjs
- `.planning/phases/01-foundation/01-CONTEXT.md` — locked decisions D-01 through D-17
- `.planning/REQUIREMENTS.md` — all Phase 1 requirement IDs and field specifications
- `.planning/ROADMAP.md` — Phase 1 success criteria (6 criteria)

### Secondary (MEDIUM confidence)

- npm registry: vitest@4.1.2, ajv@8.18.0, ajv-formats@3.0.1 — verified via `npm view` on 2026-04-05
- Node.js version: v24.12.0 — verified via `node --version`
- JSON Schema draft-07 spec — standard specification, no version uncertainty

### Tertiary (LOW confidence)

- Token budget estimate for steering.md (500 tokens ≈ 375 words): rough approximation based on general LLM tokenization knowledge; validate by testing against actual Claude tokenizer if precision matters.

---

## Project Constraints (from CLAUDE.md)

The following directives from the global `~/.claude/CLAUDE.md` apply to this phase:

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| TypeScript strict mode; no `any` in production | If lib/ modules are TypeScript, strict mode is mandatory |
| Explicit return types on exported functions | All exported functions in lib/ modules need explicit return types |
| `@/*` import alias where configured | Not applicable until tsconfig is set up |
| Server Components / Server Actions | Not applicable — this is a CLI tool, not Next.js |
| Prisma client singleton | Not applicable |
| `main` stays deployable | Feature branches for all non-trivial CLI work |
| Read before modifying | All plans must read existing files before proposing changes |
| No trailing summaries after completing work | Coding tasks end with the diff, not a summary paragraph |
| No speculative abstractions | Build exactly what the requirements specify; no "future-proofing" additions |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry and direct source reading
- Architecture: HIGH — GSD pattern is directly observable in terrace-research source
- Pitfalls: MEDIUM — derived from requirements analysis and GSD pattern study; some pitfalls are predictions from design constraints rather than observed failures
- Template design: HIGH for structure; LOW for exact token counts (500-token budget needs empirical verification)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (vitest is fast-moving; check for major version changes if planning takes more than 30 days)
