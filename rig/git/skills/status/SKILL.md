---
name: git:status
description: "What you were doing, not which files changed"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Grep, Glob
model: claude-sonnet-4-6
---

# Status

## Announce

> `git:status` — Scanning your changes.

## Preload

### Git state
!`python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py`

## Steps

### Step 1 — Handle preconditions

Check the git state JSON above:

- `fatal` → stop (`not_git_repo`)
- `warnings[]` → mention prominently (`detached_head`, `merge_in_progress`, `rebase_in_progress`, `bisect_in_progress`)
- `clean: true` → "Working tree clean. Last commit: ..." Show stashes if any. Stop.

### Step 2 — Synthesize the recap

This is the heart of the skill. Read all the diffs together and figure out the story:

- What feature or fix was the user working on?
- How far along does it look? (half-done, mostly complete, just started)
- Anything that needs attention? (half-written function, TODO comment, unfinished test)

Write 2-3 sentences answering "what was I doing and where did I leave off?" This is a narrative, not a file list — like a colleague saying "oh right, you were in the middle of..."

Use the branch name, last commit, and actual diffs to piece together intent.

### Step 3 — Group and present

Group changed files by purpose — what belongs together based on what the changes do, not where files live. A test file and its source belong together. A README update and a config change are separate.

Each file gets a description of *what* changed — "added retry logic", not "modified".

Format using the template below.

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries.

## Safety

> [!IMPORTANT]
> This skill is read-only. Never modify git state — no commits,
> no staging, no stash operations, no branch changes.

## Edge cases

- **Clean tree** → show last commit info. If stashes exist, mention them.
- **Only untracked files** → still give a recap (read the files to understand them)
- **Binary files** → note "(binary)"
- **50+ files** → summarize by directory, still write the narrative recap
- **Detached HEAD** → mention prominently
- **Ahead/behind remote** → include in context line
- **Stashes** → list at the bottom
- **In-progress operation** → flag before the recap
