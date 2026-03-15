---
name: git:commit
description: "Smart git commit — groups dirty files into logical commits, shows a preview plan with proposed messages, and waits for approval before committing anything. Use whenever the user says /commit, 'commit this', 'commit my changes', 'save my work', 'stage and commit', or wants to commit their changes to git. Also trigger when the user has been working on changes and says 'let's save this', 'wrap this up', or 'done with these changes'."
user-invocable: true
disable-model-invocation: true
---

# Commit

## Announce

> `git:commit` — Reading your changes.

## What this skill does

Groups dirty files into logical commits, shows a clear preview with proposed messages, and only commits after the user approves. The goal is to save the user from writing commit messages manually while giving them full control over what goes into each commit.

Read `references/safety.md` before doing anything — it has precondition checks and file scanning rules you need to follow.

## Step 1 — Preconditions

Run the checks from `references/safety.md`:
- Is this a git repo?
- Is HEAD detached?
- Is there an in-progress merge/rebase/bisect?

If any check fails, stop and tell the user what's wrong and how to fix it.

## Step 2 — Gather dirty files

Run these in parallel:
- `git status --porcelain` — all dirty files
- `git diff --stat` — unstaged change summary
- `git diff --cached --stat` — staged change summary

If nothing is dirty: "Nothing to commit — working tree clean." Stop here.

Categorize every dirty file from the porcelain output:
- **Staged**: first column is `A`/`M`/`D`/`R` (user deliberately staged these)
- **Modified**: second column shows changes (tracked but not yet staged)
- **Untracked**: line starts with `??`
- **Deleted**: `D` in status

Important: if the user already staged specific files, those form a pre-set group. Don't re-sort them — the user already made that grouping decision. Group only the remaining dirty files.

## Step 3 — Safety scan

Check every candidate file against the patterns in `references/safety.md`. If anything is flagged, present the warnings using the "Flagged Files" table format from `TEMPLATE.md` — file, issue, and suggestion in a clean table, followed by the three options (include / skip / .gitignore).

Never skip a file without telling the user.

## Step 4 — Read the diffs

For files that passed the safety scan, read the actual changes:
- Staged files: `git diff --cached -- <file>`
- Unstaged modified files: `git diff -- <file>`
- Untracked files: read the file content
- Deleted files: note the deletion

You need the diffs to group intelligently and write accurate messages. For large diffs (>500 lines in a single file), read the stat summary and the first/last 50 lines rather than loading the entire diff.

## Step 5 — Detect repo conventions

Read `references/conventions.md` and follow the detection steps. Run `git log --oneline -20` to learn how this repo writes commits, then match the style.

## Step 6 — Group into commits

Look at all the changes and decide: one logical unit, or several?

**Signals changes belong together:**
- Same feature or bug fix
- A source file and its test
- Tightly coupled files (component + styles, migration + model)

**Signals changes should be separate:**
- Unrelated concerns (feature work vs config vs docs)
- Different modules or domains
- Different types of change (a bug fix mixed with a refactor)

Guidelines:
- If the user pre-staged files, that's commit 1 — don't second-guess it
- When in doubt, fewer commits is better than many tiny ones
- The user can always ask to split further

## Step 7 — Present the commit plan

This is the key moment. Read `TEMPLATE.md` (in this skill's directory) and follow its format exactly. It defines the full layout: summary line, commit headers, file tables, safety warnings, action prompt, and execution report.

The template is the source of truth for how the plan looks. Don't improvise the format.

## Step 8 — Handle adjustments

The user might want to tweak the plan before approving. The template defines single-letter aliases (`E`, `M`, `J`, `S`, `D`) for quick edits, plus `A`, `D`, `I` for flagged files. Accept both the aliases and plain English — the aliases are a shortcut, not a requirement.

When the user uses a glob pattern (like `D *.json`), expand it against the files in the plan and apply to all matches.

After any change, re-show the full updated plan using the same template format and wait for approval again. Keep going until the user says something like "go", "looks good", "approve", "do it", "ship it", or "commit".

## Step 9 — Execute

Once approved:

1. Clear any existing staging so we start clean:
   ```
   git restore --staged .
   ```
2. For each commit in the plan, in order:
   ```
   git add <file1> <file2> ...
   git commit -m "$(cat <<'EOF'
   the commit message here
   EOF
   )"
   ```
3. After all commits, show the result:
   ```
   Done — 2 commits created:
     a1b2c3d feat(auth): add login token validation
     e4f5g6h docs: update README with auth section
   ```

If any dirty files weren't part of the plan, mention them:
"You still have uncommitted changes in: `.eslintrc.json`"

## Edge cases

- **Nothing dirty** → "Nothing to commit." Stop.
- **Only deletions** → handle normally, `git add` tracks deletions
- **Binary files** → include in plan, note "(binary)", can't show diff
- **Renamed files** → show as `R  old → new`
- **Merge in progress** → precondition check catches this
- **Very large working tree (>50 files)** → summarize by directory, still require approval
