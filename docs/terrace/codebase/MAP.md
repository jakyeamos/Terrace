# Codebase Map

## Source Areas

- CLI and output rendering: `src/terrace-tools.cjs`.
- Core domains: `packages/terrace-core/src/`.
- Public contracts: `package.json`, `README.md`, schemas, and `docs/`.
- Governance state/evidence: `.terrace/` and `docs/terrace/`.
- Behavior contracts: `tests/` and fresh-consumer fixtures.
- Agent assets: `.agents/`, `.claude/`, and `agents.cjs`.
- Release automation: `.github/workflows/` and `scripts/`.
- Historical corpus evidence: `docs/terrace/corpus/`; it is not runtime code.

## Commands

- typecheck: `pnpm typecheck`
- lint: `pnpm lint`
- test: `pnpm test`
- coverage: `pnpm test:coverage`
- package: `pnpm package:dry-run`
- security: `pnpm secret:scan` and `pnpm dependency:security`

## Modernization anchors

- `docs/modernization/AUDIT.md`
- `docs/modernization/TARGET.md`
- `docs/modernization/EXEC_PLAN.md`
