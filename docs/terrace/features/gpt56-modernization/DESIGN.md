# Design: gpt56-modernization

## Architecture Decision

- Keep Terrace as one Node 22 package while separating it into platform, state, project-analysis, domain, command, and CLI seams. Do not create a workspace merely because the core lives under `packages/`.
- Make a declarative command catalog the sole metadata source. The CLI parses global flags and renders output; the dispatcher resolves catalog entries; grouped handlers call domain services.
- Preserve `.terrace/state.json` as the initial public artifact while moving all state access through a versioned, validated, atomic state store.
- Keep public argv/JSON/exit-code behavior through compatibility adapters while the command catalog and domains are extracted.
- Make the root package entrypoint import-safe and reserve `bin` for executable CLI behavior.

## Tradeoffs

- A deep in-place refactor retains valuable migration and automation contracts, but requires careful characterization tests and temporary adapters.
- A CLI-first status/help redesign improves daily usability without the operational cost of a mandatory TUI or web application.
- A staged strict-TypeScript migration improves safety at seams without delaying P0 package/state remediation for a repo-wide rewrite.
- Removing corpus evidence from the tarball improves package quality, but the data remains repository/release evidence rather than being deleted.

## Maintainability

- Extract project command discovery and intent parsing from workflow orchestration to remove the adoption/workflow cycle.
- Replace the spread-barrel root export with an explicit public facade.
- Generate help, agent manifests, README contract checks, and test matrices from the command catalog.
- Treat evidence freshness, state integrity, and package-installability as product contracts rather than optional governance signals.

## No Band-Aid Rule

- A quick fix is not acceptable unless it leaves a clear path to the target seams and documents the compatibility/removal plan.

## Exit Criteria

- The execution path in `docs/modernization/EXEC_PLAN.md` is characterized, vertically staged, rollback-aware, and ready to begin with fresh-install package containment.
