# Complexity + Simplification Backfill: Terrace

Framework impact note: Terrace is the framework underlying the GSD skill/plan/phase system. Complexity hotspots here affect all agent workflows that run through it. Remediations require tests before any fix.

Date of audit: 2026-06-23

Gate source: `/Users/jakyeamos/AIOS/docs/quality/complexity-simplification-gate.md`

## Scope Reviewed

- `package.json`
- `packages/terrace-core/src/workflow.cjs`
- `packages/terrace-core/src/lifecycle.cjs`
- `packages/terrace-core/src/repo-analysis.cjs`
- `packages/terrace-core/src/agents.cjs`
- `scripts/terrace-corpus-eval.cjs`
- `src/terrace-tools.cjs`
- `tests/workflow-commands.test.ts`
- Largest-file inventory across `src/`, `packages/`, `scripts/`, and `tests/`

## Commands Attempted

- `pnpm lint`: passed. Output summary: `Checked 2180 text files.`
- `pnpm typecheck`: passed. Output summary: `tsc --noEmit`.
- `pnpm test`: passed. Output summary: 37 test files passed, 1 skipped; 282 tests passed, 1 skipped. The test run emitted npm package notices while exercising package/corpus paths.

## Complexity Hotspots

### P0: Workflow orchestration is concentrated in one large module

- File: `packages/terrace-core/src/workflow.cjs`
- Evidence: the file is 1,892 lines and owns phase lookup, migrated context extraction, plan rendering, execution queue construction, senior-cycle gates, command discovery, feature artifacts, ship checks, autonomous workflow, and phase completion.
- Pattern: Central orchestration module with many workflow responsibilities.
- Risk: Because this module drives phase/plan/skill execution, regressions affect every downstream Terrace/GSD workflow.
- Suggested direction: Extract command discovery, senior-cycle artifact gating, and phase/quick-task queue construction behind pure helpers with existing workflow tests preserved.

### P0: Lifecycle ship/report checks aggregate many state domains in one module

- File: `packages/terrace-core/src/lifecycle.cjs`
- Evidence: the file is 1,831 lines and includes report card generation, artifact inspection, debt, preflight, documentation, test-eval, AI-review, rule-audit, waiver, and ship-check logic.
- Pattern: Release/readiness aggregation with many independent state domains.
- Risk: Ship readiness can become hard to reason about when new gates are added because scoring, blockers, warnings, docs, and state writes share one surface.
- Suggested direction: Split domain collectors from report rendering and ship-check composition, then keep a thin public lifecycle API.

### P0: Corpus evaluator performs nested repo/track/command execution and cleanup

- File: `scripts/terrace-corpus-eval.cjs`
- Evidence: `runEvaluation` loops real repos and tracks, then synthetic repos, preparing worktrees and running every track command; `runTrack` loops command plans and follow-up records; `summarize` repeatedly groups, filters, sorts, and slices records.
- Pattern: Multi-dimensional evaluation loop with filesystem, git worktree, npm install, execution, scoring, and reporting responsibilities.
- Risk: Corpus evaluation is the feedback loop for framework quality. Failures or scaling issues here can hide product regressions or make framework evaluation too costly to run.
- Suggested direction: Extract execution planning, record collection, scoring summary, and cleanup into separate testable helpers before expanding corpus coverage.

## Simplification Hotspots

### P1: Repository analysis repeatedly scans broad file inventories

- File: `packages/terrace-core/src/repo-analysis.cjs`
- Evidence: `listProjectFiles` glob-scans up to 5,000 files; `analyzeRepository` derives source/test/docs/config/migration lists, route/component hints, imports, and lane grouping from that file list.
- Pattern: Broad repository inventory plus multiple derived filters in one analysis pass.
- Risk: Acceptable today, but repeated calls from workflow/lifecycle commands can duplicate repo-wide scans and filtering.
- Suggested direction: Cache a single analysis result per command invocation and pass it into downstream artifact writers instead of recomputing.

### P1: Agent asset generation mixes templates, counts, and global writes

- File: `packages/terrace-core/src/agents.cjs`
- Evidence: the module builds workflow assets, global Codex/Claude assets, status counts, and writes template assets to multiple agent directories.
- Pattern: Template generation and filesystem installation in one module.
- Risk: Medium; this touches the always-loaded agent-file surface and must preserve thin pointer semantics.
- Suggested direction: Separate pure asset manifests from install/write operations, and require placement rationale for any always-loaded file change.

### P2: CLI entrypoint remains broad

- File: `src/terrace-tools.cjs`
- Evidence: the file is 1,149 lines and routes many Terrace commands, flags, JSON output behavior, and command-specific argument handling.
- Pattern: Large command router.
- Risk: Lower than workflow/lifecycle internals because it mostly dispatches, but command additions can continue to accumulate.
- Suggested direction: Keep the entrypoint thin by routing command groups to modules as workflow/lifecycle extractions land.

## Test Gaps Blocking Safe Cleanup

- Terrace has good broad test coverage for current behavior, but extraction should add focused tests around pure helpers rather than only relying on CLI/workflow integration tests.
- Add tests for workflow queue construction, senior-cycle artifact gating, lifecycle domain collectors, and corpus summary grouping before moving logic out of large modules.
- Corpus evaluator changes should include fixtures for multiple repos, tracks, follow-up records, skipped records, and cleanup behavior.

## Suggested Remediation Order

- P0: Add focused workflow queue and senior-cycle gate tests, then extract pure helpers from `workflow.cjs`.
- P0: Add lifecycle collector fixtures, then split domain collection from report/ship rendering in `lifecycle.cjs`.
- P0: Add corpus evaluator fixtures around repo/track/command records, then split execution planning and summary grouping.
- P1: Cache or pass repository analysis results within one command invocation.
- P1: Separate agent asset manifests from filesystem writes while preserving thin always-loaded pointers.
- P2: Reduce `src/terrace-tools.cjs` only after module extractions create stable command-group APIs.

## Definition of Done

- `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass after each cleanup slice.
- Any P0 remediation has focused tests before implementation and preserves public CLI output contracts.
- Agent asset changes explicitly decide whether content belongs in always-loaded files or intent-specific TMCP/skill pointers.
- Corpus evaluator changes preserve evidence output paths and cleanup behavior.
