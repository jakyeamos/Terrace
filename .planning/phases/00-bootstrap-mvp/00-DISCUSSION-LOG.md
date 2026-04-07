# Phase 0: Bootstrap MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 00-bootstrap-mvp
**Areas discussed:** Test runner for Phase 0 TDD, Fixture repo scaffolding depth, Minimal intake workflow scope, CLI output format contract

---

## Test Runner for Phase 0 TDD

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest from day one | Same runner as Phase 1 — no migration cost, TDD consistent across all phases | ✓ |
| Node native test runner | No dev dependencies in Phase 0 — keeps Phase 0 truly minimal; Phase 1 converts tests | |

**User's choice:** Vitest from day one
**Notes:** No migration cost; Phase 0 test suite stays GREEN in Phase 1 without runner change.

---

## Fixture Repo Scaffolding Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal viable fixtures | Just enough to exercise CLI commands — not buildable/runnable projects | ✓ |
| Realistic source repos | Actual compilable/runnable code in each fixture — more meaningful but much more work | |

**User's choice:** Minimal viable fixtures

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Terrace repo at fixtures/ | Tests reference by relative path; no submodules | ✓ |
| Separate git repos | More realistic clone simulation but external dependency management | |

**User's choice:** Inside Terrace repo at `fixtures/`
**Notes:** TERR-10 says "fixture repos exist" — doesn't require separate git repos.

---

## Minimal Intake Workflow Scope

| Option | Description | Selected |
|--------|-------------|----------|
| File scaffold only — no CLI command | PRD.md creation is manual or via init; no terrace intake command | ✓ |
| Minimal terrace intake CLI command | Real subcommand that copies PRD template; validates command exists | |

**User's choice:** File scaffold only — no CLI command
**Notes:** Phase 0 proves the loop exists, not that intake is automated. `terrace intake` is Phase 2 scope.

---

## CLI Output Format Contract

### terrace init manifest

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text line-per-file | 'CREATED file', 'SKIPPED file (exists)' | ✓ |
| JSON manifest (--json flag) | Default plain text + --json flag for structured output | |
| Structured table output | Tabular format with status/path/action columns | |

**User's choice:** Plain text for Phase 0; all three formats (plain text, --json, table) available by end of development; table output default eventually.
**Notes:** Phase 0 ships plain text only. Flag awareness can be added progressively.

### terrace spec validate output

| Option | Description | Selected |
|--------|-------------|----------|
| Prefixed plain text: ERROR / WARN | 'ERROR: file missing' / 'WARN: field missing' | ✓ |
| Exit code only — no text distinction | Non-zero exit for errors, zero for warnings | |

**User's choice:** ERROR / WARN prefixes in plain text
**Notes:** Success criteria explicitly require distinguishing in output, not just exit code.

---

## Claude's Discretion

- Exact YAML frontmatter fields for minimal-spec templates
- Vitest configuration details
- Exact fixture repo content beyond CLI exercise requirements
- Internal `terrace-tools.cjs` dispatch pattern (simple switch/case acceptable)
- `.terrace/` skeleton structure beyond success criteria requirements

## Deferred Ideas

- `terrace intake` CLI command → Phase 2
- Table output as default → later in development
- `--json` flag → Phase 1 (CLI-12)
- Full spec validate (all 13 artifacts) → Phase 4
- Doctor, preset, steering, phase-set → Phase 1
- Pre-commit hook → Phase 3
