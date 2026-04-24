# Risk Scoring Rubric

P0: safety-critical or governance-critical behavior. Auth, permissions, money flow, data loss, schema changes, protected baseline mutation, and cross-project writes are always P0 regardless of feature size. P0 entries require `ci_tier: pre-merge`.

P1: core behavior such as primary happy paths, state machines, invariants, artifact generation, and CLI command contracts. P1 entries also run pre-merge.

P2: secondary behavior such as non-critical edge cases, performance checks, recovery paths that do not risk data loss, and compatibility coverage. P2 entries run post-merge or nightly.

P3: opportunistic, exploratory, cosmetic, or low-value paths. P3 entries are local-only and must not block CI.
