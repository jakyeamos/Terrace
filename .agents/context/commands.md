# Commands

Run from the repository root with Node 22 and pnpm 11.

- `pnpm install --frozen-lockfile` — install the locked dependency graph.
- `pnpm run lint` — repository lint and style checks.
- `pnpm run typecheck` — strict TypeScript validation.
- `pnpm run test` — Vitest test suite through the repository runner.
- `pnpm run test:coverage` — test suite with coverage output.
- `pnpm run build` — strict typecheck build contract.
- `pnpm run package:dry-run` — validate the npm package contents and packed consumer.
- `pnpm run secret:scan` — local tracked-content secret scan.
- `pnpm run environment:contract` — deterministic context, quality-surface, strictness, and safety contract.
- `pnpm audit --audit-level moderate` — network-backed dependency advisory gate; a network failure is unknown, not success.
- `pnpm run ci` — typecheck, lint, tests, coverage, and package dry run.

Do not replace pnpm commands with npm aliases in repository guidance. The advisory `pnpm run dependency:security` script may skip when the registry is unavailable and must be labeled accordingly.
