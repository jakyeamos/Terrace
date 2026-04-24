# Test Layer Selection

Requirements map to the smallest layer that proves the risk. Use unit tests for pure parsing, normalization, hash computation, risk scoring, and invariant helpers. Use integration tests when behavior crosses file boundaries, reads artifacts, writes governed paths, or composes multiple modules. Use contract tests for CLI shape, JSON output, artifact schemas, and agent frontmatter contracts. Use e2e tests for user-visible workflows where multiple artifacts must be produced in order. Manual checks are allowed only for visual or external-service behavior that cannot be automated yet.

Layer selection drives CI tier assignment and should be paired with a one-sentence rationale.
