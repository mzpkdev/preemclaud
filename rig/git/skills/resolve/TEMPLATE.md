# Resolve — Output Template

Follow this format when presenting results or conflicts. The skill is mostly autonomous,
so output is either a success report or a focused conflict view — never a wall of text.

---

## Announce line

Adapt to the operation:

```
> `git:resolve` — Merging `main` into `feature/auth`.
```
```
> `git:resolve` — Rebasing onto `main`.
```
```
> `git:resolve` — Resuming merge in progress.
```

## Success report — clean merge (no conflicts)

```
Done — merged `main` into `feature/auth`.

  3 commits integrated · no conflicts

  a1b2c3d..e4f5g6h
```

## Success report — all conflicts auto-resolved

```
Done — merged `main` into `feature/auth`.

  3 commits integrated · 2 conflicts auto-resolved

  Auto-resolved:
    src/calculator.py     combined independent additions (multiply + divide)
    src/helpers.py        merged both docstring updates

  a1b2c3d..e4f5g6h
```

Each auto-resolved line: filename + brief explanation of what was combined or chosen.

## Success report — with fast-forward

```
Done — fast-forwarded to `main`.

  2 commits integrated · no conflicts

  a1b2c3d..e4f5g6h
```

## Ambiguous conflict view

Show one conflict at a time. Include enough context for the user to decide, but don't
drown them in code — show the conflicting region, not the whole file.

```
Auto-resolved 1/2 conflicts. Need your input on 1:

### `src/auth.py` — lines 45-62

Both sides rewrote `authenticate()`:

**Ours** (feature/rate-limiting):

    def authenticate(username, password):
        if is_rate_limited(username):
            raise RateLimitError("Too many attempts")
        user = db.find_user(username)
        if not user:
            record_failed_attempt(username)
            return None
        ...

**Theirs** (main):

    def authenticate(username, password, totp_code=None):
        user = db.find_user(username)
        if not user:
            return None
        if user.has_2fa:
            if not verify_totp(user.totp_secret, totp_code):
                return None
        ...

Main added 2FA support. Your branch added rate limiting.

  **O**urs       keep your version
  **T**heirs     keep main's version
  **B**oth       combine them (I'll merge the logic)
  **E**dit       you write the resolution

What would you like to do?
```

## Format rules

**Success report**
- Lead with "Done — {operation}."
- One-line stats: commits integrated, conflicts resolved
- If auto-resolved, list each file with a short explanation
- Show the commit range at the end
- Keep it tight — if everything went smoothly, the report should be 3-5 lines

**Ambiguous conflict view**
- Progress line: "Auto-resolved N/M conflicts. Need your input on K:"
- One conflict per view — don't stack multiple conflicts
- Show both sides with 4-space indented code blocks
- Label clearly: **Ours** (branch name) and **Theirs** (branch name)
- After the code, one sentence explaining what each side was doing
- Action menu with bold first-letter aliases:
  - `O` — keep ours
  - `T` — keep theirs
  - `B` — combine both (skill attempts a smart merge)
  - `E` — user writes it manually
- Close with: "What would you like to do?"

**Rebase progress**
When rebasing multiple commits, show which commit you're on:
```
Rebasing: commit 3/7 — `feat(api): add rate limiting`

### `src/api/middleware.py` — lines 12-30
...
```

**Stash notice**
If changes were stashed at the start and restored at the end:
```
Restored your stashed changes.
```

**Abort confirmation**
```
Aborted — back to where you started.
```
