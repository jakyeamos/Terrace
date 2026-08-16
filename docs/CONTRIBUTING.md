# Contributing

Use a feature branch for non-trivial work. Keep commits scoped to one concern and update the routed context or relevant evidence artifact when behavior, commands, boundaries, or release procedures change.

Before opening a PR, run:

```sh
pnpm run ci
pnpm run environment:contract
```

Do not add generated local state, local agent settings, credentials, raw prompts, or planning archives to the npm package allowlist. Keep release and publishing actions explicitly approved.
