# Production Validation: gpt56-modernization

## Success signals

- A fresh packed consumer installs and runs the CLI with all runtime dependencies present.
- Initialization preserves existing state by default; force reset is deliberate, backed up, and recoverable.
- State writes validate/migrate and remain valid under interrupted/conflicting operations.
- Read-only commands do not write or run target scripts; explicitly applied commands report their side effects.
- Every readiness/report/security claim is current, scoped, validated, and backed by executable checks.
- Public CLI aliases, JSON, exit codes, GSD migration, agent integration, and release workflows pass characterization and regression suites.

## Validation sequence

1. Run focused milestone tests, including clean temporary consumer/state fixtures.
2. Run the full local quality suite and package content/size checks.
3. Run security selection/freshness tests and review emitted artifacts for redaction/accuracy.
4. Run independent architecture, data-integrity, package, CLI UX/accessibility, and compatibility review.
5. Repeat all checks after remediation; archive only current evidence with explicit claim scope.

## Rollback conditions

- Fresh install failure, state loss/corruption, unhandled legacy-state migration, or a JSON/exit-code compatibility regression blocks cutover.
- Missing or stale security/readiness evidence blocks release claims.
- A target-repository command runs without explicit authorization, exceeds its time budget, or changes files in a read-only workflow blocks release.

## Rollback path

- Restore the versioned state backup, keep the previous CLI compatibility adapter active, and document the exact recovery command and affected version.
- Never rely on a cached report card as rollback proof; rerun corrected evidence generation from the restored state.

## Owner

- The modernization lead owns each milestone; release approval remains a human maintainer decision after independent review.
