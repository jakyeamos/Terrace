# GPT-5.6 Modernization Audit

## Scope and baseline

- Baseline commit: `b80a8997` (`Update .gitignore to exclude agent context cache`).
- Audit branch: `codex/gpt56-modernization` in an isolated worktree.
- The original checkout contained untracked `TYPESCRIPT_7_UPGRADE_AUDIT.md` and `skills/`; neither is part of this baseline or this audit.
- Terrace is a Node 22 CommonJS CLI/library. It has no browser-facing application surface, database, authentication system, or remote API. Its critical boundaries are local filesystem state, target-repository command execution, GitHub Actions/OIDC, and npm publication.

## Baseline verification

| Check | Result | Evidence / caveat |
| --- | --- | --- |
| `pnpm install --offline --frozen-lockfile` | Passed | Lockfile restored 93 packages without network access. |
| `pnpm typecheck` | Passed | Misleading: `tsconfig.json` excludes `packages/terrace-core/**/*.cjs`; production runtime is not typechecked. |
| `pnpm lint` | Passed | Scanned 4,103 text files, mostly historical corpus evidence; it is primarily syntax/format checking. |
| `pnpm test` | Failed | 305 passed, 1 failed, 1 skipped. The fresh packed-consumer CLI cannot resolve `glob-parent`. |
| `pnpm package:dry-run` | Passed | Misleading: it lists direct bundled dependencies but does not prove a clean consumer can execute the package. |
| `pnpm secret:scan` | Passed | No high-confidence literal found; it is not part of CI and its extension scope omits `.env`. |
| `pnpm dependency:security` | Passed | No advisory at moderate or above. |
| `terrace doctor` / `terrace audit` | Passed | Governance artifacts are structurally present, but these checks did not detect the package or state-integrity defects below. |

## What is worth retaining

- Small production dependency footprint and Node 22 baseline.
- Deterministic JSON output and exit-code contracts for automation.
- GSD migration and source-preservation behavior in `packages/terrace-core/src/port-gsd.cjs`.
- The product concepts: recoverable state, explicit gates, protected tests, handoffs, and release evidence.
- Non-overwriting agent-asset behavior in the asset writer, once initialization itself is made safe.

## Findings

### P0 — state and release integrity

1. **A fresh install is broken.** `package.json` bundles direct dependencies only. `fast-glob@3.3.3` requires `glob-parent`, yet `pnpm pack --dry-run` contains 55 `fast-glob` entries and zero `glob-parent` entries. The fresh-consumer smoke in `tests/product-readiness.test.ts` fails when `terrace --help` throws `Cannot find module 'glob-parent'`. A released `0.2.0` package is therefore not trustworthy.

2. **`terrace init` can erase an existing workflow.** `packages/terrace-core/src/init.cjs` recreates and saves default state, configuration, preset registry, and rule packs without an existing-state guard. A repair instruction that tells a user to rerun `init` can discard roadmap, decisions, protected tests, sessions, policy, migration, and handoff data. Initialization must be idempotent/merge-safe, or an explicit backup-producing reset must require `--force` plus confirmation.

3. **Persistent state is unsafe for concurrent agents and interruption.** `state.cjs` directly writes the whole JSON document at roughly 30 call sites, without runtime schema validation, a migration boundary, atomic temp-and-rename writes, a revision check, or a lock. The current model can lose concurrent changes or leave malformed state after interruption.

### P1 — claims, safety, and architecture

4. **Readiness and security can be false green.** `security-check.cjs` scans only the first 1,000 lexically sorted files. In this repository, those include 779 corpus files and no `src/` or `packages/` runtime files; core source begins around file 3,932. Missing security evidence is treated as passing. Separately, cached report/adoption evidence can claim `100/100` and `replace_gsd` despite stale documentation/preflight status. Evidence needs a schema version, scope, timestamp, freshness window, and fail-closed semantics for security-sensitive claims.

5. **“Read-only” checks can mutate and execute code.** The README presents `terrace ship check` as read-only, but full mode runs repository scripts (`typecheck`, lint, tests, coverage, packaging, build), which can write files, use the network, or execute arbitrary project code. During this audit, `ship check --fast` also refreshed the report card and report history. Separate inspection from execution; make project command execution explicit and pre-announced.

6. **The command surface has too many sources of truth.** Help contains 76 command lines, `agents.cjs` defines 80 generated assets, `product-readiness.test.ts` duplicates 80 expectations, and `command-contracts.cjs` has 48 partial contracts. This causes drift, unsupported recommendations, and high-cost changes.

7. **A recommended remediation command does not exist.** Ship-check output can recommend `terrace senior-cycle status`, but no CLI handler implements it. Every emitted `next_command` must be contract-tested as executable.

8. **Natural-language routing hides mutations.** The primary `/terrace` entry promises natural-language routing, but `terrace do` handles only narrow keyword patterns and can invoke write-capable autonomous workflows without a uniform preview/apply boundary. The current audit request itself was rejected as unsupported plain text.

9. **The code's boundaries do not match the product's claims.** `src/terrace-tools.cjs` is a 1,288-line switch router; `workflow.cjs` and `lifecycle.cjs` are 2,197 and 1,856 lines. `adoption.cjs -> workflow.cjs -> adoption.cjs` is a cycle. `index.cjs` spreads 35 modules into 173 exports, allowing future collisions to overwrite silently. `package.json#main` points at a CLI that calls `main()` unconditionally, while root `exports` points at the core.

### P2 — product coherence and developer experience

10. **The human interface is an ungrouped machine API.** Terrace is CLI-only, so its redesign should be a contextual terminal command center, not a web UI. Flat 80-command help, 240 generated agent assets, raw JSON defaults, and inconsistent read/write behavior hide the main journeys: start, plan, work, release, and administer.

11. **The package payload contains repository evidence rather than product assets.** `docs/terrace/corpus/` has 3,666 tracked files and about 28 MB; the package allowlist includes all `docs/`. Runtime code does not use these historical corpus runs. The tarball should include concise guides and required templates only, with reproducible size/content tests.

12. **Current quality signals overstate their coverage.** The TypeScript gate does not cover runtime CommonJS, semantic linting is absent, and the existing project truth/test-evaluation artifacts report passing/100-trust results from before the packed-consumer failure.

## Current quality score

| Dimension | Current (1–5) | Why |
| --- | ---: | --- |
| Product coherence | 2 | Valuable workflow concepts, but overlapping commands and stale claims obscure the product. |
| Correctness and data integrity | 1 | Destructive initialization and non-atomic state persistence are unsafe. |
| Architecture | 2 | Large orchestration modules, a cycle, duplicated command metadata, and conflicting entrypoints. |
| Maintainability | 2 | One change must be synchronized across multiple registries and generated surfaces. |
| Testability | 2 | Broad suite exists, but its release smoke fails and core runtime evades typechecking. |
| Security and privacy | 3 | No auth/data surface or known dependency advisories, but security evidence is incomplete and false-green prone. |
| CLI UX and accessibility | 2 | Deterministic JSON helps automation; human discovery and mutation safety need redesign. |
| Performance and package efficiency | 2 | Historical corpus dominates scans and package payload. |
| Operability | 1 | Cached readiness artifacts and hidden side effects undermine trustworthy release decisions. |
| Developer experience | 2 | Good intent, but inaccurate gates and command drift create avoidable uncertainty. |

## Constraints for the rebuild

- Preserve `.terrace/state.json`, documented artifact paths, JSON payloads, exit codes, GSD aliases, PRD intake, and source-preserving migration behavior unless a versioned migration says otherwise.
- Do not publish, modify production npm settings, or operate on user repositories during modernization.
- Treat all current evidence as stale until recomputed by a corrected implementation.
- The first implementation milestone must eliminate P0 defects before broad structural or UX changes.
