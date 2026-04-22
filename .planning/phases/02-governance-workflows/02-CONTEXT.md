# Phase 2: Governance Workflows - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The four pre-build governance workflows (Intake, Interrogation, Spec Compilation, Test Architecture) are operational end-to-end on a real feature request. Each workflow uses tri-modal architecture (Create/Edit/Validate) with step-file chaining. Backed by three dedicated agents (spec-interrogator, spec-compiler, test-architect) that load tiered knowledge fragments selectively. Unresolved assumptions and fast-mode paths are explicitly handled. Routing signals keep deep passes trigger-based.

**Hard dependency:** Phase 1 deliverables are the starting state — skill stubs (SKIL-01–27), all 13 templates at full spec, and the command registry pattern in terrace-tools.cjs must exist before Phase 2 adds workflow logic.

</domain>

<decisions>
## Implementation Decisions

### Agent File Format & Location
- **D-01:** Governance agents live in GSD-style `.agents/skills/` directories — each agent gets its own subdirectory: `.agents/skills/terrace-spec-interrogator/`, `.agents/skills/terrace-spec-compiler/`, `.agents/skills/terrace-test-architect/`. Each directory contains a `SKILL.md` file.
- **D-02:** Each SKILL.md contains all AGNT-07 fields (purpose, allowed outputs, forbidden actions, required inputs, handoff behavior, artifact ownership, fragment index reference) directly inside the file — not in a separate agent definition file.
- **D-03:** AGNT-08 steering load is implemented inside each SKILL.md workflow as the literal first instruction: "Read `.terrace/steering.md` before any other step." This is a hardcoded workflow rule, not a separate loader module.
- **D-04:** Phase 1 skill stubs (SKIL-01–27) that map to governance workflows get filled with real workflow logic in Phase 2. The stub format (YAML frontmatter + purpose + trigger) is preserved; workflow content is added below the trigger section.

### Step-File Chaining Mechanism
- **D-05:** Each tri-modal workflow uses per-step `.md` files with `next_step:` in YAML frontmatter. Naming convention: `step-01-create.md`, `step-02-edit.md`, `step-03-validate.md`. Step files live inside the agent's skill directory alongside SKILL.md.
- **D-06:** Step file YAML frontmatter fields: `step:` (integer), `mode:` (create | edit | validate), `next_step:` (filename or null for terminal step), `requires:` (artifact or condition that must exist to run this step).
- **D-07:** Resume from interruption = re-read the file named in `next_step:` from the last completed step. No separate state file needed — the step file chain is self-describing.
- **D-08:** The SKILL.md workflow entry point reads the correct step file based on context (no PRD → step-01-create.md; PRD exists → step-02-edit.md; validate requested → step-03-validate.md).

### Fragment Storage Layout
- **D-09:** Fragments are stored agent-local: a `fragments/` directory alongside each agent's SKILL.md. Layout: `.agents/skills/terrace-spec-interrogator/fragments/fragment-index.json` + individual `.md` fragment files in the same directory.
- **D-10:** `fragment-index.json` schema per FRAG-01: `{ "agent": "terrace-spec-interrogator", "fragments": [{ "id": "FRG-XX", "name": "...", "tags": [], "tier": "core" | "extended" | "specialized", "file": "fragment-name.md" }] }`.
- **D-11:** Fragment loading order in step-01 of each workflow: read fragment-index.json → load all `core` tier fragments unconditionally → load `extended` fragments based on phase/config signals → load `specialized` fragments only when specific stack or flag detected.
- **D-12:** Phase 6 presets can add fragments to an agent's `fragments/` directory and register them in that agent's `fragment-index.json`. No shared fragment tree needed in Phase 2.

### Provisional PRD Creation (OPS-01)
- **D-13:** Two-stage intake path: Stage 1 — scaffold `docs/prd/PRD.md` immediately from user request + `.terrace/steering.md`, marking unfilled sections `[PROVISIONAL]`. Stage 2 — after writing, auto-offer the Interrogation workflow to refine. User gets a concrete artifact immediately; interrogation remains optional.
- **D-14:** The provisional scaffold reads steering.md intent, non_negotiables, and scope_boundaries to pre-fill PRD constraints. The user request maps to `problem:` and `desired_outcomes:` fields. `actors:`, `non_goals:`, `constraints:`, and `success_criteria:` default to `[PROVISIONAL - run interrogation to refine]`.
- **D-15:** Stage 2 offer text: "PRD scaffolded at docs/prd/PRD.md. Run the Interrogation workflow to refine ambiguities? (y/N)". If declined → OPS-02 fast-mode path activates.

### Fast-Mode Assumption Path (OPS-02)
- **D-16:** When user declines interrogation, unresolved assumptions are logged to `docs/prd/CLARIFICATIONS.md` (the Phase 2-gated artifact in the artifact hierarchy). Each entry: `assumption: [description]`, `status: unresolved`, `resolution: deferred`. This satisfies WKFL-03.
- **D-17:** CLARIFICATIONS.md is created by the Interrogation workflow (step-01-create.md) on fast-mode path — it is the designated artifact for interrogation output including unresolved items.

### Spec Hash Computation (OPS-03/04)
- **D-18:** Spec hash is computed from COMPILED-SPEC.md content after stripping: blank lines, comment-only lines, trailing whitespace per line, and the `last_updated:` frontmatter field. SHA-256 of normalized content. Formatting-only changes (whitespace, line wrapping) do not change the hash.
- **D-19:** Hash computation lives in a new `src/lib/spec-hash.cjs` module, callable via `terrace spec hash` for testing and debugging.

### Claude's Discretion
- Exact fragment content for FRAG-06/07/08 (question-round templates, spec YAML patterns, test layer criteria) — planner should derive from REQUIREMENTS.md and GSD pattern reference
- P0–P3 risk scoring rubric specifics — derive from test layer selection criteria in FRAG-08
- CI tier assignment rules — derive from TEST-ARCH.md template structure
- OPS-03/04 edge cases (what constitutes a "semantic" change) beyond stripping comment lines and whitespace
- WKFL-05 derived artifact delta strategy (section-level vs. requirement-level rewrite thresholds)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (authoritative)
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: WKFL-01, WKFL-02, WKFL-02a/b/c, WKFL-03, WKFL-04, WKFL-05, WKFL-06, AGNT-01, AGNT-02, AGNT-03, AGNT-07, AGNT-08, FRAG-01–09, OPS-01–04
- `.planning/REQUIREMENTS.md §7b` — Knowledge Fragment System: FRAG-01–09 in full
- `.planning/REQUIREMENTS.md §7c` — Effort Routing: ROUTE-01/02, EFF-01–05, TRIG-01–03 (these constrain deep pass behavior)

### Roadmap (success criteria + plan structure)
- `.planning/ROADMAP.md §Phase 2` — 6 success criteria, 6 plan definitions, what Phase 2 builds
- `.planning/ROADMAP.md §Artifact Hierarchy` — Clarifies which artifacts are source vs. derived; determines what workflows may overwrite

### Prior phase decisions (locked context)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-22/D-23: skill stub format, SKIL-01–27 scaffolded by Phase 1; D-06/D-07: steering.md format and 500-token budget
- `.planning/phases/00-bootstrap-mvp/00-CONTEXT.md` — D-04: minimal intake scope (Phase 0 did not build intake CLI); D-05/D-06: CLI output conventions

### GSD source patterns (reference for agent/skill format)
- `terrace-research/get-shit-done/` — GSD skill file format, agent patterns, workflow-as-orchestrator pattern; highest-yield: `workflows/`, `.claude/agents/`
- `.planning/research/SOURCE-DONOR-AUDIT.md` (if exists) — GSD patterns adopted by Terrace

### Operator-cost metrics (Phase 2 must satisfy these)
- `.planning/ROADMAP.md §Operator-Cost Metrics` — MET-ERG-02 (< 10 min intake→spec), MET-ERG-06 (< 15 000 tokens per step), MET-ERG-07 (≥ 40% context reduction from fragments)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/core.cjs` — Command registry pattern; Phase 2 adds fragment-loader and spec-hash modules alongside this
- `src/lib/validate.cjs` — Artifact validation logic; spec-hash module should integrate with this for drift detection
- `src/templates/steering.md` — Template that agents load as first context; AGNT-08 compliance references this file
- `src/templates/PRD.md`, `COMPILED-SPEC.md`, `TEST-ARCH.md` — Templates at full Phase 1 spec that Phase 2 workflows write into
- `.agents/skills/gitnexus/` — Existing skill directory; confirms the pattern: subdirectory with SKILL.md

### Established Patterns
- GSD's `gsd-tools.cjs` / `terrace-tools.cjs`: single CJS file, Node stdlib only — fragment-loader and spec-hash modules follow same constraints
- GSD's skill format (YAML frontmatter + purpose + trigger + workflow): confirmed pattern for SKILL.md files in `.agents/skills/`
- Phase 1 command registry in `src/lib/core.cjs`: each Phase 2 CLI extension (e.g., `terrace spec hash`) adds a handler via this registry

### Integration Points
- `.agents/skills/` — new governance agent skill directories go here (confirmed by existing gitnexus skill)
- `src/lib/` — new `spec-hash.cjs` and `fragment-loader.cjs` modules extend existing lib structure
- `fixtures/ts-monorepo` — primary integration test surface for end-to-end Phase 2 validation (Plan 02-06)
- `terrace-tools.cjs` — extended via command registry; `terrace spec hash` and fragment-related CLI commands added here
- `.terrace/steering.md` — agents load this as first context item; Phase 2 workflows must treat it as read-only input

</code_context>

<specifics>
## Specific Ideas

- Step files are diffable markdown — each is independently testable; individual step tests mock the agent's read of the file and verify the output artifact
- Fragment loading should be measurable: tests assert that loading `core` only vs. all tiers produces ≥ 40% token count reduction on the ts-monorepo fixture (FRAG-04 / MET-ERG-07)
- CLARIFICATIONS.md is the canonical unresolved-assumption artifact — do not scatter assumptions into COMPILED-SPEC.md or DECISION-LOG.md
- Provisional PRD Stage 1 must be idempotent — re-running intake on an existing PRD should offer Edit mode (step-02-edit.md), not silently overwrite

</specifics>

<deferred>
## Deferred Ideas

- Cross-agent fragment sharing (shared .terrace/fragments/ tree) — deferred to Phase 6 when presets need it
- CLI entry points for governance workflows (e.g., `terrace intake` as a CLI command) — governance workflows are skill files in Phase 2; CLI wrappers deferred unless REQUIREMENTS.md explicitly requires them
- Domain glossary generation — `docs/spec/DOMAIN-GLOSSARY.md` is optional in Phase 2 per artifact hierarchy; defer to preset or explicit request

</deferred>

---

*Phase: 02-governance-workflows*
*Context gathered: 2026-04-22*
