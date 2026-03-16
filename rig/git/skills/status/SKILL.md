---
name: git:status
description: "Intelligent diff summary — reads your changes, understands what you were working on, and gives you a plain-English recap grouped by purpose. Use whenever the user says 'what did I change', 'what's on my diff', 'show my changes', 'what was I working on', 'where did I leave off', 'status', 'what's going on in my repo', 'summarize my changes', or wants to understand their uncommitted work before committing or resuming. Also trigger when someone comes back to a branch after a break and needs to get re-oriented."
---

# Status

## Announce

> `git:status` — Scanning your changes.

## What this skill does

Reads the working tree and tells the user what they were working on in plain English. The user might be coming back after a weekend, switching between branches, or just wanting a clear picture before committing. The output has two jobs:

1. **Recap** — a short narrative at the top that answers "what was I doing here?" by reading the actual diffs and understanding the intent behind the changes, not just listing files.
2. **Grouped file list** — changes organized by purpose (not alphabetically), with a one-line description of what each file change actually does.

This skill is read-only — it never touches git state.

Read `references/safety.md` for precondition checks.

## Step 1 — Preconditions

Quick checks:
- Is this a git repo? If not, stop.
- Is HEAD detached? Mention it.
- Is there an in-progress merge/rebase? Mention it at the top — the user may have forgotten.

## Step 2 — Gather state

Run these in parallel:

- `git status --porcelain` — all dirty files
- `git diff --stat` — unstaged summary
- `git diff --cached --stat` — staged summary
- `git log --oneline -1 --format="%h %s (%cr)"` — last commit + how long ago
- `git branch --show-current` — current branch name
- `git stash list` — any stashes (people forget about these)
- `git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null` — ahead/behind remote (if tracking branch exists)

If nothing is dirty and there are no stashes: "Working tree clean. Last commit: `<hash> <message>` (<time ago>)." Stop here.

## Step 3 — Read the diffs

For each changed file, read the actual diff to understand what changed:

- Staged: `git diff --cached -- <file>`
- Unstaged: `git diff -- <file>`
- Untracked: read the file content (first 80 lines if large)
- Deleted: note what was removed

For very large diffs (>500 lines in a single file), read `git diff --stat` for that file plus the first and last 50 lines of the diff. That's enough to understand intent without flooding context.

## Step 4 — Synthesize the recap

This is the heart of the skill. Read all the diffs together and figure out the story:

- What feature or fix was the user working on?
- How far along does it look? (half-done, mostly complete, just started)
- Is there anything that looks like it needs attention? (a half-written function, a TODO comment, a test that's been started but not finished)

Write 2-3 sentences that answer "what was I doing and where did I leave off?" This isn't a list of files — it's a narrative that helps the user mentally reload their context. Think of it like a colleague saying "oh right, you were in the middle of..."

Use the branch name, commit messages, and the actual code changes to piece together the intent. The branch name often hints at the feature (e.g., `feature/jwt-auth`, `fix/rate-limit-bug`).

## Step 5 — Group and present

Group changed files by purpose — figure out what belongs together based on what the changes actually do, not where the files live. A test file and its source file belong in the same group. A README update and a config change are separate.

Present using the **## Template** section below.

Each file gets a short description of what actually changed — not "modified" (the user can see that), but what the modification does: "added retry logic", "removed deprecated endpoint", "new test for edge case".

## Edge cases

- **Clean tree** → Show last commit info and stop. If there are stashes, mention them.
- **Only untracked files** → Still give a recap if possible (read the files to understand what they are).
- **Binary files** → Note them as "(binary)" — can't summarize content.
- **Very large working tree (>50 files)** → Summarize by directory, mention total counts. Still write the narrative recap.
- **Detached HEAD** → Mention it prominently — the user might not realize.
- **Ahead/behind remote** → Include in the context line so the user knows if they need to push/pull.
- **Stashes** → List them briefly at the bottom — stale stashes are easy to forget about.
- **In-progress operation** → Flag at the top (e.g., "You're mid-rebase on main — 2 of 5 commits applied").

## Template

Read `TEMPLATE.md` for the status output format.

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries.
