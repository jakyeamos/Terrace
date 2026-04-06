# Phase 1: Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The full installable skeleton exists on top of Phase 0's proven walking skeleton — all 13 governance artifact templates at full Phase 1 spec, the complete CLI scaffold, the preset registry infrastructure, the lifecycle schema with transition validation, the GSD modification policy documented, the security trust model documented, and `terrace init` completes cleanly (full re-init with manifest diff) on all four Phase 0 fixture repos.

**Hard dependency:** Phase 1 cannot begin until Phase 0 plans are created and Phase 0 execution completes. Phase 0 is the prerequisite — its deliverables are the starting state for all Phase 1 plans.

</domain>

<decisions>
## Implementation Decisions

### Phase 0 Handoff Contract
- **D-01:** Phase 1 plans treat Phase 0 roadmap deliverables as the guaranteed starting state. On disk at Phase 1 start: minimal `terrace-tools.cjs` (init, validate-source, baseline-protect, session-start, session-end), five source artifact templates (PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md), minimal `terrace init` creating `.terrace/` and `docs/` dirs, and all four fixture repos already initialized.
- **D-02:** Phase 1's 01-01 (RED test stubs) covers only net-new Phase 1 requirements — not Phase 0 requirements already tested. Phase 0's test suite must remain GREEN throughout Phase 1 execution.

### Governance Artifact Templates
- **D-03:** Plan 01-02 brings all 13 templates to full Phase 1 spec — including updating the 5 source templates Phase 0 built at minimal spec. All 13 receive equal treatment: complete YAML frontmatter, all defined sections, agent hints as comments or metadata.
- **D-04:** All templates use machine-precision format — terse structured directives, YAML frontmatter for machine-readable metadata, field-level annotations in agent-readable format (e.g., `spec_ref: SPEC-XX`). No prose explanations. Optimize for token efficiency.
- **D-05:** The 13 templates: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md, INVARIANTS.md, ACCEPTANCE-CRITERIA.md, PERMISSIONS-MATRIX.md, EDGE-CASES.md, STATE-MACHINES.md, REGRESSIONS.md, project-state.json, steering.md.

### steering.md
- **D-06:** YAML frontmatter (version, project, phase, policy_mode) + terse structured directive sections: `intent`, `non_negotiables`, `agent_rules`, `scope_boundaries`, `change_control`. Each directive is one line — no paragraph prose.
- **D-07:** steering.md is the first context item any Terrace agent loads. Hard token budget: under 500 tokens in the template.

### terrace init
- **D-08:** Full re-init with manifest diff — re-runs the full install, reports what would change for existing files, requires `--force` to overwrite existing files. When run on a Phase 0 fixture repo, existing 5 source templates are updated to full Phase 1 spec on `--force`; without `--force`, reports what would be overwritten and skips.
- **D-09:** Idempotent without `--force` — re-running without the flag reports conflicts and skips. No silent writes.
- **D-10:** Prints a manifest of every file created, updated, or skipped. MET-ERG-01 (< 30 seconds cold-start) applies.
- **D-11:** Does not touch, read, or depend on GSD configuration. `terrace init` installs Terrace's own files only.

### terrace-tools.cjs Extension
- **D-12:** Plan 01-03 refactors Phase 0's minimal `terrace-tools.cjs` into a command registry pattern before adding Phase 1 commands. A central commands map where each command is a named handler function — easier to add, test, and read as the command surface grows across phases.
- **D-13:** After refactor, Phase 1 adds: `doctor`, `preset install`, `steering`, `phase set`, full `spec validate` (all 13 artifacts), extended `init`. Node.js CJS, stdlib only, single file — same constraints as Phase 0.

### GSD Source Relationship
- **D-14:** GSD-01–07 requirements delivered as `docs/architecture/GSD-PATTERNS.md` — names each borrowed pattern (file-as-message-bus, workflow-as-orchestrator, CLI-as-structured-write-path, subagent isolation, template-as-file-contract) and explicitly states what Terrace extends vs departs from.

### Lifecycle Schema
- **D-15:** `project-state.json` Phase 1 fields: `phase`, `spec_hash`, `active_slice`, `last_session`, `policy_mode`. JSON Schema draft-07 shipped alongside the template.
- **D-16:** `terrace phase set <phase>` validates transitions against a hardcoded legal-transitions table; table externalized to JSON config in a later phase if needed.

### Preset Registry
- **D-17:** `.terrace/presets/registry.json` schema: `{ version, presets: [{ id, name, version, installed_at, conflicts: [] }] }`. Idempotent install — duplicate id = conflict surfaced, not silently overwritten.
- **D-18:** `terrace preset install` in Phase 1 is scaffold-only (register + conflict check). Actual preset capability loading is Phase 2+.

### Security Model
- **D-19:** SEC-01–07 delivered as `.terrace/SECURITY-MODEL.md` — machine-readable policy doc listing: files Terrace may write, files Terrace may read, files Terrace will never modify, hook conflict detection rules, and explicit failure behavior when a GSD file cannot be safely patched.

### Test Framework
- **D-20:** Vitest for all Terrace unit and integration tests. Dev dependency only — not shipped in the framework itself.
- **D-21:** TDD mandate is non-negotiable: every plan in Phase 1 writes failing tests first. No production code committed without a prior failing test. Phase 0's test suite stays GREEN throughout.

### Claude's Discretion
- Exact YAML frontmatter field names for each template (follow REQUIREMENTS.md schema where specified)
- Vitest configuration (coverage thresholds, reporter format)
- File layout within `.terrace/` beyond what REQUIREMENTS.md specifies
- `terrace doctor` output format and remediation message wording
- Command registry implementation details within the single-file constraint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (authoritative)
- `.planning/REQUIREMENTS.md` — All Phase 1 requirements: TMPL-01–13, VAL-01–05, CLI-07/10/12–15, INST-01–08, GSD-01–07, SEC-01–07, LIFE-01–06, PRST-01–07/12–14, OPS-08–14

### Roadmap (success criteria + Phase 0 handoff contract)
- `.planning/ROADMAP.md` §Phase 0 — What Phase 0 delivers (the starting state for Phase 1)
- `.planning/ROADMAP.md` §Phase 1 — 6 success criteria that define Phase 1 completion

### Source patterns (reference, not dependency)
- `.planning/research/SOURCE-DONOR-AUDIT.md` — GSD patterns adopted by Terrace, non-cloned system classifications, architecture decisions
- `terrace-research/get-shit-done/` — GSD source for pattern reference (workflows/, bin/, templates/ are highest-yield zones)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 0)
- `terrace-tools.cjs` (Phase 0 minimal): init, validate-source, baseline-protect, session-start, session-end — Phase 1's 01-03 refactors this into command registry pattern, then extends with Phase 1 commands
- Five source templates already on disk at minimal spec — Phase 1's 01-02 updates them to full Phase 1 spec alongside adding 8 derived templates
- `.terrace/` directory structure and `docs/` directory structure — already created by Phase 0 init on all four fixture repos

### Established Patterns
- GSD's `gsd-tools.cjs` is the direct pattern for `terrace-tools.cjs`: single CJS file, Node stdlib only, structured write path. Phase 1 adopts the command registry pattern as the internal structure.
- GSD's `~/.claude/agents/*.md` YAML frontmatter format is the pattern for Terrace agent definitions.
- GSD's `templates/` file-contract system is the pattern for Terrace's governance templates.

### Integration Points
- Phase 0 fixture repos (ts-monorepo, script-repo, no-tests, gsd-modified) are the integration test surface for Phase 1's full `terrace init` — Phase 1's success criteria require clean completion on all four.
- `project-state.json` is the machine-readable state file all phases read/write through `terrace-tools.cjs`.
- Phase 0's test suite is a hard constraint — Phase 1 execution must not break it.

</code_context>

<specifics>
## Specific Ideas

- Templates optimize for machine precision and token efficiency — not human readability. Terse structured directives, YAML frontmatter, no prose.
- steering.md hard budget: under 500 tokens in the template itself.
- `terrace init` is strictly self-contained — no GSD dependency, no GSD file reads or writes.
- Command registry refactor in 01-03 is an explicit restructuring step, not an inline extension — clean the foundation before adding Phase 1 commands.
- Full re-init with manifest diff: `terrace init` on a Phase 0 fixture repo reports exactly what would change, requires `--force` to overwrite, and updates existing 5 source templates to full Phase 1 spec when `--force` is used.

</specifics>

<deferred>
## Deferred Ideas

- Live GSD integration (wiring Terrace into GSD settings.json, registering skills) — explicitly out of scope. Terrace is standalone.
- Human-readable template documentation — deferred if needed at all; machine precision is the priority.
- policy.json gate enumeration — Phase 1 creates known fields (policy_mode); full gate set defined in Phase 3.
- `audit` and `decision-log` CLI commands — Phase 4 scope per roadmap; Phase 1 only scaffolds the CLI surface up to what Phase 1 success criteria require.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-06*
