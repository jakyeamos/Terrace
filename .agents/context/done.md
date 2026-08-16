# Definition of done

A change is ready for review when:

- behavior and acceptance criteria are represented by tests or explicit command evidence;
- `pnpm run environment:contract` passes;
- applicable lint, strict typecheck, tests, build, package, and secret checks pass;
- documentation and routed context match the implemented behavior;
- no credentials, raw prompts, generated state, or unrelated files are included;
- release, migration, deployment, and destructive actions remain human-approved;
- the diff is scoped, reversible, and preserves protected-baseline and packaged-consumer behavior.

If a required check is unavailable, timed out, or network-blocked, record that exact state rather than converting it to success.
