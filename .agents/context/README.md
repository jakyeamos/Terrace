---
id: terrace.repo-context
schema_version: 1
last_reviewed: 2026-07-29
owner: repository
minimum_context: this index plus the smallest linked packet needed for the task
---

# Terrace context index

Terrace is a public, provider-neutral pnpm/Node CLI for spec-driven, test-governed development. Start here, then load only the packet required by the task. Do not dump the repository, `.terrace/` state, planning archives, or generated artifacts into an agent context.

| Task or evidence | Read |
| --- | --- |
| Architecture, ownership, and boundaries | [architecture](architecture.md) |
| Build, test, lint, package, and audit commands | [commands](commands.md) |
| Coding and documentation conventions | [conventions](conventions.md) |
| Credentials, network, and release safety | [security](security.md) |
| Known failures and recovery paths | [failure modes](failure-modes.md) |
| Good implementation and test examples | [examples](examples.md) |
| Definition of done and acceptance evidence | [done](done.md) |
| Deployment, publishing, and rollback | [deployment](deployment.md) |

Canonical references are `package.json`, `pnpm-workspace.yaml`, `README.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/RELEASE.md`, and `docs/CONTRIBUTING.md`. The environment contract validates this index and its packet links. Missing or stale context is a failed repository condition, not permission to infer a green result.
