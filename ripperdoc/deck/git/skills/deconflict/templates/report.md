## Success report

```
Done — {operation}.

  N commits integrated · N conflicts auto-resolved
  ──────────────────────────────────────────────────────────────────

  Auto-resolved:
    file.py     short explanation of what was combined
    file.js     short explanation of what was combined

  a1b2c3d..e4f5g6h
```

Omit "Auto-resolved" block if zero. Omit "conflicts auto-resolved" count if zero.
Show "fast-forwarded to `branch`" instead of "merged/rebased" when applicable.
If stash was restored, append: "Restored your stashed changes."

## Conflict view

When rebasing multiple commits, open each conflict with: "Rebasing: commit 3/7 — `commit message`"

```
Auto-resolved N/M conflicts. Need your input on K:

  --> file.py:N-M
  One sentence explaining what each side was doing.
   |
   = ours (branch-name):
   |
 N |    code
 N |    code
   |
   = theirs (branch-name):
   |
 N |    code
 N |    code
   |

  ──────────────────────────────────────────────────────────────────
  ▸ [O]urs     ▸ [T]heirs     ▸ [B]oth     ▸ [E]dit

What would you like to do?
```

## Abort

```
Aborted — back to where you started.
```
