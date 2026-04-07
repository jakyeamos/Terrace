# Phase 0: Bootstrap MVP - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Walking skeleton: minimal governance loop (init → intake → validate → baseline → session) proven end-to-end on four fixture repos. Phase 0 validates the value proposition — it does not build the full product surface.

**Hard dependency:** Phase 0 is the prerequisite for all subsequent phases. Phase 1 treats Phase 0 deliverables as the guaranteed starting state.

</domain>

<decisions>
## Implementation Decisions

### Test Framework
- **D-01:** Vitest from day one — Phase 0's TDD wave (00-01 RED stubs) uses Vitest, same as Phase 1. No test runner migration cost. Phase 0's test suite must remain GREEN throughout Phase 1 execution.

### Fixture Repos
- **D-02:** Minimal viable fixtures — just enough scaffolding to exercise the CLI commands. Not meant to be buildable or runnable projects.
  - `fixtures/ts-monorepo`: package.json + packages/ structure (multi-package workspace skeleton)
  - `fixtures/script-repo`: a few script files, no framework, no test runner
  - `fixtures/no-tests`: src/ directory with source files but no test files
  - `fixtures/gsd-modified`: .claude/ + GSD configuration files to simulate existing GSD setup
- **D-03:** Fixture repos live inside the Terrace repo at `fixtures/`. No git submodules or external repos. Tests reference them by relative path.

### Minimal Intake Scope
- **D-04:** "Minimal intake" in Phase 0 means file scaffold only — no `terrace intake` CLI command. The intake step in the end-to-end loop is creating `docs/prd/PRD.md` from the template (manually or as a side-effect of `terrace init`). The real intake agent is Phase 2. Phase 0 proves the loop exists, not that intake is automated.

### CLI Output Format
- **D-05:** `terrace init` uses plain text line-per-file output in Phase 0:
  - `CREATED .terrace/policy.json`
  - `SKIPPED docs/prd/PRD.md (exists)`
  - Direction: all three output formats (plain text, `--json`, table) should be available by end of development; table output becomes the default eventually. Phase 0 delivers plain text only.
- **D-06:** `terrace spec validate` uses `ERROR:` / `WARN:` prefixes in plain text output to distinguish missing-file errors from malformed-content warnings. Success criteria require the distinction to appear in output (not exit code alone). Non-zero exit for errors, zero for warnings-only.

### What Phase 0 Builds
- **D-07:** Minimal `terrace-tools.cjs` commands: `init`, `validate-source`, `baseline-protect`, `session-start`, `session-end`. Node.js CJS, stdlib only, single file.
- **D-08:** Five source artifact templates only: PRD.md, COMPILED-SPEC.md, TEST-ARCH.md, DECISION-LOG.md, SESSION.md. Templates at "minimal spec" — required sections present, YAML frontmatter, no prose. Phase 1 brings them to full spec.
- **D-09:** Minimal `terrace init`: creates `.terrace/` skeleton and `docs/` directory structure; installs five source templates; prints manifest.
- **D-10:** Minimal `terrace spec validate`: validates presence and required sections of source artifacts only (the five templates). Not full validation — that is Phase 4.
- **D-11:** Minimal `terrace baseline protect <file> --spec-ref <ID>`: writes entry to `baseline-registry.json`, refuses to register without valid spec_ref.
- **D-12:** Minimal `terrace session start` / `terrace session end`: writes and appends SESSION.md. Must record: current phase, active slice, files changed, next steps.

### Claude's Discretion
- Exact YAML frontmatter fields for minimal-spec templates (follow REQUIREMENTS.md schema where specified; minimally: required sections only)
- Vitest configuration (coverage reporter, thresholds — keep minimal in Phase 0)
- Exact content of each fixture repo beyond what's needed to exercise the CLI commands
- Internal structure of `terrace-tools.cjs` (simple switch/case acceptable in Phase 0 — Phase 1 refactors to command registry)
- `.terrace/` skeleton structure beyond what success criteria require

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (authoritative)
- `.planning/REQUIREMENTS.md` — Phase 0 requirements: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-12, TERR-10, TERR-11 (partial), OPS-08, OPS-09, DEV-01–04

### Roadmap (success criteria + phase scope)
- `.planning/ROADMAP.md` §Phase 0 — Goal, fixture repo list, what Phase 0 builds, what it defers, 6 success criteria, 4 plan definitions

### Phase 1 handoff contract (what Phase 0 must deliver)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-01 and D-02 define exactly what Phase 1 expects to inherit from Phase 0; Phase 0 must satisfy this contract

### Source patterns (reference only)
- `terrace-research/get-shit-done/` — GSD source; `bin/gsd-tools.cjs` is the direct pattern for `terrace-tools.cjs`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — Phase 0 is the first phase; all artifacts are created here

### Established Patterns
- `gsd-tools.cjs` (in `terrace-research/get-shit-done/bin/`): single CJS file, Node stdlib only, structured write path — direct pattern for `terrace-tools.cjs`. Phase 0 can start with simple switch/case dispatch; Phase 1 refactors to command registry.
- GSD template format (YAML frontmatter + sections): pattern for Phase 0's five source artifact templates at minimal spec

### Integration Points
- `fixtures/` directory (created in Phase 0): integration test surface for all subsequent phases
- `terrace-tools.cjs`: the single CLI entry point all phases extend
- `.terrace/project-state.json`: machine-readable state file; minimal schema in Phase 0, extended in Phase 1
- `.terrace/baseline-registry.json`: protected baseline store; written by `terrace baseline protect` in Phase 0

</code_context>

<specifics>
## Specific Ideas

- CLI output progression: plain text Phase 0 → plain text + `--json` Phase 1 → table default by end of development. Bake in the `--json` flag awareness from Phase 1 onward even if Phase 0 only ships plain text.
- Phase 0's `terrace init` is strictly self-contained — no GSD dependency, no GSD file reads or writes (consistent with D-11 from Phase 1 context).
- The end-to-end loop in 00-04 is: `terrace init` → PRD.md manually created → `terrace spec validate` → `terrace baseline protect` → `terrace session start` → `terrace session end`. No automated intake command.

</specifics>

<deferred>
## Deferred Ideas

- `terrace intake` CLI command — Phase 2 scope (full intake agent with interrogation rounds)
- Table output as default for all commands — later in development process; Phase 0 ships plain text
- `--json` flag support — Phase 1 (CLI-12 requirement; not Phase 0)
- Full `terrace spec validate` (all 13 artifacts) — Phase 4 scope
- Doctor, preset, steering, phase-set CLI commands — Phase 1 scope
- Pre-commit hook — Phase 3 scope

</deferred>

---

*Phase: 00-bootstrap-mvp*
*Context gathered: 2026-04-06*
