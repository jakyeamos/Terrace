# Compatibility

Terrace supports Node.js 22 or newer.

The public CLI, state schema, audit JSON shape, rule-pack schema, and preset registry should remain backward-compatible within a minor release. Breaking changes require a changelog entry and migration notes.

State schema `1.1` is the current canonical form. Terrace reads historical emitted `1.0` state, promotes it in memory without a read-side write, and persists `1.1` only during a successful mutation. Direct core consumers should mutate a state object returned by `loadState()` and pass it to `saveState()`, then call `loadState()` again before another mutation; intentional replacement is explicit through `replaceState()`, which is used by destructive reset and forced migration paths.
