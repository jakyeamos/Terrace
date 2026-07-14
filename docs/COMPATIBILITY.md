# Compatibility

Terrace supports Node.js 22 or newer.

The public CLI, state schema, audit JSON shape, rule-pack schema, and preset registry should remain backward-compatible within a minor release. Breaking changes require a changelog entry and migration notes.

State schema `1.1` is the current canonical form. Terrace reads historical emitted `1.0` state, promotes it in memory without a read-side write, and persists `1.1` only during a successful mutation. Direct core consumers should mutate a state object returned by `loadState()` and pass it to `saveState()`, then call `loadState()` again before another mutation; intentional replacement is explicit through `replaceState()`, which is used by destructive reset and forced migration paths.

The managed-artifact boundary preserves the existing JSON and JSONL formats. It intentionally rejects unsafe `.terrace` symlinks, non-regular managed files, malformed managed JSON, and concurrent whole-file writes rather than following or silently replacing them. This is a safety tightening, not a file-format migration. It serializes cooperative Terrace writers and prevents ancestor or symlink traversal; as with other Node filesystem code, a hostile same-user process with direct write access to a project directory can still race a final pathname replacement or deletion. Keep project directories permission-controlled rather than treating the lock as an isolation boundary.

Managed and state filesystem APIs run synchronously on Node's main thread because their pinned-directory critical section uses `process.chdir()`. They are not supported from `worker_threads`; worker jobs must delegate mutations to the main CLI process.
