# Alignment: gpt56-modernization

## Customer

- Developers and AI agents using Terrace to plan, execute, migrate, and ship work from a local repository.
- Maintainers publishing `@jakyeamos33/terrace` and relying on its release/readiness evidence.

## Problem

- Terrace's governance surface can report healthy while a fresh consumer cannot execute the packed CLI.
- `terrace init` can overwrite established workflow state, and state writes are unsafe under concurrent agents or interruption.
- Help, generated assets, tests, and routing drift because the command surface has multiple competing definitions.
- A flat, write-ambiguous command inventory makes the CLI harder to trust and operate than the workflow it intends to govern.

## Success Metrics

- A fresh pnpm/npm-compatible consumer can install and run the packed CLI.
- No safe/default command destroys state or runs unannounced target-repository scripts.
- Every readiness/security claim has current, scoped evidence; stale or missing evidence cannot pass silently.
- Help, agent assets, routing, documentation, and contract tests derive from one command catalog.
- A user can start, plan, work, release, and administer Terrace through a concise contextual CLI path while existing public contracts remain compatible.

## Non-goals

- No hosted service, database, web application, or auth system is introduced.
- Do not remove GSD compatibility, agent integrations, or published CLI contracts without a versioned migration path.
- Do not publish or change external npm/GitHub production configuration during this modernization.

## Edge Cases

- Existing state with unknown fields, old versions, or partially written JSON.
- Two agents writing state concurrently or an interrupted write.
- Noninteractive CI, piped input, and callers requiring JSON and stable exit codes.
- A stale/missing report or security artifact, a malformed artifact, and a failed project script.
- Dependency layouts that differ across clean pnpm/npm consumers.

## Risks

- State and migration regressions in `packages/terrace-core/src/state.cjs`, `init.cjs`, schemas, and GSD migration must be characterized before refactoring.
- Packaging changes can break the global agent installer or compatibility exports; fresh-consumer tests are release blocking.
- Command-catalog extraction must preserve existing aliases, generated assets, and JSON response shapes.
- Terminal UX changes must not reduce noninteractive or screen-reader-friendly behavior.

## Feature Flag Decision

- No user-facing flag is required for the safety fixes; correctness must be the default.
- Compatibility adapters may be retained temporarily for legacy commands, but each must have an owner, removal criterion, and documented deprecation window.

## Observability Plan

- Record evidence schema version, claim scope, inputs, timestamps, freshness policy, invalidation, and the exact command version.
- Emit explicit preview/apply decisions and project-script execution logs without hiding side effects behind read-only verbs.

## Validation Plan

- Run characterization, fresh-consumer packaging, state-recovery/concurrency, command-contract, security-selection, and core workflow tests for every milestone.
- Use independent adversarial review before cutover; no confirmed P0/P1 remains open.

## Cleanup Plan

- Remove duplicate registries, stale readiness artifacts, unneeded generated compatibility assets, corpus files from the publish payload, and temporary adapters after each migration completes.

## No Band-Aid Rule

- Default to sustainable architecture. Do not choose a quick fix unless it preserves the target seams in `docs/modernization/TARGET.md` and has an explicit removal path.
