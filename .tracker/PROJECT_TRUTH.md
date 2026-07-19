---
schemaVersion: 1
projectName: Terrace
summary: Terrace 0.2.0 is a pnpm-first release candidate with trusted publishing, GSD-compatible phase routing, production workbench commands, and opt-in Quality Runner delivery contracts for planning, preflight, evidence reconciliation, and completion gates.
healthScore: 100
statusLabel: tier_one_ready
nextStep: Keep the local workflow entrypoint and release-readiness guard in regular use before protected work ships.
blockers: []
lastUpdated: 2026-07-19
tags: [framework, ai-tooling, governance, spec-driven, cli]
areas: [cli, validation, lifecycle, presets, templates, packaging, ci, docs]
goals:
  - Keep Terrace publishable and recoverable from repo state
  - Prove governance workflows through packed CLI fixture tests
  - Expand migration and rule contracts without weakening hard gates
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: TypeScript
activeBranch: codex/terrace-adoption-measure
lastCommitDate: "2026-07-19"
quality:
  lint: pass
  types: pass
  tests: pass
  coverage: pass
  package: pass
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: pass
canonicalCommands:
  install: pnpm install
  dev: unknown
  lint: pnpm run lint
  typecheck: pnpm run typecheck
  test: pnpm test
  coverage: pnpm run test:coverage
  package: pnpm package
  ci: pnpm run ci
  audit: pnpm audit --audit-level moderate
  deadcode: unknown
agentExpectationsVersion: 2
lastVerifiedCommand: pnpm exec vitest run tests/quality-runner-contract.test.ts --reporter=dot
lastVerifiedAt: "2026-07-19T01:25:36-04:00"
---

## Current State

Terrace now installs default non-overwriting agent integration assets during `terrace init`. Fresh init writes `AGENTS.md` for Codex, `CLAUDE.md` for Claude Code, Codex repo skills under `.agents/skills/terrace-*`, Claude project skills under `.claude/skills/terrace-*`, Claude project commands under `.claude/commands/terrace-*`, and `.terrace/agents/manifest.json` to record written, unchanged, and skipped assets. Existing user-owned agent files are preserved and reported as skipped, while repeated init reports unchanged generated assets. The generated command assets now mirror the README command-reference surface with 79 Codex skills and 79 Claude command files, including `/terrace-next`, `/terrace-align`, `/terrace-phase-plan`, `/terrace-quick-plan`, `/terrace-ship-check`, `/terrace-execute-phase-complete`, `/terrace-corpus-run`, `/terrace-corpus-report`, `/terrace-adoption-status`, `/terrace-release-preflight`, `/terrace-report`, `/terrace-security-check`, `/terrace-workbench-status`, and `/terrace-workbench-prepare`. The `terrace-autonomous` generated skill now carries a GSD-style autonomous workflow contract with JSON-first command execution, explicit implementation/verification loop guidance, allowed tools metadata, and stop conditions for blockers, human judgment, release readiness, and failed verification.

Terrace now also has a repo-local Codex skill artifact under `skills/terrace/`, documenting the `@jakyeamos33/terrace@0.2.0` CLI/core surface, command workflows, public import boundary, safety rules, and release-candidate validation commands for future agent use.

Terrace now has an opt-in Quality Runner delivery-contract adapter. When
`quality_runner.enabled` is true, phase planning prepares one balanced contract,
execution preflights saved plans without a rescan, and validation reconciles one
structured result per phase or batch before review and completion. The default is
disabled with an external QR cache; npm/QR-pnpm command conflicts are surfaced.

_(5 older entries trimmed)_

The first agent bootstrap version missed command discovery because it generated Claude skills without `name` frontmatter, did not generate `.claude/commands/*.md`, and did not generate Codex repo skills under `.agents/skills`. The second pass only exposed a small shortcut set; the current fix branch expands generation to all stable README commands and adds matching repo-local Terrace command assets so Codex and Claude can discover them after reload.

The approved design spec and implementation plan remain at `docs/superpowers/specs/2026-05-05-agent-slash-command-integration-design.md` and `docs/superpowers/plans/2026-05-05-agent-init-integration.md`.

Terrace is prepared as the `@jakyeamos33/terrace@0.2.0` release candidate. The package identity is scoped as `@jakyeamos33/terrace` to match npm ownership and prevent name collisions, while the CLI binary remains `terrace` so local/global workflows stay unchanged. The latest release includes GSD replacement readiness, pnpm-first command rendering, migrated-GSD agent and phase readiness, production workbench commands, refreshed agent assets, MIT license metadata, public npm publish configuration, and GitHub trusted publishing automation. Publishing is intentionally routed through the GitHub Release workflow with OIDC and the `npm` environment; local registry auth secrets are not part of the 0.2.0 release path. `terrace ship check` now includes a `trusted_publishing` category for the Terrace npm release candidate, verifying repo-owned trusted-publishing prerequisites and surfacing the npm/GitHub admin confirmations that remain manual. `terrace release-preflight` summarizes the CI, audit, package, release dry-run, and ship-check flow with trusted-publishing prerequisites, tag/version alignment, and stale npm-era release artifact findings in one JSON result.

The latest hardening pass records release evidence for security, test-suite evaluation, rule audit, and the Tier One report card. `terrace security check` now avoids self-referential generated-artifact findings, ignores generated corpus-run evidence, honors explicit GitHub Actions permissions, audits production dependencies with the detected package manager, and records dependency audit metadata in security evidence.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <intent>`, `terrace autonomous`, `terrace execute-phase-complete <id>`, `terrace settings effort <fast|standard|thorough>`, `terrace settings show`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, `terrace ship prepare`, and `terrace release-preflight`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

`terrace adoption status` now answers the practical GSD replacement question directly. Its JSON and human output lead with the `Can Terrace replace GSD for me yet?` verdict, `recommended_mode`, workflow evidence, readiness summary, blockers, structured next steps, and concrete next commands while preserving the existing read-only checks.

Terrace now also has Senior Cycle commands: `terrace align <feature>`, `terrace interrogate <feature>`, `terrace map-codebase`, `terrace design <feature>`, `terrace test-plan <feature>`, `terrace observe <feature>`, `terrace validate-prod <feature>`, `terrace cleanup <feature>`, `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>`. These generators now infer source areas, architecture hints, test strategy, workstream lanes, route/component hints, unresolved evidence, and concrete affected files from the repo instead of blank TODO placeholders.

Terrace now has a production workbench layer above GSD parity: `terrace workbench status [--feature <id>]` is read-only and aggregates feature tier, missing senior-cycle gates, preflight, documentation, release AI review, workstreams, feature debt, security evidence, test evaluation, and report-card claim scope. `terrace workbench prepare <feature> [--tier small|medium|large] [--for codex|claude|generic]` activates the feature and refreshes production evidence through existing Terrace primitives: preflight, runbook docs, release AI review, workstreams, and an optional agent handoff pack.

Terrace now also supports PRD-first intake: `terrace new-project` preserves a source PRD, creates compiled spec, acceptance criteria, test plan, and initialization summary artifacts, and records intake state; `terrace prd import` does the same for later feature PRDs under `docs/terrace/features/<feature>/`.

The latest adoption-risk mitigation pass adds `terrace ship check --fast|--local|--full` modes with per-category timings, `terrace report ceremony` for artifact-count and low-density evidence checks, `terrace port gsd --compare` and `--verify-parity` for migration confidence, `terrace rule audit --effectiveness` for rule maturity/metadata coverage, and `terrace waive <gate>` for explicit reviewed temporary overrides that remain visible in report and ship output.

Shadow test branch refs named `codex/terrace-shadow-test` were created in every detected GSD-initiated project with a valid `HEAD`. `/Users/jakyeamos/projects/eslint-plugin-anti-slop` could not receive the branch because it has no valid `HEAD`. The branch creation report is recorded at `docs/terrace/shadow-branches/2026-04-29-GSD-BRANCHES.md`.

The core remains CommonJS at runtime. TypeScript is used for tests/config and typechecks with `moduleResolution: Bundler`.

## Recent Progress
- July 19: Added opt-in Quality Runner delivery contracts to Terrace; focused lifecycle coverage passed and the adapter was committed as `408082f`.
- July 13: Added the source-backed `skills/terrace` Codex skill artifact for the Terrace 0.2.0 CLI/core surface; `pnpm run lint`, `pnpm run secret:scan`, and `pnpm exec terrace --version` passed.
- July 4: Ran `terrace port gsd --import-roadmap` against Terrace itself, importing 9 executable roadmap phases into `.terrace/state.json`; refreshed the active global `terrace` binary to 0.2.0 via pnpm in the nvm global prefix; `terrace adoption status` now reports `replace_gsd`, 100/100, ready true, with zero blockers.
- July 4: Hardened `terrace release-preflight` so an expected release tag that exists away from `HEAD` blocks with `RELEASE_TAG_NOT_AT_HEAD`; removed the stale local-only `v0.2.0` tag so the reviewed release tag can be created at the current release-prepared commit.
- July 4: Prepared the 0.2.0 release scope for the GSD replacement milestone by updating release notes/checklist evidence; clean-tree `terrace release-preflight --target-version 0.2.0 --json` passed after allowing registry access for the embedded `pnpm audit` step.
- July 4: Added merge-safe `terrace port gsd --import-roadmap`, exposed it through CLI help, command contracts, generated Codex/Claude assets, README guidance, and adoption-status next commands; focused GSD migration/CLI/adoption/product-readiness tests plus typecheck and lint passed.
- July 4: Dogfooded `terrace adoption status` locally, corrected GSD roadmap parsing so subsection headings no longer inflate phase evidence, and made adoption readiness separate 8 legacy `.planning` phase concepts from 0 executable `.terrace/state.json` phase targets; current objective replacement measure is 75/100, `pilot_with_gsd_fallback`, blocked by stale global `terrace` 0.1.1 and missing executable roadmap state.
- July 4: Clarified README install guidance so npm `latest` remains documented as `0.1.1` while local `0.2.0` commands are treated as release-candidate verification until publication; `pnpm run ci` passed.
- July 4: Added a deterministic `trusted_publishing` category to `terrace ship check` for `@jakyeamos33/terrace@0.2.0`, reusing release-preflight's trusted-publishing verifier, surfacing manual npm/GitHub admin confirmations, and updating release docs plus focused readiness regressions.
- July 3: Hardened `terrace agents install-global` by expanding generated global assets to the missing help-surface commands, advertising the remaining GSD-compatible phase aliases in CLI help, and strengthening the packed-consumer smoke to verify every expected Codex skill, Claude skill, Claude slash command, and manifest entry from a fresh consumer setup.
- July 3: Added `terrace release-preflight` for the 0.2.0 release candidate, combining the current CI/audit/package/release-dry-run/ship-check flow with trusted-publishing prerequisites, tag/version checks, and stale npm-era release artifact detection in a single JSON summary.
- July 3: Fixed pnpm forwarded test-file arguments by routing `pnpm test` through a small Vitest runner that strips pnpm's script separator before invoking Vitest, and added a focused-run regression proving `pnpm test -- <file>` no longer falls back to the full suite.
- June 30: Added read-only `terrace adoption status` for GSD replacement readiness, routed natural-language replacement/parity questions through `terrace do`, and added report-card claim scope so baseline governance health no longer overclaims full Tier One delivery readiness.
- July 2: Upgraded `terrace adoption status` to answer whether Terrace can replace GSD yet with direct readiness modes, operational workflow evidence, human CLI output, and actionable next commands.

## Open Problems

- Feature tier selection still defaults to medium unless a feature records an explicit tier.
- The corpus expected-blocker watchlist still contains intentional blockers, but they now include self-serve next-command guidance and are separated from product weaknesses in the report.
- Dead-code scanning is not configured.
- The npm package trusted-publishing connection must exist for the GitHub repository, `release-publish.yml` workflow, and `npm` environment before the GitHub Release is created.

## Quality Ladder Notes

- **Lint:** `pnpm lint` PASS, checking 4023 audited text files for CRLF and `.cjs` files for syntax/trailing whitespace
- **Types:** `pnpm typecheck` PASS
- **Focused corpus/blocker tests:** `pnpm exec vitest run tests/corpus-eval.test.ts tests/expected-blocker-ergonomics.test.ts tests/implemented-placeholder-commands.test.ts --reporter=verbose` PASS, 3 files and 20 tests
- **Tests:** `pnpm test -- tests/planning-refresh.test.ts tests/core-cli.test.ts tests/core-port-gsd.test.ts` PASS, 38 files and 283 tests because the repo script currently runs the full Vitest suite despite the forwarded file arguments
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds: lines 86.21%, statements 85.74%, functions 88.76%, branches 70.86%
- **Package:** `npm run package:dry-run` PASS for `@jakyeamos33/terrace@0.1.2`, including `packages/terrace-core/src/agents.cjs`; packed-consumer e2e PASS in the full suite
- **Release portability:** `npm run package:dry-run` PASS with the portable npm cache default; corrected packed-install smoke PASS from a fresh temp consumer project
- **Audit:** `npm audit --audit-level=moderate` PASS, zero vulnerabilities
- **CI:** `npm --cache /private/tmp/terrace-npm-cache run ci` PASS
- **Security:** `./src/terrace-tools.cjs security check --json` PASS, zero findings, zero blockers, and zero warnings
- **Test evaluation:** `node src/terrace-tools.cjs test eval --json` PASS, trust score 100
- **Rule audit:** `node src/terrace-tools.cjs rule audit --json` PASS, zero blockers and zero warnings
- **Report:** `terrace report --json` PASS, score 100, status `tier_one_ready`
- **Ship:** `terrace ship check --json` PASS, zero blockers and zero warnings
- **Focused adoption-risk tests:** `npm test -- tests/lifecycle-coverage.test.ts tests/core-port-gsd-migration.test.ts tests/workflow-commands.test.ts tests/core-cli.test.ts` PASS; final focused rerun for GSD compare and ship modes PASS
- **CLI-heavy timeout hardening tests:** `npm test -- tests/agent-production-lifecycle.test.ts tests/agent-production-lifecycle-full.test.ts tests/implemented-placeholder-commands.test.ts tests/product-readiness.test.ts tests/workflow-commands.test.ts tests/core-cli.test.ts` PASS, 50 tests
- **Final full ship check:** `node src/terrace-tools.cjs ship check --json` PASS in full mode, zero blockers and zero warnings
- **PRD intake focused tests:** `npx vitest run tests/prd-intake.test.ts tests/core-cli.test.ts --reporter=verbose` PASS, 15 tests
- **PRD intake smoke:** local temp-repo smoke PASS for `terrace new-project sample --paste-prd --json` and `terrace prd import saved-search --file feature-prd.md --json`
- **Agent init focused tests:** `npm test -- tests/core-init.test.ts tests/init.test.ts tests/json-mode.test.ts -- --runInBand` PASS, 18 tests
- **Focused phase routing tests:** `npm test -- tests/workflow-commands.test.ts tests/core-init.test.ts tests/json-mode.test.ts` PASS, 36 tests
- **Agent command discovery fix:** `npm test` PASS, 36 files and 269 tests; `npm run lint` PASS, checking 2164 text files; `npm run typecheck` PASS; `npm run package:dry-run` PASS
- **Corpus improvement focused tests:** `npm test -- tests/corpus-eval.test.ts tests/core-port-gsd-migration.test.ts tests/core-cli.test.ts tests/core-init.test.ts -- --runInBand` PASS
- **Corpus evaluation:** `./src/terrace-tools.cjs corpus run --sample --json` PASS with 962 command executions, 767 passes, 138 expected blockers, zero product weaknesses, 57 skips, and zero harness/environment issues; `./src/terrace-tools.cjs corpus report --json` PASS and points at `docs/terrace/corpus/runs/2026-06-23T21-21-52-941Z`
- **Expected-blocker ergonomics focused tests:** `npm test -- tests/expected-blocker-ergonomics.test.ts tests/core-init.test.ts tests/corpus-eval.test.ts -- --runInBand` PASS, covering PRD overwrite guidance, spec validation guidance, ship/report/security blockers, partial agent assets, and corpus CLI commands
- **Corpus CLI:** `node src/terrace-tools.cjs corpus run --dry-run-plan --sample --json` PASS; `node src/terrace-tools.cjs corpus report --json` PASS and returns run id, totals, report path, and evidence path
- **Package:** `npm run package:dry-run` PASS after adding the corpus wrapper; package dry-run reported `@jakyeamos33/terrace@0.1.2`, 731.1 kB package size, 10.6 MB unpacked size, 2342 own files, and 2342 total files
- **Workflow helper remediation:** `pnpm exec vitest run tests/workflow-helpers.test.ts tests/workflow-commands.test.ts --reporter=verbose` PASS, 2 files and 32 tests
- **Current verification:** `pnpm lint` PASS, checking 4046 text files; `pnpm typecheck` PASS; `pnpm exec vitest run --reporter=verbose --exclude tests/amos-saas-gsd-smoke.test.ts` PASS, 38 files and 294 tests
- **Adoption status focused verification:** `pnpm exec vitest run tests/workflow-commands.test.ts tests/lifecycle-coverage.test.ts --reporter=verbose` PASS, 34 tests
- **pnpm conversion focused verification:** `pnpm exec vitest run tests/core-init.test.ts tests/workflow-commands.test.ts tests/implemented-placeholder-commands.test.ts tests/product-readiness.test.ts --reporter=verbose` PASS, 4 files and 48 tests
- **Migrated-GSD readiness focused verification:** `pnpm exec vitest run tests/core-port-gsd-migration.test.ts tests/corpus-eval.test.ts --reporter=verbose` PASS, 2 files and 13 tests
- **Production workbench focused verification:** `pnpm exec vitest run tests/lifecycle-coverage.test.ts tests/workflow-commands.test.ts --reporter=verbose` PASS, 2 files and 35 tests
- **Package wrapper verification:** `pnpm package` PASS via `pnpm run package:dry-run`
- **Agent asset regeneration verification:** `pnpm exec vitest run tests/core-init.test.ts tests/json-mode.test.ts tests/product-readiness.test.ts --reporter=verbose` PASS, 3 files and 18 tests
- **Final package verification:** `pnpm package` PASS via `pnpm run package:dry-run`; dry-run reported `@jakyeamos33/terrace@0.1.2`
- **Final ship verification:** `node src/terrace-tools.cjs ship check --fast --json` PASS, zero blockers, zero warnings, pnpm command rendering, and complete generated agent assets at 186/186
- **Final corpus dry-run:** `node src/terrace-tools.cjs corpus run --dry-run-plan --sample --json` PASS and includes migrated-GSD roadmap commands with `<phase-id>` targets after porting
- **0.2.0 release metadata focused verification:** `pnpm exec vitest run tests/product-readiness.test.ts --reporter=verbose` PASS, 1 file and 6 tests
- **0.2.0 release CI:** `pnpm run ci` PASS, including typecheck, lint, 294 tests with 1 skipped external fixture, coverage, and package dry-run for `@jakyeamos33/terrace@0.2.0`
- **0.2.0 audit:** `pnpm audit --audit-level moderate` PASS, zero known vulnerabilities
- **0.2.0 package:** `pnpm package` PASS via `pnpm run package:dry-run`; dry-run reported `@jakyeamos33/terrace@0.2.0`
- **0.2.0 release dry-run:** `pnpm run release:dry-run` PASS with public access and hoisted node linker configuration; dry-run targeted `https://registry.npmjs.org/`
- **Adoption status readiness verification:** `pnpm vitest run tests/workflow-commands.test.ts --reporter=verbose`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` PASS after upgrading `terrace adoption status` output and docs.
- **Trusted publishing focused verification:** `pnpm exec vitest run tests/product-readiness.test.ts --reporter=verbose` PASS, 7 tests including the Release Publish workflow token-removal regression and packed-consumer smoke path.
- **Packed global installer smoke:** `pnpm exec vitest run tests/product-readiness.test.ts --reporter=verbose` PASS, including tarball pack, fresh consumer install, temp global Codex/Claude asset installation, `/terrace` content checks, and installed-binary route usability.
- **Current CI:** `pnpm run ci` PASS, including typecheck, lint, 296 passing tests with 1 skipped external fixture, coverage, and package dry-run.
- **0.2.0 release preflight:** `node src/terrace-tools.cjs release-preflight --target-version 0.2.0 --json` PASS for CI, dependency audit, package, release dry-run, full ship check, trusted-publishing repo checks, tag/version checks, and stale release artifacts after registry access was available to the embedded `pnpm audit` step; it now warns that `v0.2.0` is not created yet, which is expected before reviewed tagging.
- **Release tag regression:** `pnpm exec vitest run tests/workflow-commands.test.ts --reporter=verbose` PASS, 36 tests including stale expected-tag detection for `RELEASE_TAG_NOT_AT_HEAD`.
- **0.2.0 GSD replacement evidence:** `terrace adoption status --json` PASS with `ready: true`, `score: 100`, `recommended_mode: replace_gsd`, 9 migrated executable phases, complete 240/240 agent assets, and zero blockers.
- **0.2.0 fast ship recheck:** `terrace ship check --fast --json` PASS with zero blockers and the expected manual trusted-publishing confirmation warning.
- **0.2.0 ship check pre-commit:** `node src/terrace-tools.cjs ship check --json` passed all functional categories and failed only the expected `dirty_tree` category because the release candidate changes were still uncommitted
- **Trusted publishing check:** release execution is GitHub-only through `release-publish.yml` with `id-token: write`, the `npm` environment, provenance publishing, and no `NODE_AUTH_TOKEN`/`NPM_TOKEN` environment.
- **Known local fixture behavior:** `tests/amos-saas-gsd-smoke.test.ts` now skips unless `/Users/jakyeamos/projects/amos-saas/.planning/HANDOFF.json` exists, so incomplete local external fixtures do not fail `pnpm run ci`.
- **Git status:** 0.2.0 release candidate work is on `codex/terrace-adoption-measure`; truth file records the current release-prep state

## Next Concrete Steps

1. Confirm npm trusted publishing for `@jakyeamos33/terrace` is configured against the GitHub repository, `release-publish.yml` workflow, and `npm` environment.
2. Rerun `terrace release-preflight --target-version 0.2.0 --json` on the clean reviewed tree and confirm no blockers.
3. Create the reviewed `v0.2.0` GitHub Release and let the release workflow publish.

## QR Remediation Planning

- 2026-07-04: Added GSD Phase 10 for QR remediation from qr-fleet-continue-20260704-terrace; 2 plan(s) created from terrace.md. Execution has not started.
