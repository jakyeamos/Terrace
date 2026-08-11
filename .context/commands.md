---
id: terrace.commands
title: Terrace Commands
tier: project
status: active
last_reviewed: 2026-08-11
---

# Commands

Use Node.js 22 or newer and the repository's pnpm lockfile.

- `pnpm run typecheck` validates TypeScript.
- `pnpm run lint` runs the repository lint contract.
- `pnpm test` runs the deterministic test suite.
- `pnpm run test:coverage` records coverage.
- `pnpm run package:dry-run` verifies the packed consumer surface.
- `pnpm run ci` is the source completion gate.

For release readiness, also run `pnpm audit --audit-level moderate`,
`pnpm run release:dry-run`, `pnpm exec terrace ship check --json`, and
`pnpm exec terrace release-preflight --target-version 0.2.0 --json`.
The last two are report-only checks; they do not publish.
