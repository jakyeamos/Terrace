---
name: terrace-interrogate
description: Gather user input for edge-case, assumption-challenge, and failure-mode interrogation.
argument-hint: <feature>
---

# Terrace Interrogate

Run `terrace interrogate $ARGUMENTS --json` first to get repo-informed interrogation questions.

If Terrace reports `INTERROGATION_REQUIRES_USER_INPUT`, do not tell the user to rerun a command. Ask the returned questions in this chat, wait for the user answers, then run `terrace interrogate $ARGUMENTS --answers-file <captured-answer-file> --json` yourself.

Use the answers as the authority. Repository analysis may suggest risks and prompts, but it must never replace user input for interrogation.

Inspect Terrace blockers, warnings, generated files, and next-command output before continuing. Do not bypass Terrace gates or claim success when the command reports blockers.
