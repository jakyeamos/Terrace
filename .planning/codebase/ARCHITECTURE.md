# Architecture

## High-Level Shape

- `src/terrace-tools.cjs` is the CLI wrapper
- `packages/terrace-core/src/` owns core behavior
- `.terrace/state.json` is runtime state for a managed repo
- `docs/` holds generated governance and workflow artifacts
- `.planning/` currently exists as a partial planning layer for this repo

## Core Architectural Pattern

The CLI parses commands and delegates to strict-core helpers. Core modules write deterministic artifacts and JSON responses. Repo-local state is preferred over external services.

## Strong Areas

- small, understandable runtime shape
- deterministic file outputs
- clear split between CLI parsing and core logic
- explicit governance artifacts

## Weak Areas Relative To GSD

- roadmap authoring is not yet a first-class native flow
- codebase mapping is present but not fully anchored in the planning layer
- recovery and handoff are present, but not yet positioned as the authoritative runtime loop
- no compact operator surface for daily use
- no strong worktree-aware execution model

## Architectural Constraint

Terrace should close parity gaps without becoming a heavy runtime engine. The strongest strategy is likely to add first-class planning, recovery, and operator primitives while keeping state repo-local and auditable.
