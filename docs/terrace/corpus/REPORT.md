# Terrace Corpus Evaluation Report

- Run: `2026-05-07T04-42-21-292Z`
- Evidence: `docs/terrace/corpus/runs/2026-05-07T04-42-21-292Z`
- Commands evaluated: 962
- Passed: 764
- Expected blockers: 141
- Product weaknesses: 0
- Harness/environment issues: 0

## Strongest Commands

| key | count | avgScore | passRate | productWeaknesses |
| --- | --- | --- | --- | --- |
| interrogate-risk | 21 | 97 | 1 | 0 |
| agent-asset-verification | 21 | 96 | 0.62 | 0 |
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

## Product Weaknesses

_No rows._

_No representative examples._

## Expected Blockers / Ergonomics Watchlist

| key | count | avgScore | expectedBlockers |
| --- | --- | --- | --- |
| prd-import-overwrite-refusal | 13 | 63 | 13 |
| agent-asset-verification | 2 | 72 | 2 |
| spec-validate | 13 | 75 | 13 |
| do-ship-check | 21 | 82 | 21 |
| ship-check | 21 | 86 | 21 |
| ship-prepare | 21 | 86 | 21 |
| report-ceremony | 21 | 87 | 21 |
| ship-check-fast | 21 | 87 | 21 |
| security-check | 8 | 87 | 8 |

- `prd-import-overwrite-refusal`: `Terrace` / `scratch-real` / `expected-blocker` - { "error": "Refusing to overwrite docs/terrace/features/terrace-corpus-smoke/PRD.md. Re-run with --force to replace it.", "details": null }
- `agent-asset-verification`: `Terrace` / `migrated-gsd` / `expected-blocker` - Run terrace init in the migrated worktree to install missing non-overwriting agent assets.
- `spec-validate`: `Terrace` / `scratch-real` / `expected-blocker` - { "blocking": [ { "code": "MISSING_REQUIRED_SECTION", "message": "Missing required section: problem", "file": "/private/var/folders/r7/b6pc8f3d7mjgkqx_wps2p52r0000gn/T/terrace-corpus-eval-2026-05-07T04-42-21-292Z/worktrees/real/terrace-scra
- `do-ship-check`: `Terrace` / `migrated-gsd` / `expected-blocker` - { "input": "ship check", "command": "terrace ship check", "result": { "mode": "full", "passed": false, "project_commands": { "package_manager": "npm", "scripts": { "typecheck": "tsc --noEmit", "lint": "node scripts/lint.cjs", "build": "npm 
- `ship-check`: `Terrace` / `migrated-gsd` / `expected-blocker` - { "mode": "full", "passed": false, "project_commands": { "package_manager": "npm", "scripts": { "typecheck": "tsc --noEmit", "lint": "node scripts/lint.cjs", "build": "npm run typecheck", "test": "vitest run --reporter=verbose", "test:cover
- `ship-prepare`: `Terrace` / `migrated-gsd` / `expected-blocker` - { "mode": "full", "passed": false, "project_commands": { "package_manager": "npm", "scripts": { "typecheck": "tsc --noEmit", "lint": "node scripts/lint.cjs", "build": "npm run typecheck", "test": "vitest run --reporter=verbose", "test:cover
- `report-ceremony`: `Terrace` / `migrated-gsd` / `expected-blocker` - { "active_feature": "terrace-corpus-smoke", "tier": "large", "budget": { "max_artifacts": 14, "max_words": 6000 }, "artifact_count": 29, "markdown_word_count": 3903, "artifacts": [ { "file": "docs/spec/DECISION-LOG.md", "words": 39, "weak_s
- `ship-check-fast`: `Terrace` / `migrated-gsd` / `expected-blocker` - { "mode": "fast", "passed": false, "project_commands": { "package_manager": "npm", "scripts": { "typecheck": "tsc --noEmit", "lint": "node scripts/lint.cjs", "build": "npm run typecheck", "test": "vitest run --reporter=verbose", "test:cover
- `security-check`: `soundscape-app` / `migrated-gsd` / `expected-blocker` - { "checks": [ "secret-patterns", "env-files", "sensitive-logging", "dependency-audit", "deployment-config" ], "status": "blocked", "artifact": ".terrace/security/latest.json", "markdown": "docs/terrace/security/SECURITY-CHECK.md", "created_

## Lowest Scoring Commands

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
| agent-integration | 21 | 96 | 0.62 | 0 |
| senior-cycle | 147 | 93 | 1 | 0 |
| ui | 21 | 93 | 1 | 0 |
| interrogation | 55 | 92 | 1 | 0 |
| migration | 32 | 89 | 0.97 | 0 |
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
| large-fullstack-ts / migrated-gsd | 54 | 87 | 0.87 | 0 |
| saas-app / migrated-gsd | 54 | 87 | 0.87 | 0 |
| self-hosting-cli / scratch-real | 41 | 86 | 0.83 | 0 |
| large-fullstack-ts / scratch-real | 44 | 86 | 0.82 | 0 |
| app-with-e2e / migrated-gsd | 54 | 86 | 0.89 | 0 |
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
| self-hosting-cli / migrated-gsd | 51 | 85 | 0.67 | 0 |
| typescript-tooling / migrated-gsd | 51 | 85 | 0.67 | 0 |
| typescript-tooling / scratch-real | 41 | 85 | 0.8 | 0 |

## Improvement Backlog

_No product weaknesses or harness issues in this run._

## Raw Evidence Index

- Full JSON summary: `latest-results.json`
- Per-command evidence: `docs/terrace/corpus/runs/2026-05-07T04-42-21-292Z`

## Manual Spot-Check Targets

- `Terrace` / `migrated-gsd` / `help` - pass
- `Terrace` / `scratch-real` / `interrogate` - pass
- `Terrace` / `migrated-gsd` / `align` - pass
- `BBDSE/Signal Lab` / `migrated-gsd` / `help` - pass
