---
version: "1.0"
artifact: GSD-PATTERNS
last_updated: "2026-04-07"
source: "terrace-research/get-shit-done/"
status: authoritative
---

# GSD Patterns Adopted by Terrace

## pattern_01: file-as-message-bus
source: gsd workflows write markdown artifacts as state
adoption: terrace artifacts are durable state carriers between sessions
departure: terrace adds phase-delta validation and routing metadata

## pattern_02: cli-as-structured-write-path
source: gsd-tools.cjs deterministic file writes
adoption: terrace CLI writes explicit manifests and machine-readable outputs
departure: terrace enforces allowlisted write roots (.terrace/, docs/)

## pattern_03: single-entry orchestration
source: command dispatcher in gsd-tools.cjs
adoption: terrace uses one entry point with subcommands
departure: terrace adds JSON mode contracts for automation consumers

## pattern_04: phase-gated delivery
source: gsd phased milestones
adoption: terrace delivers in discrete plans with verification checkpoints
departure: terrace defines phase-delta RED rules across phases

## pattern_05: local-first operations
source: gsd filesystem-first workflows
adoption: terrace resolves and validates artifacts locally before escalation
departure: terrace includes explicit usage/routing surfaces in later phases

## modification_policy
gsd_01: never silently mutate GSD-owned files
gsd_02: when GSD compatibility requires change, log rationale
gsd_03: prefer additive overlays over invasive rewrites
gsd_04: fail fast on unsafe patch targets
gsd_05: publish remediation path with each blocking diagnostic
gsd_06: keep interoperability tests in phase validation
gsd_07: non-patchable files must exit non-zero with exact path
