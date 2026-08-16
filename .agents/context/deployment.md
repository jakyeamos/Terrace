# Deployment and rollback

- Run the full release readiness sequence in `docs/RELEASE.md`: CI, audit, package dry run, ship check, and release preflight.
- Publishing is performed only by the protected GitHub trusted-publishing workflow with npm OIDC.
- Do not publish, tag, deploy, or change release state from an unreviewed worktree.
- For a bad npm release, deprecate the affected version and issue a corrective patch according to the release policy; do not rewrite published history.
- For repository changes, rollback is a reviewed revert or a forward corrective commit. Preserve the evidence and do not reset shared history.
