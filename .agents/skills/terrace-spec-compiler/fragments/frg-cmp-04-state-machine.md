# State Machine Format

State machines describe the lifecycle of a requirement or artifact. Include the initial state, allowed events, resulting state, terminal states, retry rules, cancellation behavior, and rollback path. Avoid prose-only lifecycle descriptions when a table makes transition rules testable.

Use this shape in `docs/spec/STATE-MACHINES.md`:

| state | event | guard | next_state | side_effects |
|-------|-------|-------|------------|--------------|

Every state machine should include at least one failure transition and explain whether partial writes are retried, compensated, or surfaced for human action.
