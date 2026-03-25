---
name: status
description: Synthesizes git state into a narrative summary of what you were working on
tools: Read, Grep, Glob, Bash
model: sonnet
---

# Status

## Input

You receive:
- **Skill directory** — the path to this skill's directory on disk
- **Arguments** — user-provided arguments (usually empty)

## Steps

### Step 1 — Gather git state

Run:

```bash
python3 <skill_dir>/scripts/gather.py
```

Replace `<skill_dir>` with the skill directory from your input.

Handle preconditions from the JSON:

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

Follow this format exactly when presenting a status summary. The goal is a quick,
scannable view that answers "what was I working on?" and "what's the state of my changes?"

### Full example

> `git:status` — Scanning your changes.

You were adding JWT-based authentication.
The login flow was rewritten to validate tokens through a new helper module, and rate limiting was wired into the middleware.
Tests are half-done — 3 cases staged, but the error-path tests aren't written yet.

```
  Branch: feature/jwt-auth · Last commit: 3 days ago
  3 areas · 7 files · +87 −12 · 2 staged, 4 unstaged, 1 untracked
  ──────────────────────────────────────────────────────────────────

1  Auth refactor  (unstaged)
     M   src/auth/login.ts              rewrote token validation to use JWT
     M   src/auth/middleware.ts          added rate-limiting check before auth
     A   src/auth/jwt.ts                new JWT helper — sign, verify, decode (+52)

2  Tests  (staged)
     M   tests/auth/login.test.ts       added 3 tests for JWT happy path
     M   tests/fixtures.ts              new test user with expired token

3  Docs
     M   README.md                      updated auth section with JWT setup steps

4  Untracked
     ?   notes.txt                      personal notes (12 lines)

  ──────────────────────────────────────────────────────────────────
  Stashes:
    stash@{0}: WIP on feature/jwt-auth — quick save before meeting (2 days ago)
```

### Format rules

**Announce line**
Rendered as a blockquote outside any code block: `> \`git:status\` — Scanning your changes.`

**Narrative recap**
2-3 sentences outside any code block, each sentence on its own line.
Answers "what was I doing?" — the feature/fix in progress, how far along it looks, anything unfinished.
Keep it conversational — like a colleague catching you up.

**Dashboard header**
Open the code block with the context lines + separator:
```
  Branch: <branch> · Last commit: <time ago>
  <N> areas · <N> files · +<N> −<N> · <N> staged, <N> unstaged, <N> untracked
  ──────────────────────────────────────────────────────────────────
```

If tracking a remote and ahead/behind:
```
  Branch: feature/auth · Last commit: 3 days ago · 2 ahead, 1 behind origin
```

**Change groups**
Number them sequentially. No blank line between the group name and its files:
```
1  Auth refactor  (unstaged)
     M   src/auth/login.ts              rewrote token validation to use JWT
     A   src/auth/jwt.ts                new JWT helper (+52)
     D   src/auth/old-auth.ts           (deleted)
     R   config.js → config.ts          converted to TypeScript
     ?   scratch.py                     untracked — experiment file (30 lines)
```

- `A` = new, `M` = modified, `D` = deleted, `R` = renamed, `?` = untracked
- The description says *what* changed, not just that it changed
- Binary files: `(binary)` instead of a description; large files: mention size

**Staging indicators on groups**
- `(staged)` — all files staged
- `(unstaged)` — none staged
- `(partially staged)` — mix of staged and unstaged
- `(untracked)` — all new/untracked
- Omit if the entire tree has only one staging state

**Stashes**
Close the code block with a separator + stash list:
```
  ──────────────────────────────────────────────────────────────────
  Stashes:
    stash@{0}: WIP on feature/auth — quick save before meeting (2 days ago)
    stash@{1}: experiment with caching (5 days ago)
```

If no stashes, close with just the separator line.

**50+ files**
Summarize by directory inside the code block:
```
1  API overhaul  (unstaged)
     src/api/          12 files    +340 −89     new REST endpoints
     src/middleware/     4 files    +67 −23      request validation
     tests/api/          8 files    +210 −0      endpoint tests
```

**In-progress operations**
Flag before the recap (outside code block):
```
⚠ Mid-rebase onto main — 2 of 5 commits applied. Use `git:deconflict` to continue.
```

**Clean tree**

> `git:status` — Scanning your changes.

Working tree clean. Last commit: `a1b2c3d` feat(auth): add JWT validation (3 days ago)

If stashes exist on a clean tree, still show them.

**Detached HEAD**
```
  Branch: (detached at a1b2c3d) · Last commit: 2 hours ago
```

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
