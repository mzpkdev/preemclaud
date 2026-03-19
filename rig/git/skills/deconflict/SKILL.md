---
name: git:deconflict
description: "Merge or rebase that resolves conflicts for you"
user-invocable: true
disable-model-invocation: true
argument-hint: "[branch]"
allowed-tools: Bash(git *), Bash(python3 *), Read, Edit, TaskCreate, TaskUpdate
---

# Deconflict

## Announce

> `git:deconflict` — Reading the situation.

Most conflicts aren't hard — one side added a function, the other changed a docstring. This skill reads both sides, understands intent from commit messages and diff context, and resolves automatically. It only stops to ask when both sides changed the same logic in incompatible ways.

## Steps

### Step 1 — Understand the request

Arguments: `$ARGUMENTS`

Parse the user's intent:

- **Merge**: "merge main", "merge origin/develop", "pull in changes from X"
- **Rebase**: "rebase on main", "rebase onto develop"
- **Resume**: "fix these conflicts", "resolve conflicts", "finish this merge"

If no branch is specified, run `--status` first to check for an in-progress operation. If one exists, resume it. If not, ask which branch.

### Step 2 — Gather context

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py --status          # no target — just check state
python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py --context <target> # full cross-branch context
```

Use `--status` when the user didn't specify a branch. Use `--context <target>` when they did.

The script checks preconditions, dirty tree, and gathers cross-branch context. It outputs JSON:

- `fatal` → stop (`not_git_repo`, `detached_head`, `branch_not_found: <name>`)
- `current_branch`, `target` — the branches involved
- `in_progress` → `"merge"`, `"rebase"`, `"cherry_pick"`, or `null`
  - If in-progress AND user wants to start new → ask: continue or abort?
  - If in-progress AND user wants to resume → skip to Step 4
- `is_dirty`, `dirty_files[]` → if dirty, ask to stash first
- `up_to_date` → "Already up to date with {target}." Stop.
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
python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py --conflicts
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

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

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
- **User wants to abort** → `git merge --abort` or `git rebase --abort`, confirm
- **Binary files** → ask ours/theirs, can't parse markers
- **Auto-resolve was wrong** → `git checkout --conflict=merge -- {file}` restores conflict state
- **Submodule conflicts** → flag and ask, don't auto-resolve
