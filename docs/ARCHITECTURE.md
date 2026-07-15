# Terrace Architecture

Terrace has a small CommonJS CLI wrapper in `src/` and a reusable strict core in `packages/terrace-core/src/`.

The core owns state transitions, rule packs, gates, artifact validation, presets, baseline protection, sessions, audit checks, legacy GSD migration, and pure catalog-backed command resolution. The CLI handles global option precedence and rendering, then delegates canonical command IDs to command-family adapters and the core.

Runtime state for a target repo lives in `.terrace/state.json`. The state store validates schema `1.1`, promotes historical `1.0` state in memory, uses an optimistic revision plus a recovery-aware writer lock, syncs state data and its parent directory where supported, and atomically replaces the file.

The adjacent `.terrace` artifact surface is owned by `managed-artifacts.cjs`: configuration, policy, presets, rules, event history, generated manifests, sessions, security evidence, migration reports, and lifecycle JSON. Its synchronous re-entrant write protocol validates every managed path, rejects links and special files, serializes mutations with a recovery-aware lock, writes through synced temporary files, and recovers prepared preset transactions before admitting the next mutation. State remains a separate versioned store because it owns schema validation and optimistic revision semantics. User-authored governance artifacts live under `docs/`.
