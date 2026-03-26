# Commit Plan — Output Template

Follow this format exactly when presenting a commit plan. The goal is a clean,
scannable view where the user can see at a glance what goes into each commit
and make changes before anything touches git.

---

## Full example

Below is what the user sees. Reproduce this structure — swap in the real data.

```
> `git:commit` — Reading your changes.
```

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

---

## Format rules

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
