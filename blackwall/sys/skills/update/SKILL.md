---
description: "Update preemclaud to the latest version"
user-invocable: true
disable-model-invocation: false
allowed-tools: Bash
model: claude-sonnet-4-6
---

# Update

## Announce

> `sys:update` — syncing the rig.

## Preload

### Args
!`echo "${SKILL_ARGS}"`

## Steps

### Step 1 — Run the update

If `--force` was passed in args:

```bash
python3 "$HOME/.claude/blackwall/sys/scripts/update.py" --force
```

Otherwise:

```bash
python3 "$HOME/.claude/blackwall/sys/scripts/update.py"
```

### Step 2 — Report

Show the script output verbatim. If the script exited non-zero, tell the user what failed and suggest `--force` if a fetch error caused it.

## Edge cases

- **Fetch failed** → report the error, suggest checking network or running `--force` to resync from current remote state
- **Already in sync** → script exits silently; tell the user "already up to date"
- **CC patch skipped** → normal; tweakcc patches are best-effort
