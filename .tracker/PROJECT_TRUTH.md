---
schemaVersion: 1
projectName: Terrace
summary: Spec-driven AI development framework in active Phase 0 scaffold — toolkit compiles, 88 tests pass, but no phases are completed and implementation is pre-MVP.
healthScore: 62
statusLabel: needs_attention
nextStep: Execute Phase 0 plans to prove the governance loop end-to-end on the four fixture repos.
blockers: []
lastUpdated: 2026-04-09
tags: [framework, ai-tooling, governance, spec-driven]
areas: [cli, validation, lifecycle, presets, templates]
goals:
  - Prove core governance loop end-to-end (Phase 0)
  - Build full CLI scaffold and install infrastructure (Phase 1)
  - Deliver automated effort routing with usage intelligence
repoType: library
sourceOfTruth: inferred
primaryLanguage: TypeScript
activeBranch: main
lastCommitDate: "2026-04-08"
quality:
  lint: unknown
  types: unknown
  tests: pass
  deadCode: unknown
  structure: pass
canonicalCommands:
  install: npm install
  dev: unknown
  lint: unknown
  typecheck: unknown
  test: npm test
  deadcode: unknown
agentExpectationsVersion: 1
---

## Current State

Phase 0 of 6 scaffold is complete but execution has not started. The toolkit (`terrace-tools.cjs`) exists with implementations for core, doctor, init, lifecycle, preset, and validate modules. 88 tests pass across 8 test files. Two JSON schemas (project-state, preset-registry) are in place. Planning directory is populated with phases, roadmap, requirements, and research. Progress counter reads 0 completed phases / 0 completed plans.

No lint or typecheck commands are wired in `package.json`. The project depends on a sibling `eslint-plugin-anti-slop` package via file reference — that plugin must exist at `../eslint-plugin-anti-slop` for install to succeed.

## Why This Matters / Intended Outcome

Terrace is the governance backbone for AI-assisted development across projects. It should automatically route work to the cheapest safe effort level, enforce spec-test alignment, and prevent silent drift. Until Phase 0 is complete, none of those guarantees exist anywhere.

## Recent Progress

- April 8: Added anti-slop ESLint system design spec and bootstrap execution summaries
- April 7–8: Scaffolded validation toolkit, fixtures, templates, schemas
- Extensive planning (phases 0–6, roadmap, requirements, state machine) documented in `.planning/`
- 88 tests written and passing before any phase execution — test-first baseline established

## Open Problems

- `package.json` has no `lint` or `typecheck` script — quality ladder is partially broken
- 0% plan execution: all phases are planned but none started
- `eslint-plugin-anti-slop` is a file-local dependency from a sibling directory — fragile, undocumented as a prerequisite
- `package-lock.json` and `package.json` show uncommitted modifications (working tree dirty)
- Terrace-research submodule directories have mode changes pending

## Next Concrete Steps

1. Add `lint` and `typecheck` scripts to `package.json` (closes quality ladder gap)
2. Commit working tree changes (package.json, package-lock.json, submodule mode fixes)
3. Execute Phase 0 plans — prove the governance loop on the four fixture repos in `fixtures/`
4. Record Phase 0 completion in `.planning/STATE.md`

## Risks / Blockers

- Sibling dependency (`eslint-plugin-anti-slop`) creates install-order coupling — a fresh clone will fail without it
- Heavy planning investment without execution creates risk of plan-reality drift if implementation reveals design flaws
- No typecheck command means TypeScript errors are not surfaced at the quality gate

## Quality Ladder Notes

- **Lint:** no script configured — cannot run
- **Types:** no typecheck script configured — cannot run
- **Tests:** `npm test` → 88 passed, 0 failed (vitest, 685ms) — PASS
- **Dead code:** not configured
- **Structure:** src and tests properly organized, schemas present — PASS

## Agent Notes

- CLAUDE.md and AGENTS.md are present and refer to GitNexus indexing (46,723 symbols). Run `npx gitnexus analyze` if index is stale before modifying any symbol.
- Quality ladder commands from global CLAUDE.md: `pnpm lint` / `pnpm tsc --noEmit` / `pnpm test` — but this project uses `npm` not `pnpm`. Verify before running.
- `.planning/` follows GSD structure. Use gsd-* skills for phase execution.
