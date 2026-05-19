---
schemaVersion: 1
projectName: Terrace
summary: Terrace 0.1.2 is prepared for npm publish with PRD intake, discoverable repo-local and global Codex/Claude agent commands, a richer `terrace-autonomous` agent workflow, user-driven interrogate workflows, Terrace-native end-to-end phase routing, configurable phase effort defaults, actionable expected-blocker guidance, a first-class `.planning` refresh command, and a cross-repo corpus CLI whose latest sample run reports zero product weaknesses.
healthScore: 100
statusLabel: tier_one_ready
nextStep: Run a fresh corpus sample after the planning refresh command, then decide whether dead-code scanning belongs in the release gate.
blockers: []
lastUpdated: 2026-05-19
tags: [framework, ai-tooling, governance, spec-driven, cli]
areas: [cli, validation, lifecycle, presets, templates, packaging, ci, docs]
goals:
  - Keep Terrace publishable and recoverable from repo state
  - Prove governance workflows through packed CLI fixture tests
  - Expand migration and rule contracts without weakening hard gates
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: TypeScript
activeBranch: codex/global-agent-installer
lastCommitDate: "2026-05-13"
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
  install: npm install
  dev: unknown
  lint: npm run lint
  typecheck: npm run typecheck
  test: npm test
  coverage: npm run test:coverage
  package: npm run package:dry-run
  ci: npm run ci
  audit: npm audit --audit-level=high
  deadcode: unknown
agentExpectationsVersion: 2
lastVerifiedCommand: pnpm test -- tests/planning-refresh.test.ts tests/core-cli.test.ts tests/core-port-gsd.test.ts && pnpm typecheck && pnpm lint
lastVerifiedAt: "2026-05-19T00:50:00-04:00"
---

## Current State

Terrace now installs default non-overwriting agent integration assets during `terrace init`. Fresh init writes `AGENTS.md` for Codex, `CLAUDE.md` for Claude Code, Codex repo skills under `.agents/skills/terrace-*`, Claude project skills under `.claude/skills/terrace-*`, Claude project commands under `.claude/commands/terrace-*`, and `.terrace/agents/manifest.json` to record written, unchanged, and skipped assets. Existing user-owned agent files are preserved and reported as skipped, while repeated init reports unchanged generated assets. The generated command assets now mirror the README command-reference surface with 59 Codex skills and 59 Claude command files, including `/terrace-next`, `/terrace-align`, `/terrace-phase-plan`, `/terrace-quick-plan`, `/terrace-ship-check`, `/terrace-execute-phase-complete`, `/terrace-corpus-run`, and `/terrace-corpus-report`. The `terrace-autonomous` generated skill now carries a GSD-style autonomous workflow contract with JSON-first command execution, explicit implementation/verification loop guidance, allowed tools metadata, and stop conditions for blockers, human judgment, release readiness, and failed verification.

Terrace now also has `terrace agents install-global`, which installs non-overwriting global Codex skills into `~/.agents/skills` and global Claude Code skills/commands into `~/.claude/skills` and `~/.claude/commands`. The global installer writes a top-level `/terrace` entrypoint that routes natural-language intent through `terrace do "$ARGUMENTS"` and falls back to `terrace next`, plus the full `/terrace-*` command-reference surface and manifests under both tool directories. The installer supports `TERRACE_GLOBAL_AGENTS_DIR` and `TERRACE_GLOBAL_CLAUDE_DIR` for deterministic tests and has been run against `/Users/jakyeamos/.agents` and `/Users/jakyeamos/.claude` so local Codex and Claude Code sessions can discover `/terrace` across repos after reload.

Terrace now has a repeatable local corpus evaluation harness at `scripts/terrace-corpus-eval.cjs`, exposed as both `npm run corpus:evaluate` and the public CLI commands `terrace corpus run` / `terrace corpus report`. The harness packages local Terrace once, installs the tarball into disposable real-repo worktrees and synthetic fixture repos, tests migrated-GSD, real scratch, and synthetic scratch tracks, captures per-command evidence, scores command behavior, and writes Markdown plus JSON reports under `docs/terrace/corpus/`. The latest sample run `2026-05-07T04-42-21-292Z` evaluated 962 command executions across eight real repos and five synthetic fixtures, with 764 passes, 141 expected blockers, 57 skips, zero product weaknesses, and zero harness/environment issues.

Expected blockers now carry a shared guidance contract for both JSON and human CLI output where applicable: `code`, `message`, `file`, `why_blocked`, `next_command`, and `remediation`. PRD overwrite refusal now names the exact `--force` command and an inspect-first alternative. Spec validation, ship checks, report ceremony, and security checks now surface concrete next commands and artifact paths without weakening gate strictness. Ship checks summarize the top three blockers and keep `terrace ship check --fast` as the quick recheck path. `terrace doctor` and `terrace commands discover` detect stale partial generated agent assets and recommend non-overwriting `terrace init`.

The corpus improvement pass fixed the two highest-priority report findings. `terrace port gsd --verify-parity` now treats preserved non-empty `.planning/STATE.md` evidence as mapped `state_details`, still extracts richer decisions/backlog concepts when present, and names the exact missing concept plus source file in parity remediation. Agent asset verification now uses generated expectations from Terrace templates, writes normal evidence records, treats migrated-GSD no-assets as not applicable, and treats migrated-GSD partial assets as expected blockers with a concrete `terrace init` remediation instead of product weaknesses. Scratch tracks remain strict product checks for missing generated assets.

Terrace now has `terrace planning refresh` and its `terrace planning init` alias. The command regenerates the repo-local `.planning` package from canonical `.terrace/state.json` plus deterministic repository analysis, writing `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `HANDOFF.json`, `config.json`, and phase plan artifacts. Its JSON output is stable across repeated refreshes, excludes generated `.planning` files from its analysis counts, and points agents back to `terrace port gsd --verify-parity` so Phase 1 planning-parity workflows can prove the generated planning package remains migration-readable.

The first agent bootstrap version missed command discovery because it generated Claude skills without `name` frontmatter, did not generate `.claude/commands/*.md`, and did not generate Codex repo skills under `.agents/skills`. The second pass only exposed a small shortcut set; the current fix branch expands generation to all stable README commands and adds matching repo-local Terrace command assets so Codex and Claude can discover them after reload.

The approved design spec and implementation plan remain at `docs/superpowers/specs/2026-05-05-agent-slash-command-integration-design.md` and `docs/superpowers/plans/2026-05-05-agent-init-integration.md`.

Terrace is ready to publish as `@jakyeamos33/terrace@0.1.2`. The package identity is scoped as `@jakyeamos33/terrace` to match npm ownership and prevent name collisions, while the CLI binary remains `terrace` so local/global workflows stay unchanged. The latest release includes PRD intake, default agent bootstrap assets, end-to-end phase routing, configurable phase effort defaults, intent-routing wording, and an isolated-cache package dry-run helper for release reliability.

The latest hardening pass records release evidence for security, test-suite evaluation, rule audit, and the Tier One report card. `terrace security check` now avoids self-referential generated-artifact findings, honors explicit GitHub Actions permissions, and records a zero-finding security check for the current repo.

The `terrace port gsd` coding gap is now substantially mitigated: it converts core project files, roadmap phase headings, phase plans, phase summaries, research/context/UI specs, testing artifacts, debug/milestone archives, decisions, quick-task PLAN/SUMMARY history, backlog items, sessions, handoff state, and blocked human actions into Terrace state/docs while preserving source `.planning` files. Migration reports now include converted/skipped/writes, blockers, warnings, readiness, next command, review checklist, and validation commands.

Terrace also has GSD-style workflow continuity commands: `terrace next`, `terrace resume`, `terrace history`, `terrace do <intent>`, `terrace autonomous`, `terrace execute-phase-complete <id>`, `terrace settings effort <fast|standard|thorough>`, `terrace settings show`, `terrace commands discover`, `terrace phase list`, `terrace phase show <id>`, `terrace phase plan <id>`, `terrace phase execute <id>`, `terrace phase validate <id>`, `terrace phase review <id>`, `terrace phase complete <id>`, `terrace quick list`, `terrace quick show <id>`, `terrace quick plan <title>`, `terrace quick execute <id>`, `terrace quick complete <id>`, `terrace backlog list`, `terrace backlog add <title>`, `terrace ship check`, and `terrace ship prepare`. GSD-compatible aliases exist for `plan-phase`, `execute-phase`, `validate-phase`, `review-phase`, and `complete-phase`. Command contracts are exported from core so agent-facing expectations can align with CLI behavior.

Terrace now also has Senior Cycle commands: `terrace align <feature>`, `terrace interrogate <feature>`, `terrace map-codebase`, `terrace design <feature>`, `terrace test-plan <feature>`, `terrace observe <feature>`, `terrace validate-prod <feature>`, `terrace cleanup <feature>`, `terrace ui import-stitch <feature>`, `terrace ui plan-refresh <feature>`, and `terrace ui diff <feature>`. These generators now infer source areas, architecture hints, test strategy, workstream lanes, route/component hints, unresolved evidence, and concrete affected files from the repo instead of blank TODO placeholders.

Terrace now also supports PRD-first intake: `terrace new-project` preserves a source PRD, creates compiled spec, acceptance criteria, test plan, and initialization summary artifacts, and records intake state; `terrace prd import` does the same for later feature PRDs under `docs/terrace/features/<feature>/`.

The latest adoption-risk mitigation pass adds `terrace ship check --fast|--local|--full` modes with per-category timings, `terrace report ceremony` for artifact-count and low-density evidence checks, `terrace port gsd --compare` and `--verify-parity` for migration confidence, `terrace rule audit --effectiveness` for rule maturity/metadata coverage, and `terrace waive <gate>` for explicit reviewed temporary overrides that remain visible in report and ship output.

Shadow test branch refs named `codex/terrace-shadow-test` were created in every detected GSD-initiated project with a valid `HEAD`. `/Users/jakyeamos/projects/eslint-plugin-anti-slop` could not receive the branch because it has no valid `HEAD`. The branch creation report is recorded at `docs/terrace/shadow-branches/2026-04-29-GSD-BRANCHES.md`.

The core remains CommonJS at runtime. TypeScript is used for tests/config and typechecks with `moduleResolution: Bundler`.

## Recent Progress

- April 28: Added CLI `--help` and `--version`.
- April 28: Added canonical scripts: lint, typecheck, test, coverage, package dry-run, and ci.
- April 28: Fixed coverage to measure `packages/terrace-core/src`; current coverage passes thresholds.
- April 28: Added README, license, changelog, architecture, security, compatibility, contributing, and release docs.
- April 28: Added GitHub CI and release dry-run workflows.
- April 28: Removed tracked GitNexus skill artifacts and stale `.terrace/project-state.json`.
- April 28: Added `.terrace/state.json`, config, preset registry, events, and default rules for this repo.
- April 28: Expanded rule domains and added guarded non-dry-run `terrace port gsd` migration.
- April 28: Expanded `terrace port gsd` to convert core GSD artifacts, emit converted/skipped details, and produce an audit-healthy migrated fixture.
- April 28: Expanded `terrace port gsd` for richer GSD workflow artifacts, added workflow parity commands, exported command contracts, and added `amos-saas` temp-copy smoke coverage.
- April 28: Added GSD quick-task PLAN/SUMMARY migration plus `terrace quick list/show`; `amos-saas` skipped artifacts dropped from 170 to 3 placeholder `.gitkeep` files.
- April 28: Added `terrace history`, `terrace phase plan/execute`, handoff backlog extraction, and Terrace-native doctor/audit/migration checks inside `terrace ship check`.
- April 28: Added stateful phase plan/execute/validate/review/complete artifacts, Terrace-native quick task plan/execute/complete, `terrace ship prepare`, GSD-compatible phase aliases, and `terrace do <intent>` routing for agents.
- April 28: Added adaptive project command discovery, richer migrated-context phase plans, execution queue artifacts, `terrace autonomous`, broader GSD-style plain-text routing, and missing-script ship warnings.
- April 29: Added the Senior Cycle audit/spec, adaptive senior-cycle artifact generation, tiered gate status, phase execution enforcement for opted-in senior-cycle features, no-band-aid architecture defaults for quick work, and UI/Stitch workflow artifact commands.
- April 29: Drafted the Agent Production Lifecycle spec covering a Tier One report card, handoffs, workstreams, design-source adapters, preflight, AI review, debt tracking, documentation, test evaluation, rule audit, and standards backfill.
- April 29: Made `terrace ship check` read-only and added a regression test proving it does not write report artifacts in a fresh initialized repo.
- April 29: Added lifecycle/report edge coverage for report reads/updates, tiered ship-check branches, debt, test evaluation, rules, backfill, workstreams, and design-source artifacts.
- April 29: Added packed-consumer e2e coverage for `terrace --help`, `--version`, `init`, `doctor`, `audit`, `report`, and `ship check` from the installed npm tarball.
- April 29: Reworked README and release docs around public npm v0.1 onboarding, read-only ship checks, packed-consumer e2e, and moderate audit gates; updated PostCSS through `npm audit fix`.
- April 29: Aligned report-card scoring with release readiness by skipping preflight, completed-outcome, and documentation penalties when no active feature is set, and by accepting configured test and coverage scripts as test-suite strength evidence.
- April 29: Hardened generated artifact path handling in workflow and lifecycle helpers, added traversal-alias regression tests for feature/rule IDs, and normalized AI review mode artifact filenames.
- April 29: Implemented deterministic placeholder-command analysis with bundled `fast-glob`, `ignore`, and `yaml`; added repo/security/artifact helper modules; wired `terrace security check`; normalized static/imported AI reviews; replaced TODO-heavy lifecycle, docs, codebase, backfill, workstream, design-source, and UI drafts with repo-derived content.
- April 29: Stabilized the full lifecycle ship-category test under the complete CI chain and reran all public npm v0.1 release gates successfully.
- April 29: Added adoption-risk mitigations for ship-check modes/timings, ceremony evidence density, GSD migration compare/parity verification, rule effectiveness, explicit waivers, and GSD shadow test branches.
- April 29: Hardened timeout budgets for CLI-heavy and package/ship tests after nested ship checks proved sensitive to loaded developer machines.
- April 29: Added `.gitattributes`, Prettier LF configuration, and lint-script CRLF regression coverage so Windows checkouts cannot reintroduce CRLF-only lint noise.
- April 29: Added Windows runners to CI and release dry-run workflows, and removed the Unix-specific `/tmp` cache path from `npm run package:dry-run`.
- April 29: Synced `package-lock.json` for npm 10 CI, made npm script execution portable on Windows, and aligned branch coverage threshold with the CI suite where the external amos-saas fixture is skipped.
- May 1: Renamed the npm package to `@jakyeamos/terrace`, updated lock metadata, and updated README install/run docs including global install instructions for direct `terrace` commands.
- May 1: Corrected npm scope to `@jakyeamos33/terrace` to match the authenticated npm username and resolve publish scope ownership errors.
- May 1: Added deterministic PRD intake commands for new project initialization and feature PRD import, including source preservation, derived artifacts, state/events updates, CLI docs, direct core coverage, and v0.1.1 package metadata.
- May 5: Added the approved design spec for default `terrace init` agent integration, covering Codex `AGENTS.md`, Claude `CLAUDE.md`, Claude project skills, manifest tracking, non-overwrite behavior, JSON output, and tests.
- May 5: Added the implementation plan for default `terrace init` agent integration with task-level test, implementation, documentation, verification, and commit steps.
- May 5: Implemented default `terrace init` agent bootstrap through `packages/terrace-core/src/agents.cjs`, including Codex guidance, Claude guidance, Claude project skills, manifest tracking, JSON output, preservation/idempotence tests, and README documentation.
- May 5: Added Terrace-native end-to-end phase routing through `terrace execute-phase-complete <id>` and natural-language goal routing, plus persisted phase effort defaults with `terrace settings effort <fast|standard|thorough>`.
- May 6: Merged `codex/agent-init-integration` locally into `main` and preserved the intent-routing wording update across CLI help, command contracts, workflow errors, and generated agent guidance.
- May 6: Bumped the package to `0.1.2`, updated the changelog, and passed the npm release checks using an isolated npm cache because the user-level npm cache has root-owned files.
- May 13: Expanded the generated and checked-in `terrace-autonomous` Codex/Claude agent assets from a thin `terrace autonomous` wrapper into a GSD-style autonomous phase-advancement workflow with guardrails and regression coverage.
- May 7: Reworked `terrace interrogate` so the CLI refuses to write interrogation artifacts without user answers, returns repo-informed questions for the agent to ask inline, records `User Answers` in the artifact, and regenerates Codex/Claude interrogate skills around the GSD-style discussion handoff.
- May 6: Replaced the `package:dry-run` script with a Node wrapper that uses a writable temp npm cache so `terrace ship check` and CI are not blocked by root-owned files in `~/.npm`.
- May 6: Fixed agent command discovery by adding Codex `.agents/skills/terrace-*`, Claude `.claude/commands/terrace-*`, required skill `name` frontmatter, and repo-local Terrace command assets.
- May 6: Expanded agent command discovery from the initial shortcut set to the full README command-reference surface, generating 57 Codex skills, 57 Claude skills, and 57 Claude command files while removing stale shortcut-only assets.
- May 6: Added the cross-repo Terrace corpus evaluation harness and committed the first sample report/evidence under `docs/terrace/corpus/`, covering migrated-GSD, real scratch, and synthetic scratch command behavior.
- May 7: Fixed corpus parity and report classification so preserved GSD state details count as mapped, migrated partial agent assets are actionable expected blockers, report ranking separates product weaknesses from expected blockers, and the regenerated sample corpus reports zero product weaknesses.
- May 7: Added `terrace agents install-global` with `/terrace` global Codex and Claude Code entrypoints, full global `/terrace-*` skill/command generation, non-overwrite manifest tracking, README docs, JSON-mode coverage, and local installs into `/Users/jakyeamos/.agents` and `/Users/jakyeamos/.claude`.
- May 19: Added `terrace planning refresh` / `terrace planning init` to regenerate `.planning` from Terrace state and repo analysis with deterministic JSON output, plus Phase 1 planning-parity tests that verify repeated refreshes and `terrace port gsd --verify-parity`.

## Open Problems

- Feature tier selection still defaults to medium unless a feature records an explicit tier.
- The corpus expected-blocker watchlist still contains intentional blockers, but they now include self-serve next-command guidance and are separated from product weaknesses in the report.
- Dead-code scanning is not configured.

## Quality Ladder Notes

- **Lint:** `pnpm lint` PASS, checking 2179 audited text files for CRLF and `.cjs` files for syntax/trailing whitespace
- **Types:** `pnpm typecheck` PASS
- **Tests:** `pnpm test -- tests/planning-refresh.test.ts tests/core-cli.test.ts tests/core-port-gsd.test.ts` PASS, 38 files and 283 tests because the repo script currently runs the full Vitest suite despite the forwarded file arguments
- **Coverage:** `npm run test:coverage` PASS, global coverage above configured thresholds: lines 86.21%, statements 85.74%, functions 88.76%, branches 70.86%
- **Package:** `npm run package:dry-run` PASS for `@jakyeamos33/terrace@0.1.2`, including `packages/terrace-core/src/agents.cjs`; packed-consumer e2e PASS in the full suite
- **Release portability:** `npm run package:dry-run` PASS with the portable npm cache default; corrected packed-install smoke PASS from a fresh temp consumer project
- **Audit:** `npm audit --audit-level=moderate` PASS, zero vulnerabilities
- **CI:** `npm --cache /private/tmp/terrace-npm-cache run ci` PASS
- **Security:** `node src/terrace-tools.cjs security check --json` PASS, zero findings
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
- **Corpus evaluation:** `npm run corpus:evaluate -- --dry-run-plan --sample` PASS; `npm run corpus:evaluate -- --sample` PASS with 962 command executions, 764 passes, 141 expected blockers, zero product weaknesses, 57 skips, and zero harness/environment issues
- **Expected-blocker ergonomics focused tests:** `npm test -- tests/expected-blocker-ergonomics.test.ts tests/core-init.test.ts tests/corpus-eval.test.ts -- --runInBand` PASS, covering PRD overwrite guidance, spec validation guidance, ship/report/security blockers, partial agent assets, and corpus CLI commands
- **Corpus CLI:** `node src/terrace-tools.cjs corpus run --dry-run-plan --sample --json` PASS; `node src/terrace-tools.cjs corpus report --json` PASS and returns run id, totals, report path, and evidence path
- **Package:** `npm run package:dry-run` PASS after adding the corpus wrapper; package dry-run reported `@jakyeamos33/terrace@0.1.2`, 731.1 kB package size, 10.6 MB unpacked size, 2342 own files, and 2342 total files
- **Git status:** expected-blocker ergonomics implementation committed on `codex/expected-blocker-ergonomics`; truth file records the new state

## Next Concrete Steps

1. Run a fresh full `terrace corpus run --sample --json` before publishing so the corpus report reflects user-driven interrogate behavior and the new planning refresh command.
2. Configure dead-code scanning or explicitly document why it remains out of scope for the current release.
3. Review whether the remaining intentional blocker language in `docs/terrace/corpus/REPORT.md` needs README/tutorial examples for public beta users.
