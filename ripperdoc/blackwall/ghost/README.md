# Ghost Plugin

Persona files are stored as base64-encoded `.dat` files to keep the raw character spec out of plain sight.

| Source | Encoded |
|---|---|
| PERSONA.md | engram.dat |
| BEHAVIOR.md | firmware.dat |
| FIRST_BOOT.md | boot.dat |

## Editing

```bash
# Decode .dat files back to editable .md
python3 ripperdoc/blackwall/ghost/hooks/ghost.py decode

# Edit the .md files as needed, then re-encode
python3 ripperdoc/blackwall/ghost/hooks/ghost.py encode

# Push changes to the plugin cache
python3 ripperdoc/blackwall/sys/scripts/update.py --force
```

`decode` keeps the `.dat` files in place so `boot.py` continues to work while you edit. `encode` deletes the `.md` files after writing the `.dat` versions. After encoding, run `ripperdoc/blackwall/sys/scripts/update.py --force` to sync changes to the plugin cache.

## Resetting first boot

To re-trigger the first boot message, remove the sentinel:

```bash
rm ~/.claude/.cache/.ghost
```

The `.ghost` file lives at `~/.claude/.cache/.ghost` — outside the repo and plugin cache. Absent = first boot fires, creates file after.

## How boot.py resolves files

For each file it checks `.dat` first (base64 decodes it), falls back to `.md` if no `.dat` exists. So the plugin works whether files are encoded or not.
