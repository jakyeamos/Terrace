---
schemaVersion: 1
projectName: Terrace
summary: Terrace is a Node 22, pnpm-first CLI/library for spec-driven AI development. The GPT-5.6 modernization branch has a guarded import-safe root library facade, a 79-file runtime-only publish payload, consumer-owned corpus evidence, recoverable initialization/reset semantics, durable state persistence, a shared managed-artifact boundary, explicit state-bound natural-language applies, no ambient self-invocation, mutation-safe command metadata, and a canonical command catalog that owns help, agents, contracts, natural-language argv, and inbound CLI dispatch through phase, senior/UI, release-readiness, report, and legacy compatibility adapters. Release evidence is in progress: fixture-only scanner false positives were repaired without weakening scan coverage, and owner-backed active-feature interrogation remains required before final preflight.
healthScore: 96
statusLabel: modernization_complete_release_evidence_in_progress
nextStep: Record owner-backed gpt56-modernization interrogation, complete feature preflight and documentation, then freeze the candidate, regenerate security evidence, and run the full release gates.
blockers:
  - Active medium-tier gpt56-modernization requires owner-backed interrogation, preflight, and documentation evidence before release preflight can pass.
  - A release candidate needs a current `terrace security check` artifact; missing, legacy, incomplete, or source/config/lock-stale evidence intentionally blocks.
risks:
  - A hostile same-user process with direct directory write access can still race a final filesystem pathname replacement; the managed lock is not an isolation boundary.
  - Runtime CommonJS remains outside the TypeScript gate.
lastUpdated: 2026-07-15
tags: [framework, ai-tooling, governance, cli, modernization]
areas: [cli, packaging, state, lifecycle, security, command-routing, agents, docs]
goals:
  - Keep Terrace installable, recoverable, and honest about readiness.
  - Preserve public CLI, JSON, artifact, agent, and GSD migration contracts through modernization.
  - Keep source-owned generated assets in catalog parity without silently overwriting bespoke or user-owned guidance.
repoType: library
sourceOfTruth: .terrace/state.json
primaryLanguage: JavaScript CommonJS with TypeScript tests/configuration
activeBranch: codex/gpt56-modernization
lastCommitDate: "2026-07-15"
quality:
  lint: pass
  types: pass_commonjs_outside_typecheck
  tests: pass_ci_448_tests_1_skip_security_fixture_remediation_97dd087
  coverage: pass_ci_coverage_gate
  package: pass_fresh_pnpm_consumer_79_file_runtime_payload
  auditHigh: pass
  auditModerate: pass
  deadCode: not_configured
  structure: modernization_complete_catalog_owned_cli_and_guarded_core_facade
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
lastVerifiedCommand: "pnpm run ci; targeted fixture tests; pnpm typecheck; pnpm lint; pnpm secret:scan"
lastVerifiedAt: "2026-07-15T12:50:04-04:00"
---

## Current State

The isolated GPT-5.6 modernization branch is structurally complete: package installation stays package-manager owned; initialization/reset, state persistence, and managed artifacts are recoverable and path-safe; natural-language mutations stay state-token gated; and no Terrace consumer workflow invokes an ambient Terrace executable to alter the source project.

The runtime architecture is catalog-led. The catalog owns help, generated-agent metadata, public contracts, natural-language argv, and inbound command selection; a pure parser resolves canonical IDs, aliases, defaults, family fallbacks, and raw-flag precedence; specialized adapters own phase, senior/UI, release/readiness, report, and legacy compatibility behavior. The CLI entrypoint retains only global precedence, rendering, errors, and exit intent.

The root library facade is import-safe and guarded. It records export ownership, permits only identity-compatible compatibility aliases, preserves enumerable symbol and own `__proto__` export semantics, and fails divergent exports at load time. `main` and root `exports` resolve to that facade while `bin` remains the only executable entrypoint.

Source-owned generated assets have a 252-file read-only parity check. The package ships a 79-file runtime-only payload with consumer-owned corpus output, and a fresh pnpm consumer proves the packed CLI and global installer. Full CI passes with 448 tests and one intentional skip. The former high-severity release-scan findings were test-fixture literals, not credentials; `97dd087` constructs those runtime fixtures without reducing scan scope. Final release evidence awaits owner-backed active-feature interrogation, preflight, documentation, and fresh security evidence from the final frozen candidate, while runtime CommonJS static coverage and same-user filesystem races remain documented residuals.

## Recent Progress

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
- July 14: Committed `8018e84`; centralized unresolved-debt assessment, preserved lifecycle remediation and workbench response shapes, and passed full network-enabled CI with coverage and fresh packed-consumer smoke.

## Open Problems

- Active medium-tier gpt56-modernization needs owner-backed interrogation before its required preflight and documentation evidence can be recorded; this is an intentional human-judgment gate, not a source-code defect.
- A real release must regenerate `terrace security check` evidence after source, lockfile, or relevant configuration changes; this is an intentional release blocker, not a false-green fallback.
- Runtime CommonJS is outside the current TypeScript gate; semantic coverage remains a later modernization concern.
- Managed files rely on cooperative locking and permission-controlled project directories; same-user hostile replacement races remain a documented residual risk.

## Quality Ladder Notes

| Check | Current evidence |
| --- | --- |
| Lint | `pnpm lint` PASS; broad text/syntax scan, not semantic linting. |
| Types | `pnpm typecheck` PASS, but excludes production CommonJS core. |
| Tests | Full CI PASS: 448 tests / 1 existing skip, coverage gate, and fresh-consumer package check; core-facade guard has targeted compatibility and edge-semantics coverage. |
| Package | `pnpm package:dry-run` PASS with 79 runtime files; packed CLI remains runnable in a clean pnpm consumer. |
| Dependency audit | `pnpm dependency:security` PASS with no advisory at moderate or above. |
| Security evidence | Fixture-only source literals were remediated without exclusions; a fresh passed artifact is still required after the owner-backed active-feature evidence and final candidate freeze. |
| Governance | `terrace spec validate --json` PASS; planning state is intentionally not release-ready. |

## Next Concrete Steps

1. Obtain owner-backed gpt56-modernization interrogation, then complete its preflight and documentation evidence.
2. Freeze the resulting candidate, regenerate security evidence, and run the intended full release gates on its clean snapshot.
3. Add static analysis for runtime CommonJS when the project chooses a compatible toolchain.
