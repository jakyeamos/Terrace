# Parallel Phase Execution

Terrace keeps the normal sequential phase path as the default. The opt-in parallel path is available only when Terrace can prove that each worker has an isolated worktree, explicit file ownership, and an ordered dependency wave.

Terrace creates the branches and worktrees; it does not launch agent processes or coordinate external systems. An agent or developer runs the plan inside the returned worktree, commits the implementation and its plan summary, and asks Terrace to verify and merge it.

## Plan contract

Each phase plan must declare the files it owns. `source_ref` and file references inferred from source documents are advisory and never count as ownership. A plan may also declare dependencies and, optionally, a wave:

```json
{
  "id": "api",
  "title": "Build the API surface",
  "files": ["src/api/**", "tests/api/**"],
  "depends_on": [],
  "wave": 1
}
```

The metadata may live on the phase's `plans` entries in `.terrace/state.json`. For migrated or generated plans, the same fields may be supplied as phase-local overrides under `parallel_execution.plans` (an array or an object keyed by plan id).

Terrace fails closed when:

- a plan has no explicit `files`, `owned_files`, or `file_ownership` entry;
- two plans claim the same file or one claims a path inside the other;
- a dependency is missing, self-referential, cyclic, or ordered in the wrong wave;
- explicit waves are partial, non-contiguous, or do not place dependencies earlier;
- a plan id or owned path is unsafe for a branch/worktree;
- ownership includes `.terrace/**`, `.planning/**`, or another canonical phase artifact.

If no explicit waves are present, Terrace derives topological waves from `depends_on`. Plans with no dependencies share wave 1. If every plan declares a wave, waves must start at 1 and be contiguous.

## Run a phase

Preview the contract before creating any worktrees:

```sh
terrace parallel plan <phase-id> --json
```

Start the opt-in mode through the normal phase command:

```sh
terrace phase execute <phase-id> --parallel --json
```

The command records a `parallel_runs` entry in `.terrace/state.json`, writes the phase execution queue, and creates worktrees only for wave 1. Worktrees live outside the canonical checkout at:

```text
<git-root-parent>/.terrace-worktrees/<repo>/<run-id>/<plan-id>
```

The response includes the exact `worktree` and `branch` for each ready plan. Run each independent plan in its own returned worktree. The worker must commit both its implementation and the exact plan summary path shown in the response:

```text
docs/terrace/phases/<phase-id>/plans/<plan-id>/SUMMARY.md
```

Inspect readiness before merging:

```sh
terrace parallel status <run-id> --json
```

Terrace requires a clean worker worktree, a branch tip descended from the recorded wave base, at least one worker commit, a non-empty committed `SUMMARY.md`, and no changed files outside the plan ownership plus that summary.

## Merge and ordering

```sh
terrace parallel merge <run-id> --json
```

Merge is deterministic: waves are processed in ascending order, and plans inside a wave are processed by ascending plan id. Each worker is merged with a non-fast-forward merge commit. Terrace refuses to merge when the canonical worktree contains unrelated changes, worker ownership is violated, or actual worker diffs overlap.

After a successful wave, Terrace creates the next wave from the new canonical `HEAD`. A dependent plan therefore cannot start before its dependency's verified merge. State, events, roadmap execution metadata, and canonical phase artifacts remain single-writer data owned by the canonical checkout; workers may only add their own `SUMMARY.md` under the allowed phase plan path.

When all waves are merged, Terrace marks the run `merged` and points to the existing sequential continuation:

```sh
terrace phase validate <phase-id>
terrace phase review <phase-id>
terrace phase complete <phase-id>
```

## Recovery and cleanup

If the process stops after worktrees or branches exist, inspect and reattach them:

```sh
terrace parallel status <run-id> --json
terrace parallel resume <run-id> --json
```

Resume reconciles Git's worktree registry with the recorded branch names and reattaches missing worker directories when the branch is still present. It never revives an explicitly failed or terminal run.

If a worker cannot finish, preserve its evidence and mark the run failed:

```sh
terrace parallel fail <run-id> <plan-id> --reason "<reason>" --json
terrace parallel cleanup <run-id> --json
```

Cleanup removes worktrees. Merged branches are deleted after their merge; unmerged branches are preserved by default so the sequential fallback or a later inspection can use them. `--force` is required to remove unmerged branches or discard uncommitted worker files.

If a merge conflict or ownership violation occurs, Terrace leaves worker branches available and returns a blocker. Resolve the plan boundary or abandon the parallel run explicitly; Terrace does not auto-resolve conflicts and does not silently fall back to a merge that has not passed verification.

The sequential fallback remains:

```sh
terrace phase execute <phase-id>
```

Use it after a failed run has been cleaned up. Parallel execution is local and advisory: it does not push branches, deploy, release, or contact external agents.
