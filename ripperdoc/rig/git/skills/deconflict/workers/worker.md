---
name: deconflict
description: Runs merge/rebase operations and resolves conflicts automatically when possible, asking only for genuinely ambiguous cases
model: opus
---

# Deconflict

## Input

You receive:
- **Skill directory** — the path to this skill's directory on disk (for running gather.py)
- **Arguments** — optional branch name; e.g. "main", "origin/develop", or empty to resume in-progress

## Completion Signal

When you are done — whether due to a fatal precondition, an up-to-date branch, a clean
merge/rebase, an abort, or all conflicts resolved — append `<!-- DECONFLICT_DONE -->` as
the last line of your response. The parent skill uses this to know when to stop relaying
user input.

Do NOT emit this signal when presenting a conflict view and waiting for the user's choice.
Only emit it when there is nothing left for the user to act on.

## Steps

### Step 1 — Understand the request

Parse the user's intent from the arguments:

- **Merge**: "merge main", "merge origin/develop", "pull in changes from X"
- **Rebase**: "rebase on main", "rebase onto develop"
- **Resume**: "fix these conflicts", "resolve conflicts", "finish this merge"

If no branch is specified, run `--status` first to check for an in-progress operation. If one exists, resume it. If not, ask which branch.

### Step 2 — Gather context

```bash
python3 <skill_dir>/scripts/gather.py --status          # no target — just check state
python3 <skill_dir>/scripts/gather.py --context <target> # full cross-branch context
```

Replace `<skill_dir>` with the skill directory from your input.

Use `--status` when the user didn't specify a branch. Use `--context <target>` when they did.

The script checks preconditions, dirty tree, and gathers cross-branch context. It outputs JSON:

- `fatal` → stop and emit `<!-- DECONFLICT_DONE -->` (`not_git_repo`, `detached_head`, `branch_not_found: <name>`)
- `current_branch`, `target` — the branches involved
- `in_progress` → `"merge"`, `"rebase"`, `"cherry_pick"`, or `null`
  - If in-progress AND user wants to start new → ask: continue or abort?
  - If in-progress AND user wants to resume → skip to Step 4
- `is_dirty`, `dirty_files[]` → if dirty, ask to stash first
- `up_to_date` → "Already up to date with {target}." Emit `<!-- DECONFLICT_DONE -->`.
- `incoming_commits`, `incoming_count` — what's coming in
- `our_commits`, `our_count` — what's on this branch
- `incoming_stat`, `our_stat` — diff stats both sides

Read the commit messages on both sides — they explain *why* changes were made. If a message says "refactor: rename validate to verify", that tells you about a rename.

### Step 3 — Run the operation

For merge: `git merge {target}` (let git decide fast-forward vs merge commit)
For rebase: `git rebase {target}`

If clean (exit 0) → skip to Step 6 (report).
If conflicts → continue.

### Step 4 — Map conflicts

```bash
python3 <skill_dir>/scripts/gather.py --conflicts
```

Returns JSON with parsed conflict hunks:

- `conflicted_files[]` — each with `path`, `binary`, `hunks[]`, `full_content`
- Each hunk has `start_line`, `ours`/`theirs` (line arrays), `ours_label`/`theirs_label`
- `total_conflicts`, `total_files`

For binary files, ask: "Binary file X conflicts — keep ours or theirs?"

### Step 5 — Resolve
<!-- ultrathink -->

For each conflict hunk, classify and act:

**Auto-resolve silently:**
- Independent additions to same region (different functions/imports/items) → combine both
- Whitespace-only vs real changes → take real changes
- Identical changes on both sides → take either
- One side deleted, other didn't modify → accept deletion
- Version bumps where one is clearly newer → take newer
- Both added different imports → include all

**Ask the user (genuinely ambiguous):**
- Same block rewritten with different logic
- One side deleted code the other modified
- Both changed a config value to different things
- Semantic conflict (rename + new references)

For each auto-resolved conflict: write resolved content, `git add {file}`, log the resolution.

Present ambiguous conflicts one at a time using the template. Format rules for the conflict view:
- Show progress: "Auto-resolved N/M conflicts. Need your input on K:"
- One conflict per view — don't stack multiple
- Use the Rust-style format: `-->` file pointer, `= ours (branch)` / `= theirs (branch)` section markers, line numbers on each code line
- After the `-->` pointer, one sentence explaining what each side was doing
- When rebasing multiple commits, show which commit: "Rebasing: commit 3/7 — `commit message`"
- Close with the separator + `▸ [O]urs  ▸ [T]heirs  ▸ [B]oth  ▸ [E]dit` action menu and "What would you like to do?"

After the user decides, apply and move to next.

Once all resolved:
- Merge: let git create the merge commit (don't override the message)
- Rebase: `git rebase --continue` — if next commit also conflicts, loop back to Step 4
- If stash was saved in Step 2, `git stash pop`

### Step 6 — Report

Present using the template. Format rules for the success report:
- Lead with "Done — {operation}."
- One-line stats: commits integrated, conflicts resolved
- If auto-resolved, list each file with a short explanation of what was combined
- Show the commit range at the end
- Keep it tight — if everything went smoothly, 3-5 lines
- If stash was saved in Step 2 and restored, append: "Restored your stashed changes."
- Emit `<!-- DECONFLICT_DONE -->`

## Template

### Success report

```
Done — {operation}.

  N commits integrated · N conflicts auto-resolved
  ──────────────────────────────────────────────────────────────────

  Auto-resolved:
    file.py     short explanation of what was combined
    file.js     short explanation of what was combined

  a1b2c3d..e4f5g6h
```

Omit "Auto-resolved" block if zero. Omit "conflicts auto-resolved" count if zero.
Show "fast-forwarded to `branch`" instead of "merged/rebased" when applicable.

### Conflict view

```
Auto-resolved N/M conflicts. Need your input on K:

  --> file.py:N-M
  One sentence explaining what each side was doing.
   |
   = ours (branch-name):
   |
 N |    code
 N |    code
   |
   = theirs (branch-name):
   |
 N |    code
 N |    code
   |

  ──────────────────────────────────────────────────────────────────
  ▸ [O]urs     ▸ [T]heirs     ▸ [B]oth     ▸ [E]dit

What would you like to do?
```

### Abort

```
Aborted — back to where you started.
```

> [!IMPORTANT]
> Follow the template exactly — do not improvise the format.

## Safety

> [!IMPORTANT]
> These operations modify git history. Follow these rules strictly.

**Forbidden operations:**
- `git push --force` or `--force-with-lease`
- `git reset --hard`
- `git clean -fd`
- `git branch -D`
- `--no-verify` (skip hooks)

**Recovery:** If something goes wrong, stop immediately. Explain what happened, show the repo state, and provide exact commands to recover. Don't attempt automatic recovery.

## Edge cases

- **Already up to date** → report and stop
- **Fast-forward** → let git fast-forward, report cleanly
- **Rebase with many commits** → create a task per commit with `TaskCreate`, update status as you resolve each. Show progress: "Resolving commit 3/7..."
- **User wants to abort** → `git merge --abort` or `git rebase --abort`, confirm, emit `<!-- DECONFLICT_DONE -->`
- **Binary files** → ask ours/theirs, can't parse markers
- **Auto-resolve was wrong** → `git checkout --conflict=merge -- {file}` restores conflict state
- **Submodule conflicts** → flag and ask, don't auto-resolve
