# Deconflict — Output Template

Shows operation progress, conflict resolution UI, and final results during rebase, merge, or cherry-pick.

______________________________________________________________________

## Scenarios

### Success

Operation completed with no remaining conflicts.

```
Done — {operation}.

  N commits integrated · N conflicts auto-resolved
  ──────────────────────────────────────────────────────────────────

  Auto-resolved:
    file.py     short explanation of what was combined
    file.js     short explanation of what was combined

  a1b2c3d..e4f5g6h
```

### Conflict

Conflicts need user input to resolve.

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

### Abort

User aborted the operation.

```
Aborted — back to where you started.
```

______________________________________________________________________

## Format rules

**Success report**

- Omit "Auto-resolved" block if zero auto-resolved conflicts
- Omit "conflicts auto-resolved" count if zero
- Show "fast-forwarded to `branch`" instead of "merged/rebased" when applicable
- If stash was restored, append: "Restored your stashed changes."

**Conflict view**

- Show both sides with line-numbered gutter (`N |`) and branch labels
- One sentence explaining what each side was doing before the code blocks
- Action menu always closes the conflict block
