# Cortex

System-level internals. Not user-facing chrome — the daemons that keep the rig alive.

## Sys

Maintenance scripts and the `sys:update` skill.

| Component            | What it does                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `scripts/update.py`  | Fetches latest chrome from upstream and hot-swaps marketplace dirs. Your `settings.json` is untouched. |
| `scripts/install.py` | Installer logic — backs up `~/.claude`, lays down the rig.                                             |
| `scripts/core.py`    | Shared utilities for the script suite.                                                                 |
| `sys:update`         | Skill wrapper around `update.py`. Pass `--force` to do a full resync.                                  |
