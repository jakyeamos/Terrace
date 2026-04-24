# CI Tier Assignment

Map risk to CI placement:

- P0 -> pre-merge
- P1 -> pre-merge
- P2 -> post-merge or nightly
- P3 -> local-only

Use `pre-merge` for tests that protect auth, permissions, money flow, data loss, schema changes, baseline protection, and command contracts. Use `post-merge` for broader integration coverage that is valuable but too slow to block every PR. Use `nightly` for expensive fixtures, compatibility sweeps, and performance trend checks. Use `local-only` for exploratory or low-signal checks.

If a requirement contains mixed risks, assign the highest applicable tier and split lower-risk checks into separate entries only when it reduces CI cost without hiding a P0/P1 guard.
