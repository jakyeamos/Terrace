# Terrace Corpus Evaluation Report

- Run: `2026-05-07T00-14-23-935Z`
- Evidence: `docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z`
- Commands evaluated: 962
- Passed: 762
- Expected blockers: 139
- Product weaknesses: 4
- Harness/environment issues: 0

## Strongest Commands

| key | count | avgScore | passRate | productWeaknesses |
| --- | --- | --- | --- | --- |
| interrogate-risk | 21 | 97 | 1 | 0 |
| quick-plan | 21 | 93 | 1 | 0 |
| quick-execute | 21 | 93 | 1 | 0 |
| quick-complete | 21 | 93 | 1 | 0 |
| align | 21 | 93 | 1 | 0 |
| map-codebase | 21 | 93 | 1 | 0 |
| design | 21 | 93 | 1 | 0 |
| test-plan | 21 | 93 | 1 | 0 |
| observe | 21 | 93 | 1 | 0 |
| validate-prod | 21 | 93 | 1 | 0 |
| cleanup | 21 | 93 | 1 | 0 |
| new-project | 13 | 93 | 1 | 0 |

## Commands Needing Improvement

| key | count | avgScore | failureRate | productWeaknesses | harnessIssues |
| --- | --- | --- | --- | --- | --- |
| prd-import-overwrite-refusal | 13 | 63 | 0 | 0 | 0 |
| phase-list | 21 | 69 | 0 | 0 | 0 |
| phase-show-dynamic | 8 | 69 | 0 | 0 | 0 |
| quick-list | 21 | 70 | 0 | 0 | 0 |
| version | 21 | 73 | 0 | 0 | 0 |
| resume | 21 | 73 | 0 | 0 | 0 |
| history | 21 | 73 | 0 | 0 | 0 |
| backlog-list | 21 | 73 | 0 | 0 | 0 |
| backlog-add | 21 | 73 | 0 | 0 | 0 |
| spec-validate | 21 | 77 | 0 | 0 | 0 |
| settings-show | 21 | 78 | 0 | 0 | 0 |
| doctor | 21 | 81 | 0 | 0 | 0 |

## Category Performance

| key | count | avgScore | passRate | productWeaknesses |
| --- | --- | --- | --- | --- |
| senior-cycle | 147 | 93 | 1 | 0 |
| ui | 21 | 93 | 1 | 0 |
| interrogation | 55 | 92 | 1 | 0 |
| agent-integration | 21 | 92 | 0.62 | 2 |
| migration | 32 | 88 | 0.91 | 2 |
| quick-task | 84 | 87 | 1 | 0 |
| shipping-security | 105 | 87 | 0.12 | 0 |
| workflow | 176 | 83 | 0.85 | 0 |
| scratch-intake | 39 | 83 | 0.67 | 0 |
| baseline | 147 | 82 | 0.91 | 0 |
| roadmap | 93 | 80 | 0.52 | 0 |
| backlog | 42 | 73 | 1 | 0 |

## Repo-Type Performance

| key | count | avgScore | passRate | productWeaknesses |
| --- | --- | --- | --- | --- |
| saas-app / migrated-gsd | 54 | 87 | 0.87 | 0 |
| self-hosting-cli / scratch-real | 41 | 86 | 0.83 | 0 |
| large-fullstack-ts / migrated-gsd | 54 | 86 | 0.85 | 1 |
| large-fullstack-ts / scratch-real | 44 | 86 | 0.82 | 0 |
| app-with-e2e / migrated-gsd | 54 | 86 | 0.89 | 1 |
| app-with-e2e / scratch-real | 44 | 86 | 0.84 | 0 |
| saas-app / scratch-real | 44 | 86 | 0.82 | 0 |
| python / migrated-gsd | 51 | 86 | 0.69 | 0 |
| python / scratch-real | 41 | 86 | 0.83 | 0 |
| docs / migrated-gsd | 51 | 86 | 0.67 | 0 |
| docs / scratch-real | 41 | 86 | 0.8 | 0 |
| sparse / migrated-gsd | 51 | 86 | 0.69 | 0 |
| sparse / scratch-real | 41 | 86 | 0.83 | 0 |
| synthetic-node-package / scratch-synthetic | 41 | 86 | 0.83 | 0 |
| synthetic-node-no-scripts / scratch-synthetic | 44 | 86 | 0.84 | 0 |
| synthetic-python / scratch-synthetic | 41 | 86 | 0.83 | 0 |
| synthetic-docs / scratch-synthetic | 41 | 86 | 0.83 | 0 |
| synthetic-empty / scratch-synthetic | 41 | 86 | 0.83 | 0 |
| typescript-tooling / migrated-gsd | 51 | 85 | 0.67 | 0 |
| typescript-tooling / scratch-real | 41 | 85 | 0.8 | 0 |
| self-hosting-cli / migrated-gsd | 51 | 84 | 0.65 | 2 |

## Improvement Backlog

1. `agent-asset-verification` - Review raw output and add more actionable remediation or safer fallback behavior.
   Affected runs: 2, average score: 40.
2. `port-gsd-verify-parity` - Improve migrated artifact mapping, phase id selection, and next-command guidance.
   Affected runs: 2, average score: 71.

## Raw Evidence Index

- Full JSON summary: `latest-results.json`
- Per-command evidence: `docs/terrace/corpus/runs/2026-05-07T00-14-23-935Z`

## Manual Spot-Check Targets

- `Terrace` / `migrated-gsd` / `help` - pass
- `Terrace` / `scratch-real` / `interrogate` - pass
- `Terrace` / `migrated-gsd` / `align` - pass
- `Terrace` / `migrated-gsd` / `port-gsd-verify-parity` - product-weakness
- `BBDSE/Signal Lab` / `migrated-gsd` / `help` - pass
