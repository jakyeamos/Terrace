# Fixture Architecture and Mock Policy

Fixtures should represent realistic project shapes while staying small enough for fast CI. Prefer named fixture repos or temp directories with explicit files over hidden global state. Each fixture must state which requirement it proves, what artifact paths are expected, and what inputs are intentionally omitted.

Use real filesystem reads for governance artifacts when possible. Mock external services, wall-clock time, network calls, and credentials. Do not mock the code under test just to satisfy a shape assertion. For CLI tests, run the command in a temporary cwd and assert stdout, stderr, exit code, and produced files.

Fixture cleanup is mandatory so repeated runs remain idempotent.
