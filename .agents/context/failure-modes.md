# Common failure modes

- Frozen install failure: verify Node 22, pnpm 11, and the lockfile before changing dependencies.
- Typecheck failure: fix the strict type error at its source; do not weaken `tsconfig.json`.
- Secret-scan finding: inspect the exact tracked path and remove or rotate the credential before retrying.
- Package dry-run failure: check `package.json.files`, packed consumer behavior, and generated output boundaries.
- Audit timeout or registry failure: preserve `unknown` status and rerun with network access; do not claim security proof.
- Protected-baseline or migration failure: stop before writing state, record the evidence, and use an isolated disposable worktree.
- Missing or stale context: update the routed packet and its review date, then rerun `pnpm run environment:contract`.
