# Contributing

Use a feature branch for non-trivial work. Keep commits scoped to one concern and record implementation and verification in the relevant current documentation, routed context, or Terrace state artifact when behavior, commands, boundaries, or release procedures change. Do not add the retired `.tracker/PROJECT_TRUTH.md` file.

Before opening a PR, run:

```sh
pnpm run ci
pnpm run environment:contract
```

Do not add generated local state, local agent settings, credentials, raw prompts, or planning archives to the npm package allowlist. Keep release and publishing actions explicitly approved.
