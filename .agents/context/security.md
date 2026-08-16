# Security and credential constraints

- Never commit `.env` files, private keys, certificates, credentials, tokens, or raw provider transcripts.
- `scripts/secret-scan.mjs` is the local content check; CI also runs it and `pnpm audit`.
- Keep dependency overrides in the pnpm workspace configuration, pin patched transitive versions deliberately, and refresh the lockfile with `pnpm install --frozen-lockfile` before validating.
- CI uses read-only repository permissions. Publishing uses npm trusted publishing/OIDC in the protected release workflow; do not add npm tokens.
- Network-dependent advisory results must retain their actual outcome. A skipped registry request is unknown, not a clean security result.
- Keep provider, deployment, publishing, tag, migration, and destructive filesystem actions behind explicit approval.
- Do not inherit dangerous-mode or permissive settings from another agent or repository.
