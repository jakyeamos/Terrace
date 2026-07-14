# Cleanup: gpt56-modernization

## Compatibility and temporary paths

- Retain legacy CLI aliases and exported function adapters only while a documented compatibility window requires them.
- Track each adapter's owner, users, removal criterion, and removal milestone; do not keep permanent duplicate dispatchers or state writers.
- Remove old command inventories after the catalog generates equivalent help, agent assets, docs checks, and test matrices.

## Repository and package cleanup

- Remove historical corpus evidence from the publish allowlist while retaining it in the repository/release evidence store as appropriate.
- Remove stale report cards, security evidence, generated agent assets, false-green tests, unused dependencies, and dead flags after consumers migrate.
- Keep one source of truth for package files, commands, state migrations, and generated documentation.

## Documentation updates

- Update README, architecture, security, release, migration, contributor, and agent guidance alongside each behavior change.
- Clearly distinguish read-only inspection from opt-in project-command execution.
- Publish compatibility/deprecation and rollback instructions before removing any public path.

## Completion gate

- Cleanup is complete only after the adversarial review confirms no obsolete implementation, stale evidence, unowned compatibility shim, or package payload drift remains. Remaining debt must have an owner and expiry.
