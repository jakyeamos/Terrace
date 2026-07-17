---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The command-surface cleanup branch preserves the guarded import-safe root facade, 79-file runtime-only publish payload, recoverable state and managed-artifact boundaries, state-bound natural-language applies, no ambient self-invocation, and the catalog-owned help, agents, contracts, natural-language argv, inbound dispatch, and legacy compatibility adapters. The canonical executable now presents common workflow, advanced, and compatibility help sections while structured help retains the complete catalog and aliases. Release evidence is still in progress: the checkout is prepared at 0.2.0 while npm latest is 0.1.1, and owner-backed active-feature evidence remains required before final preflight.
healthScore: 96
statusLabel: command_surface_hardened_release_evidence_in_progress
nextStep: Record owner-backed interrogation, complete feature preflight and documentation, regenerate security evidence, then obtain release-owner approval before tagging v0.2.0.
blockers:
  - Active medium-tier work requires owner-backed interrogation, preflight, and documentation evidence before release preflight can pass.
  - A release candidate needs a current `terrace security check` artifact; missing, legacy, incomplete, or source/config/lock-stale evidence intentionally blocks.
  - The checkout/package is 0.2.0 but npm latest is 0.1.1; v0.2.0 is not tagged or published and trusted-publishing admin approval remains outstanding.
risks:
  - A hostile same-user process with direct directory write access can still race a final filesystem pathname replacement; the managed lock is not an isolation boundary.
  - Runtime CommonJS remains outside the TypeScript gate.
lastUpdated: 2026-07-17
tags: [framework, ai-tooling, governance, cli, modernization]
areas: [cli, packaging, state, lifecycle, security, command-routing, agents, docs]
goals:
  - Keep Terrace installable, recoverable, and honest about readiness.
  - Preserve public CLI, JSON, artifact, agent, and GSD migration contracts through modernization.
  - Keep source-owned generated assets in catalog parity without silently overwriting bespoke or user-owned guidance.
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: JavaScript CommonJS with TypeScript tests/configuration
activeBranch: codex/command-surface-cleanup
lastCommitDate: "2026-07-17"
quality:
  lint: pass
  types: pass_commonjs_outside_typecheck
  tests: pass_focused_17_tests_full_coverage_448_pass_1_skip_1_preexisting_core_cli_failure
  coverage: preexisting_core_cli_bare_apply_exit_failure
  package: pass_fresh_pnpm_consumer_79_file_runtime_payload_and_release_dry_run
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: command_surface_curated_catalog_owned_cli_and_guarded_core_facade
canonicalCommands:
  install: pnpm install
  dev: unknown
  lint: pnpm lint
  typecheck: pnpm typecheck
  test: pnpm test
  coverage: pnpm test:coverage
  package: pnpm package:dry-run
  ci: pnpm run ci
  audit: pnpm audit --audit-level moderate
  deadcode: unknown
agentExpectationsVersion: 2
lastVerifiedCommand: "pnpm test -- tests/command-catalog.test.ts tests/product-readiness.test.ts; pnpm typecheck; pnpm lint; pnpm run agent-assets:check; pnpm test:coverage; pnpm package; pnpm run release:dry-run; pnpm run secret:scan; pnpm run dependency:security; node src/terrace-tools.cjs --help --json; node src/terrace-tools.cjs --version --json; node src/terrace-tools.cjs release-preflight --static --target-version 0.2.0 --json"
lastVerifiedAt: "2026-07-17T10:45:10-04:00"
---

## Current State

The isolated command-surface branch is committed at `e3aedd8`: package installation stays package-manager owned; initialization/reset, state persistence, and managed artifacts are recoverable and path-safe; natural-language mutations stay state-token gated; and no Terrace consumer workflow invokes an ambient Terrace executable to alter the source project.

The canonical `terrace` executable now groups human help into a common workflow, advanced commands, and compatibility aliases without removing catalog entries. `terrace --help --json` exposes the complete command catalog and alias metadata, while `terrace --version --json` returns package identity and version metadata. README install/first-run guidance and release docs state the live distribution drift plainly: the checkout is 0.2.0, npm latest is 0.1.1, and this candidate has not been published.

The runtime architecture is catalog-led. The catalog owns help, generated-agent metadata, public contracts, natural-language argv, and inbound command selection; a pure parser resolves canonical IDs, aliases, defaults, family fallbacks, and raw-flag precedence; specialized adapters own phase, senior/UI, release/readiness, report, and legacy compatibility behavior. The CLI entrypoint retains only global precedence, rendering, errors, and exit intent.

The root library facade is import-safe and guarded. It records export ownership, permits only identity-compatible compatibility aliases, preserves enumerable symbol and own `__proto__` export semantics, and fails divergent exports at load time. `main` and root `exports` resolve to that facade while `bin` remains the only executable entrypoint.

Source-owned generated assets have a 252-file read-only parity check. The package ships a 79-file runtime-only payload with consumer-owned corpus output, and the focused product-readiness suite proves the packed CLI and global installer in a fresh pnpm consumer. Focused command-surface/product tests pass 17/17; typecheck, lint, package, release dry-run, secret scan, and dependency security pass. Full coverage reports 448 passed and one intentional skip plus one pre-existing `core-cli` bare-`--apply` exit-status failure. Final release evidence awaits owner-backed interrogation, preflight, documentation, and fresh security evidence from the final frozen candidate, while runtime CommonJS static coverage and same-user filesystem races remain documented residuals.

## Recent Progress

- July 17: Committed `e3aedd8`; grouped canonical help into common, advanced, and compatibility sections, added complete JSON help and structured version output, tightened install/release docs around the 0.2.0 versus npm 0.1.1 drift, and passed 17 focused contract/readiness tests, typecheck, lint, assets, package, release dry-run, secret scan, and dependency security.
- July 15: Committed `97dd087`; removed three fixture-only false positives from tracked test source without excluding tests or weakening the security scanner. Targeted tests, typecheck, lint, secret scan, full CI (448 tests / 1 existing skip), coverage, and the 79-file package payload passed.
- July 15: Committed `c9d7a4e`; replaced the root export-spread barrel with an owner-aware collision guard, retained direct command-contract compatibility by identity, covered enumerable symbol and own `__proto__` exports, and passed full CI: 448 tests / 1 existing skip, coverage, security scans, and a 79-file package check.
- July 15: Committed `ac75f7f`; made the catalog own inbound CLI forms, aliases, defaults, families, and `port gsd` precedence; replaced top-level selection with ID-based adapters; full CI passed 442 tests / 1 existing skip, coverage, and 78-file package checks.
- July 15: Committed `0dfe3ed`; classified rule/debt audits and policy evaluation as write-capable, corrected `ship prepare --fast` guidance, synchronized generated assets, and passed 12 focused tests plus asset, type, lint, and package checks.
- July 15: Committed `b9de0b5`; removed repository docs/corpus evidence from the published tarball, moved corpus output to consumer-owned state, and proved a 76-file packed consumer with content/size regressions.
- July 15: Committed `c85f841`; aligned package `main` with the import-safe core facade while retaining the CLI only under `bin`, with fresh-process import regression coverage.
- July 15: Committed `93c2587`; isolated report command parsing with injected reporting operations while retaining the top-level renderer and ceremony-only exit intent. Full network-enabled CI passed: 428 tests / 1 existing skip, coverage, and fresh packed-consumer smoke.
- July 15: Committed `59ead7e`; isolated reporting calculation, persistence, ceremony, and ship-gate behavior below lifecycle while retaining identity-compatible exports and direct lower-level consumers. Full network-enabled CI passed: 428 tests / 1 existing skip, coverage, and fresh packed-consumer smoke.
- July 15: Committed `4151930`; isolated release-preflight and ship command routing with raw option compatibility and renderer-owned exit intent, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `979ae32`; isolated senior-cycle/UI command routing with lazy option evaluation and unchanged JSON/error rendering, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `c9dc05a`; isolated canonical and GSD-compatible phase CLI routing behind injected core operations while preserving renderer/exit behavior, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `8cb6d37`; isolated senior-cycle artifacts, state, gates, and ship evidence behind an identity-compatible workflow facade, then passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `daa2b4c`; isolated ship-readiness policy with injected senior-cycle and release evidence, removed the release/readiness dependency edge, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.
- July 14: Committed `1c88e0e`; isolated release-preflight policy behind injected dirty-tree and ship-check adapters, preserved public CLI/API behavior, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.

## Open Problems

- Active medium-tier gpt56-modernization needs owner-backed interrogation before its required preflight and documentation evidence can be recorded; this is an intentional human-judgment gate, not a source-code defect.
- A real release must regenerate `terrace security check` evidence after source, lockfile, or relevant configuration changes; this is an intentional release blocker, not a false-green fallback.
- The checkout/package is `0.2.0` while npm `latest` is `0.1.1`; `v0.2.0` is not tagged or published. Release-owner approval of the version, trusted-publishing settings, tag, and GitHub Release is still required.
- Runtime CommonJS is outside the current TypeScript gate; semantic coverage remains a later modernization concern.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | Focused command-surface/product readiness PASS: 17 tests; full coverage run: 448 passed / 1 skipped / 1 pre-existing `core-cli` bare-`--apply` exit-status failure. |
| Package | `pnpm package:dry-run` PASS with 79 runtime files; packed CLI remains runnable in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Security evidence | Fixture-only source literals were remediated without exclusions; a fresh passed artifact is still required after the owner-backed active-feature evidence and final candidate freeze. |
| Release readiness | `terrace release-preflight --static --target-version 0.2.0 --json` remains blocked by legacy security evidence, weak tier-one evidence, missing preflight/documentation, and absent release tag. |
| Distribution | Checkout/package `0.2.0`; npm `latest` `0.1.1`; no tag or publish performed. |

## Next Concrete Steps

1. Obtain owner-backed interrogation, then complete preflight and documentation evidence.
2. Freeze the resulting candidate, regenerate security evidence, and rerun the intended full release gates on its clean snapshot.
3. After release-owner approval, run `git tag v0.2.0` and create the GitHub Release to start trusted publishing; do not claim registry availability before that workflow succeeds.
4. Add static analysis for runtime CommonJS when the project chooses a compatible toolchain.
