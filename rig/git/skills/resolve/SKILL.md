---
name: git:resolve
description: "Autonomous merge and rebase — initiates the git operation, reads both sides of any conflicts, and resolves them by understanding intent. Only stops to ask if a conflict is genuinely ambiguous. Use whenever the user says /resolve, 'merge main', 'rebase on main', 'pull in changes from X', 'sync with main', 'update my branch', 'catch up with main', or wants to bring changes from another branch into their current one. Also trigger when the user is stuck mid-merge or mid-rebase with conflicts and says 'help me finish this merge', 'fix these conflicts', 'resolve conflicts', 'my merge is broken', or 'ugh conflicts'. Even casual mentions like 'merge in the latest from develop' or 'rebase before I push' should trigger this skill."
user-invocable: true
disable-model-invocation: true
---

# Resolve

## Announce

> `git:resolve` — Reading the situation.

## What this skill does

Handles merge and rebase operations autonomously. The user says "merge main" and this skill does the rest — initiates the operation, auto-resolves conflicts it understands, and only interrupts the user for genuinely ambiguous ones.

The philosophy: most conflicts aren't hard. One side added a function, the other changed a docstring — a human developer resolves these on autopilot. This skill does the same. It reads both sides, understands what each was trying to do (using commit messages and diff context), and resolves. The user only sees a prompt when there's a real decision to make — when both sides changed the same logic in incompatible ways.

Read `references/safety.md` for forbidden operations and recovery guidance. This skill has its own precondition logic — it expects to find (or create) merge/rebase state, unlike the commit skill which treats that as an error.

## Step 1 — Understand the request

Parse what the user wants:

- **Merge**: "merge main", "merge origin/develop", "pull in changes from X"
- **Rebase**: "rebase on main", "rebase onto develop"
- **Resume**: "fix these conflicts", "resolve conflicts", "finish this merge"

If the user just says "resolve" without a branch, check for an in-progress operation first. If one exists, resume it. If not, ask which branch.

## Step 2 — Preconditions

1. **Git repo?** — `git rev-parse --git-dir`. If not → stop.
2. **Detached HEAD?** — `git symbolic-ref -q HEAD`. If detached → stop, explain.
3. **Already mid-operation?**
   - Check for `.git/MERGE_HEAD`, `.git/rebase-merge/`, `.git/rebase-apply/`, `.git/CHERRY_PICK_HEAD`
   - If found AND user asked to start a new operation → "There's already a merge/rebase in progress. Want me to continue resolving it, or abort first?"
   - If found AND user asked to resolve/fix → skip to Step 5
4. **Dirty working tree?** — `git status --porcelain`
   - If uncommitted changes exist → "You have uncommitted changes. I need a clean working tree to start. Want me to stash them first?"
   - If yes → `git stash` and remember to pop after completion

## Step 3 — Gather context

Before starting, understand what's being merged. Run in parallel:

```
git log --oneline HEAD..{target} -- # commits coming in
git log --oneline {target}..HEAD -- # commits on this branch
git diff --stat HEAD...{target}     # what the target changed
git diff --stat {target}...HEAD     # what this branch changed
```

Read the commit messages on both sides. They explain *why* changes were made — this context is essential for resolving conflicts correctly later. If a commit message says "refactor: rename validate to verify", that tells you a rename happened and references to the old name should update.

## Step 4 — Run the operation

For merge:
```
git merge {target}
```

For rebase:
```
git rebase {target}
```

If it completes cleanly (exit code 0) → skip to Step 8 (report success).

If conflicts → continue to Step 5.

## Step 5 — Map the conflicts

List all conflicted files:
```
git diff --name-only --diff-filter=U
```

For each conflicted file:
- Read the file to see the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
- Count how many conflict hunks exist in the file
- Cross-reference with the context from Step 3 to understand what each side was doing

## Step 6 — Resolve autonomously

For each conflict hunk, read both sides and classify it.

**Auto-resolve — do it silently:**

| Pattern | Resolution |
|---------|------------|
| Both sides added code to the same region, but the additions are independent (different functions, different list items, different imports) | Combine both additions |
| One side only changed whitespace or formatting, the other made real changes | Take the real changes |
| Both sides made identical changes | Take either |
| One side deleted something the other didn't modify | Accept the deletion |
| Version/number bumps where one side is clearly newer | Take the newer version |
| Both sides added different imports | Include all imports |

**Ask the user — genuinely ambiguous:**

| Pattern | Why it's ambiguous |
|---------|--------------------|
| Same function/block rewritten with different logic | Can't know which approach the user prefers |
| One side deleted code the other modified | Deletion might be intentional or might lose needed changes |
| Both sides changed a config value to different things | Business decision, not a code decision |
| Semantic conflict (rename on one side, new references on other) | Needs understanding of the broader refactor |

For each auto-resolved conflict:
1. Write the resolved content to the file (remove conflict markers, combine or choose the right side)
2. `git add {file}`
3. Log what you did and why

If all conflicts in a file are resolved, `git add` the whole file.

## Step 7 — Present ambiguous conflicts (only if needed)

If everything was auto-resolved, skip this step entirely — go to Step 8.

Present conflicts following the **## Template** section below. For each ambiguous conflict:
- Show the file, line range, and both sides with syntax highlighting
- Explain in plain English what each side was trying to do
- Show the action menu

After the user decides:
- Apply their choice
- `git add {file}`
- Move to the next ambiguous conflict, or finish

Once all conflicts are resolved:
- For merge: let git create the merge commit (don't override the auto-generated message)
- For rebase: `git rebase --continue`
- If rebasing and the next commit also has conflicts, loop back to Step 5

## Step 8 — Report

Present the report following the **## Template** section below. Show:
- What operation completed
- How many commits were integrated
- How many conflicts were auto-resolved (with one-line explanations)
- How many the user resolved manually

If a stash was saved in Step 2, pop it now: `git stash pop`. Mention it in the report.

## Edge cases

- **Already up to date** — "Already up to date with {target}." Stop.
- **Fast-forward** — let git fast-forward for merges. Report it cleanly.
- **Rebase with many commits** — conflicts can appear at each commit. Show progress: "Resolving commit 3/7..." Loop through all of them.
- **User wants to abort** — if "abort", "cancel", "stop" → run `git merge --abort` or `git rebase --abort`. Confirm: "Aborted — back to where you started."
- **Binary files** — can't read conflict markers. Ask: "Binary file X conflicts — keep ours or theirs?"
- **Auto-resolve was wrong** — if the user says a resolution looks wrong, `git checkout --conflict=merge -- {file}` restores the conflict state for that file.
- **Submodule conflicts** — flag and ask, don't auto-resolve.

## Template

Read `TEMPLATE.md` for the conflict view and report formats.

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries. ALWAYS end with the action menu AND
> follow-up question.
