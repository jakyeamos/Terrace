# Terrace system map

Status: minimal proposal catalog; no child Compass has been ratified.

## Decision record

- Selected form: minimal ICM System map (`AGENTS.md`, this context, and an
  object index).
- Rejected form: a full objects/processes/effects scaffold; Terrace is small
  enough that it would add structure without improving the walk.
- Authority: `.project-compass/`, `.agents/context/architecture.md`,
  `packages/terrace-core/src`, and the CLI/governance sources.
- No new quiz was created because the core-versus-CLI boundary is explicit in
  the existing architecture evidence; child Compass activation remains
  optional and requires a separate intent decision.

## Proposed boundaries

- **terrace-core** — `packages/terrace-core/src`; owns state transitions,
  rules, gates, artifact validation, sessions, audits, and migration.
- **cli-and-governance** — `src/`, `docs/`, `scripts/`, and `skills/`; owns the
  thin command surface, authored governance, packaging, and operator guidance.
- **support** — `tests/`, fixtures, and tools; does not become a product child
  by directory presence alone.

## First-order impact

- **Hits:** changing core state/rules hits the core boundary and its CLI
  projections; changing CLI governance hits operator-facing contracts.
- **Does not hit:** an isolated fixture or test helper does not redefine the
  core state machine.

## Deferred

No root routing row, child registry entry, object card, process card, or effect
index is created in this minimal slice.

