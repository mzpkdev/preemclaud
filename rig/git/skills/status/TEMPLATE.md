# Status — Output Template

Follow this format when presenting a status summary. The goal is a quick, scannable
view that answers "what was I working on?" and "what's the state of my changes?"

---

## Full example

```
> `git:status` — Scanning your changes.

You were adding JWT-based authentication. The login flow was rewritten
to validate tokens through a new helper module, and rate limiting was
wired into the middleware. Tests are half-done — 3 cases staged, but
the error-path tests aren't written yet.

  Branch: feature/jwt-auth · Last commit: 3 days ago
  3 areas · 7 files · +87 −12 · 2 staged, 4 unstaged, 1 untracked

**Auth refactor** (unstaged)

     M   src/auth/login.ts              rewrote token validation to use JWT
     M   src/auth/middleware.ts          added rate-limiting check before auth
     A   src/auth/jwt.ts                new JWT helper — sign, verify, decode (+52)

**Tests** (staged)

     M   tests/auth/login.test.ts       added 3 tests for JWT happy path
     M   tests/fixtures.ts              new test user with expired token

**Docs**

     M   README.md                      updated auth section with JWT setup steps

**Untracked**

     ?   notes.txt                      personal notes (12 lines)

Stashes:
  stash@{0}: WIP on feature/jwt-auth — quick save before meeting (2 days ago)
```

---

## Format rules

**Announce line**
Always start with the announce line.

**Narrative recap**
2-3 sentences right after the announce line. Answers "what was I doing?" based on
the actual diffs. Mention:
- The feature/fix being worked on
- How far along it looks
- Anything that seems unfinished or needs attention

Keep it conversational — like a colleague catching you up.

**Context line**
One line with branch, last commit age, and stats:
```
  Branch: <branch> · Last commit: <time ago>
  <N> areas · <N> files · +<N> −<N> · <N> staged, <N> unstaged, <N> untracked
```

If tracking a remote and ahead/behind:
```
  Branch: feature/auth · Last commit: 3 days ago · 2 ahead, 1 behind origin
```

**Change groups**
Group by purpose, not by directory. Each group has:
- A bold name + staging state: `**Auth refactor** (unstaged)`
- A file list with descriptions

File lines follow the same format as `git:commit`:
```
     M   src/auth/login.ts              rewrote token validation to use JWT
     A   src/auth/jwt.ts                new JWT helper (+52)
     D   src/auth/old-auth.ts           (deleted)
     R   config.js → config.ts          converted to TypeScript
     ?   scratch.py                     untracked — experiment file (30 lines)
```

- `A` = new, `M` = modified, `D` = deleted, `R` = renamed, `?` = untracked
- The description says *what* changed, not just that it changed
- Binary files: show `(binary)` instead of a description
- Large files: mention size

**Staging indicators on groups**
- `(staged)` — all files in this group are staged
- `(unstaged)` — none are staged
- `(partially staged)` — mix of staged and unstaged
- `(untracked)` — all files are new/untracked

**50+ files**
Summarize by directory:
```
**API overhaul** (unstaged)

     src/api/          12 files    +340 −89     new REST endpoints
     src/middleware/     4 files    +67 −23      request validation
     tests/api/         8 files    +210 −0      endpoint tests
```

**Stashes**
If stashes exist, list them at the bottom:
```
Stashes:
  stash@{0}: WIP on feature/auth — quick save before meeting (2 days ago)
  stash@{1}: experiment with caching (5 days ago)
```

**In-progress operations**
If a merge/rebase is in progress, flag it prominently before the recap:
```
⚠ Mid-rebase onto main — 2 of 5 commits applied. Use `git:resolve` to continue.

You were adding JWT-based auth...
```

**Clean tree**
```
> `git:status` — Scanning your changes.

Working tree clean. Last commit: `a1b2c3d` feat(auth): add JWT validation (3 days ago)
```

If there are stashes on a clean tree, still show them.

**Detached HEAD**
```
  Branch: (detached at a1b2c3d) · Last commit: 2 hours ago
```
