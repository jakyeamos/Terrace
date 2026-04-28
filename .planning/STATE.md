---
status: active
last_updated: "2026-04-28T18:40:00.000Z"
last_activity: 2026-04-28 -- Legacy runtime behavior extracted into terrace-core
---

# Project State

Current focus: `terrace-core` is now the runtime owner for useful legacy functionality.

Completed this slice:

- Extracted spec hashing, protected baseline enforcement, decision logging, policy evaluation, session reconstruction, artifact validation, preset installation, migration, audit/CI checks, health checks, schemas, and template ownership into `packages/terrace-core`.
- Rewired `src/terrace-tools.cjs` and tests to import `terrace-core` APIs.
- Removed duplicate `src/lib` modules, legacy `src/schemas`, legacy `src/templates`, historical `.planning` phase/research/session artifacts, and `docs/superpowers` execution/spec artifacts.

Remaining risks:

- Agent skill instructions still need a stricter command-contract pass.
- `terrace port gsd` is still dry-run classification/inventory only.
- User-facing command docs are not yet concise enough for external use.
