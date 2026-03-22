---
description: "Auto-group changes into logical commits"
user-invocable: true
disable-model-invocation: true
argument-hint: "[optional message — omit for auto-grouping]"
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git restore *), Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git rev-parse *), Bash(git symbolic-ref *), Bash(python3 *)
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "git log -1 --format='%h %s' 2>/dev/null || true"
---

# Commit

## Announce

> `git:commit` — Reading changes on `!`git branch --show-current``.

## Preload

### Git state
!`python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py`

## Steps

### Step 1 — Handle preconditions and flags

Check the git state JSON above:

- `precondition_failures` → stop and tell the user (`not_git_repo`, `detached_head`, `merge_in_progress`, `rebase_in_progress`, `bisect_in_progress`)
- `clean: true` → "Nothing to commit — working tree clean." Stop.
- `flagged_count > 0` → show the Flagged Files table (see template)

Flag types: **secrets** (skip + .gitignore), **large** (skip), **build** (skip + .gitignore), **junk** (skip + .gitignore), **lock** (flag only, don't skip — often intentional). Never skip without telling the user.

### Step 2 — Group and write messages

**Detect conventions** from `recent_commits`: if >60% follow a pattern, match it. If there are no prior commits (new repo), default to `type(scope): message`, imperative, lowercase. Infer type from diff content (feat/fix/refactor/test/docs/chore/ci/style/perf). Infer scope from branch ticket patterns or primary area changed.

**Group files** into logical commits. Signals they belong together: same feature/fix, source + test, tightly coupled files. Signals they're separate: unrelated concerns, different modules, mixed change types.

- Pre-staged files (`staged_count > 0` with other dirty files) = commit 1, don't re-sort
- When in doubt, fewer commits beats many tiny ones

### Step 3 — Present the commit plan

Format using the template below, then wait for approval.

The template defines aliases (E/M/J/S/D for plan edits, A/D/I for flagged files). Accept aliases and plain English. Globs expand against files in the plan. After any change, re-show the full plan and wait again.

### Step 4 — Execute

Once the user approves ("go", "looks good", "ship it"):

1. `git restore --staged .`
2. For each commit: `git add <files> && git commit -m "$(cat <<'EOF'\nthe message\nEOF\n)"`
3. Show execution report (short hashes + messages)
4. Mention any remaining dirty files not in the plan

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
