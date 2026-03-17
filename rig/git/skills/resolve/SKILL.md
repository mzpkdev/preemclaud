---
name: git:resolve
description: "Autonomous merge and rebase — initiates the git operation, reads both sides of any conflicts, and resolves them by understanding intent. Only stops to ask if a conflict is genuinely ambiguous. Use whenever the user says /resolve, 'merge main', 'rebase on main', 'pull in changes from X', 'sync with main', 'update my branch', 'catch up with main', or wants to bring changes from another branch into their current one. Also trigger when the user is stuck mid-merge or mid-rebase with conflicts and says 'help me finish this merge', 'fix these conflicts', 'resolve conflicts', 'my merge is broken', or 'ugh conflicts'. Even casual mentions like 'merge in the latest from develop' or 'rebase before I push' should trigger this skill."
user-invocable: true
disable-model-invocation: true
---

# Resolve

## Announce

> `git:resolve` — Reading the situation.

Most conflicts aren't hard — one side added a function, the other changed a docstring. This skill reads both sides, understands intent from commit messages and diff context, and resolves automatically. It only stops to ask when both sides changed the same logic in incompatible ways.

## Steps

### Step 1 — Understand the request

Parse the user's intent:

- **Merge**: "merge main", "merge origin/develop", "pull in changes from X"
- **Rebase**: "rebase on main", "rebase onto develop"
- **Resume**: "fix these conflicts", "resolve conflicts", "finish this merge"

If just "resolve" with no branch, check for in-progress operation first. If one exists, resume it. If not, ask which branch.

### Step 2 — Gather context

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py --context <target>
```

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

For merge: `git merge {target}`
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

Present ambiguous conflicts one at a time using the template (O/T/B/E menu). After the user decides, apply and move to next.

Once all resolved:
- Merge: let git create the merge commit (don't override the message)
- Rebase: `git rebase --continue` — if next commit also conflicts, loop back to Step 4
- If stash was saved in Step 2, `git stash pop`

### Step 6 — Report

Present using the template. Show: operation completed, commits integrated, auto-resolved conflicts (one-line each), user-resolved count. Mention stash pop if applicable.

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries. ALWAYS end with the action menu AND
> follow-up question.

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
- **Rebase with many commits** → show progress: "Resolving commit 3/7..."
- **User wants to abort** → `git merge --abort` or `git rebase --abort`, confirm
- **Binary files** → ask ours/theirs, can't parse markers
- **Auto-resolve was wrong** → `git checkout --conflict=merge -- {file}` restores conflict state
- **Submodule conflicts** → flag and ask, don't auto-resolve
