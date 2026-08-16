# Security Check

## Summary
- Status: passed
- Findings: 2
- Blocking: 0
- Evidence schema: 1
- Scope complete: true

## Findings
- sensitive-logging-0 [medium]: Logging code appears to include sensitive authentication fields. (scripts/secret-scan.mjs)
- react-html-injection-1 [medium]: React raw HTML rendering requires sanitization evidence. (tests/expected-blocker-ergonomics.test.ts)

## Checks
- secret-patterns
- env-files
- sensitive-logging
- dependency-audit
- deployment-config
