# Phase 1: Foundation - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The installable skeleton: all 13 governance artifact templates defined, CLI scaffold operational, preset registry infrastructure in place, lifecycle schema machine-readable, source-pattern documentation complete, security trust model documented, and `terrace init` completes cleanly in a target repo.

Terrace is a standalone framework. GSD is a source reference — its patterns are adopted, not its runtime. No live GSD dependency; no wiring into GSD installations.
</domain>

<decisions>
## Implementation Decisions

### Governance Artifact Templates
- **D-01:** All 13 templates use machine-precision format — YAML frontmatter for machine-readable metadata, terse structured directives, field-level annotations in agent-readable format (e.g., `spec_ref: SPEC-XX`). No prose explanations. Optimize for token efficiency, not human readability.
- **D-02:** Templates are rich in structure and coverage — every field defined, every section present, agent hints embedded as comments or metadata. "Rich" means comprehensive coverage, not verbose language.
- **D-03:** The 13 templates: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md, EDGE-CASES.md, STATE-MACHINES.md, REGRESSIONS.md, project-state.json, steering.md — all receive equal treatment under D-01/D-02.

### steering.md
- **D-04:** YAML frontmatter (version, project, phase, policy_mode) + terse structured directive sections. Sections: `intent`, `non_negotiables`, `agent_rules`, `scope_boundaries`, `change_control`. Each directive is one line — no paragraph prose.
- **D-05:** steering.md is the first context item any Terrace agent loads. Token budget for this file is a hard constraint — keep total under 500 tokens in the template.

### terrace init
- **D-06:** `terrace init` installs Terrace's own files only: `.terrace/` directory, `docs/prd/`, `docs/spec/`, `docs/testing/`, governance templates, `project-state.json`. Does not touch, read, or depend on GSD configuration.
- **D-07:** Idempotent — re-running produces the same result. On conflict (file already exists), reports exactly what would be overwritten and requires explicit `--force` to proceed.
- **D-08:** Prints a manifest of every file created or skipped. No silent writes.

### GSD Source Relationship
- **D-09:** GSD-01–07 requirements are documentation of adopted patterns, not runtime integration. Deliver as: a `docs/architecture/GSD-PATTERNS.md` that names each borrowed pattern (file-as-message-bus, workflow-as-orchestrator, CLI-as-structured-write-path, subagent isolation, template-as-file-contract) and explicitly states what Terrace extends vs departs from.
- **D-10:** `terrace-tools.cjs` follows gsd-tools.cjs pattern exactly: Node.js CJS, stdlib only, single file, structured write path for `.terrace/` state files.

### Lifecycle Schema
- **D-11:** `project-state.json` fields for Phase 1: `phase`, `spec_hash`, `active_slice`, `last_session`, `policy_mode`. Machine-readable JSON schema (JSON Schema draft-07) shipped alongside the template.
- **D-12:** `terrace phase set <phase>` validates transitions against a hardcoded legal-transitions table in Phase 1; the table is externalized to a JSON config in a later phase if needed.

### Preset Registry
- **D-13:** `.terrace/presets/registry.json` schema in Phase 1: `{ version, presets: [{ id, name, version, installed_at, conflicts: [] }] }`. Idempotent install — duplicate id = conflict surfaced, not silently overwritten.
- **D-14:** `terrace preset install` in Phase 1 is scaffold-only (register + conflict check). Actual preset capability loading is Phase 2+.

### Security Model
- **D-15:** SEC-01–07 delivered as `.terrace/SECURITY-MODEL.md` — a machine-readable policy doc listing: files Terrace may write, files Terrace may read, files Terrace will never modify, hook conflict detection rules, and explicit failure behavior when a GSD file cannot be safely patched.

### Test Framework
- **D-16:** Vitest for all Terrace unit and integration tests. Dev dependency only — not shipped in the framework itself.
- **D-17:** TDD mandate is non-negotiable: every plan in Phase 1 writes failing tests first. No production code committed without a prior failing test.

### Claude's Discretion
- Exact YAML frontmatter field names for each template (follow REQUIREMENTS.md schema where specified)
- Vitest configuration (coverage thresholds, reporter format)
- File layout within `.terrace/` beyond what REQUIREMENTS.md specifies
- `terrace doctor` output format and remediation message wording
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (authoritative)
- `.planning/REQUIREMENTS.md` — All Phase 1 requirements: TMPL-01–13, VAL-01–05, CLI-07/10/12–15, INST-01–08, GSD-01–07, SEC-01–07, LIFE-01–06, PRST-01–07/12–14, OPS-08–14

### Roadmap (success criteria)
- `.planning/ROADMAP.md` §Phase 1 — 6 success criteria that define phase completion

### Source patterns (reference, not dependency)
- `.planning/research/SOURCE-DONOR-AUDIT.md` — GSD patterns adopted by Terrace, non-cloned system classifications, architecture decisions
- `terrace-research/get-shit-done/` — GSD source for pattern reference (workflows/, bin/, templates/ are highest-yield zones)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield. No existing source to reuse.

### Established Patterns
- GSD's `gsd-tools.cjs` is the direct pattern for `terrace-tools.cjs`: single CJS file, Node stdlib only, structured write path, atomic commits after each write.
- GSD's `~/.claude/agents/*.md` YAML frontmatter format is the pattern for Terrace agent definitions.
- GSD's `templates/` file-contract system is the pattern for Terrace's governance templates.

### Integration Points
- `terrace init` creates `.terrace/` and `docs/` directories — these are the integration points for all subsequent phases.
- `project-state.json` is the machine-readable state file all phases read/write through `terrace-tools.cjs`.
</code_context>

<specifics>
## Specific Ideas

- Templates optimize for machine precision and token efficiency — not human readability. Terse structured directives, YAML frontmatter, no prose.
- steering.md hard budget: under 500 tokens in the template itself.
- `terrace init` is strictly self-contained — no GSD dependency, no GSD file reads or writes.
</specifics>

<deferred>
## Deferred Ideas

- Live GSD integration (wiring Terrace into GSD settings.json, registering skills) — explicitly out of scope. Terrace is standalone.
- Human-readable template documentation — deferred if needed at all; machine precision is the priority.
- policy.json gate enumeration — Phase 1 creates known fields (policy_mode); full gate set defined in Phase 3.

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-05*
