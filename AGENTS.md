# Terrace repository agent contract

Read `.agents/context/README.md` before non-trivial work and load only the smallest relevant packet.

- Terrace is a provider-neutral pnpm/Node 22 CLI. It has no AIOS runtime dependency or authority.
- Keep the thin CommonJS CLI in `src/` separate from the reusable core in `packages/terrace-core/src/`.
- Use the commands in `package.json`; run `pnpm run environment:contract` when guidance, gates, or quality commands change.
- Keep runtime state under `.terrace/` and authored governance under `docs/`; do not commit credentials, raw prompts, or generated output.
- Preserve schema compatibility, fixtures, packaged-consumer behavior, and protected-baseline checks.
- Treat publishing, tags, deployment, migrations, and destructive state changes as explicitly approved operations.
- Before a PR, run the environment contract plus the relevant lint, typecheck, test, build, package, and secret checks.
