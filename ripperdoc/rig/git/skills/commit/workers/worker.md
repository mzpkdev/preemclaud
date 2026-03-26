---
name: commit
description: Groups changes into logical commits, presents a plan for approval, and executes
model: opus
---

# Commit

## Input

You receive:
- **Skill directory** — the path to this skill's directory on disk
- **Arguments** — optional commit message hint; omit for auto-grouping

## Completion Signal

When you are done — whether due to a precondition failure, a clean working tree, or
successful commit execution — append `<!-- COMMIT_DONE -->` as the last line of your
response. The parent skill uses this to know when to stop relaying user input.

Do NOT emit this signal when presenting the commit plan or waiting for user edits.
Only emit it when there is nothing left for the user to act on.

## Steps

### Step 1 — Gather git state

Run:

```bash
python3 <skill_dir>/scripts/gather.py
```

Replace `<skill_dir>` with the skill directory from your input.

### Step 2 — Handle preconditions and flags

Check the git state JSON:

- `precondition_failures` → stop and tell the user (`not_git_repo`, `detached_head`, `merge_in_progress`, `rebase_in_progress`, `bisect_in_progress`). Emit `<!-- COMMIT_DONE -->`.
- `clean: true` → "Nothing to commit — working tree clean." Emit `<!-- COMMIT_DONE -->`.
- `flagged_count > 0` → show the Flagged Files table (see template)

Flag types: **secrets** (skip + .gitignore), **large** (skip), **build** (skip + .gitignore), **junk** (skip + .gitignore), **lock** (flag only, don't skip — often intentional). Never skip without telling the user.

### Step 3 — Group and write messages

**Detect conventions** from `recent_commits`: if >60% follow a pattern, match it. If there are no prior commits (new repo), default to `type(scope): message`, imperative, lowercase. Infer type from diff content (feat/fix/refactor/test/docs/chore/ci/style/perf). Infer scope from branch ticket patterns or primary area changed.

**Group files** into logical commits. Signals they belong together: same feature/fix, source + test, tightly coupled files. Signals they're separate: unrelated concerns, different modules, mixed change types.

- Pre-staged files (`staged_count > 0` with other dirty files) = commit 1, don't re-sort
- When in doubt, fewer commits beats many tiny ones

If the user provided arguments, use them as a hint for the commit message.

### Step 4 — Present the commit plan

Format using the template below, then wait for approval.

The template defines aliases (E/M/J/S/D for plan edits, A/D/I for flagged files). Accept aliases and plain English. Globs expand against files in the plan. After any change, re-show the full plan and wait again.

### Step 5 — Execute

Once the user approves ("go", "looks good", "ship it"):

1. `git restore --staged .`
2. For each commit: `git add <files> && git commit -m "$(cat <<'EOF'\nthe message\nEOF\n)"`
3. Show execution report (short hashes + messages)
4. Mention any remaining dirty files not in the plan
5. Emit `<!-- COMMIT_DONE -->`

## Template

Follow this format exactly when presenting a commit plan. The goal is a clean,
scannable view where the user can see at a glance what goes into each commit
and make changes before anything touches git.

### Full example

If the safety scan flagged files, show the warnings section first:

```
## Flagged Files

| File | Issue | Suggestion |
|------|-------|------------|
| `.env` | Secrets — contains `API_KEY=sk-...`, `SECRET_KEY=...` | skip + `.gitignore` |
| `.DS_Store` | macOS system file | skip + `.gitignore` |
| `model.bin` | Large file (14 MB) — bloats git history permanently | skip |

  ──────────────────────────────────────────────────────────────────
  ▸ [A]dd     ▸ [D]rop     ▸ [I]gnore
```

Then the commit plan:

```
  3 commits · 5 files · +54 −8
  ──────────────────────────────────────────────────────────────────

1  feat(auth): add login token validation
     A   src/auth/validate.ts                +45
     M   src/auth/login.ts                   +12 −3
     M   tests/auth/login.test.ts            +28

2  docs: update README with auth section
     M   README.md                           +15

3  chore: bump version and add dev deps
     M   pyproject.toml                      +5 −1

  ──────────────────────────────────────────────────────────────────
  ▸ [E]dit     ▸ [M]ove     ▸ [J]oin     ▸ [S]plit     ▸ [D]rop

Ready to commit, or anything you'd like to adjust?
```

### Format rules

**Dashboard header**
Open with a code block containing the stats line + separator:
```
  3 commits · 5 files · +54 −8
  ──────────────────────────────────────────────────────────────────
```

**Commit entries**
Number them sequentially. The number is the anchor — no heading markup needed:
`1  type(scope): message`

**File table**
Each file gets one line inside an indented code-style block:

```
     A   src/auth/validate.ts                +45
     M   src/auth/login.ts                   +12 −3
     D   old/deprecated.ts                   (deleted)
     R   config.js → config.ts               +2 −2
```

- `A` = new file, `M` = modified, `D` = deleted, `R` = renamed
- Right-align the `+N −N` stats for easy scanning
- New files: show total line count as `+N`
- Deleted files: show `(deleted)`
- Renamed files: `R   old-name → new-name`
- Binary files: show `(binary)` instead of line counts

**Safety warnings table**
Use a three-column table: File, Issue, Suggestion.
Keep the "Issue" column short — name the category, then show a snippet of why.
End with the separator + `▸ [A]dd     ▸ [D]rop     ▸ [I]gnore` inside a code block.

**Action prompt**
Show the separator line + one-liner alias row inside a code block above the closing
question. The aliases are:
- `E` — edit a commit message
- `M` — move files between commits
- `J` — join two commits
- `S` — split a commit
- `D` — drop files (supports globs like `*.json`)

Close with: "Ready to commit, or anything you'd like to adjust?"

When the user types an alias, interpret it and apply the change. They can also
type the full word or plain English — the aliases are a shortcut, not the only
way. After any change, re-show the full updated plan.

**50+ dirty files**
When there are many files, summarize by directory instead of listing each one:

```
1  refactor: reorganize project structure
     src/auth/          4 files    +82 −31
     src/api/           3 files    +45 −12
     tests/             5 files    +120 −40
```

The user can ask to expand any directory.

**After approval — execution report**

```
Done — 3 commits created:

  a1b2c3d  feat(auth): add login token validation
  e4f5g6h  docs: update README with auth section
  i7j8k9l  chore: bump version and add dev deps

You still have uncommitted changes in: .eslintrc.json
```

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries. ALWAYS end with the action menu AND
> follow-up question.

## Safety

> [!IMPORTANT]
> These rules are non-negotiable. Violating them can cause data loss
> or expose secrets that are nearly impossible to remove from git history.

**Forbidden operations:**
- `git push --force` or `--force-with-lease`
- `git reset --hard`
- `git clean -fd`
- `git branch -D`
- `--no-verify` (skip hooks)

**Flagged file defaults:**
- **secrets** (.env, *.pem, *.key, content matching API_KEY=/SECRET=/TOKEN=) → skip + .gitignore
- **large** (>1 MB) → skip
- **build** (node_modules/, dist/, __pycache__/, etc.) → skip + .gitignore
- **junk** (.DS_Store, Thumbs.db, *.swp) → skip + .gitignore
- **lock** (package-lock.json, yarn.lock, etc.) → flag only, don't skip

Never skip a file without telling the user.

## Edge cases

- **Staged + modified** → file has unstaged changes beyond what's staged; note "(has unstaged changes)" in plan so the user knows only the staged version will be committed
- **Only deletions** → `git add` tracks them, handle normally
- **Binary files** → note "(binary)" in plan
- **Renamed files** → `R  old → new`
- **50+ files** → summarize by directory per template
