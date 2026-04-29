# Terrace Architecture

Terrace has a small CommonJS CLI wrapper in `src/` and a reusable strict core in `packages/terrace-core/src/`.

The core owns state transitions, rule packs, gates, artifact validation, presets, baseline protection, sessions, audit checks, and legacy GSD migration. The CLI only parses arguments and delegates behavior to the core.

Runtime state for a target repo lives in `.terrace/state.json`. User-authored governance artifacts live under `docs/`.
