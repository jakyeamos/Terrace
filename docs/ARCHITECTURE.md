# Terrace Architecture

Terrace has a small CommonJS CLI wrapper in `src/` and a reusable strict core in `packages/terrace-core/src/`.

The core owns state transitions, rule packs, gates, artifact validation, presets, baseline protection, sessions, audit checks, and legacy GSD migration. The CLI only parses arguments and delegates behavior to the core.

Runtime state for a target repo lives in `.terrace/state.json`. The state store validates schema `1.1`, promotes historical `1.0` state in memory, uses an optimistic revision plus a recovery-aware writer lock, syncs state data and its parent directory where supported, and atomically replaces the file. User-authored governance artifacts live under `docs/`.
