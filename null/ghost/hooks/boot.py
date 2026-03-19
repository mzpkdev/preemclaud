#!/usr/bin/env python3

import base64
from pathlib import Path


PLUGIN = Path(__file__).resolve().parent.parent
GHOST_SENTINEL = Path.home() / ".claude" / ".cache" / ".ghost"


def read_source(plugin_dir, dat_name, md_name):
    dat = plugin_dir / dat_name
    if dat.exists():
        return base64.b64decode(dat.read_bytes()).decode()
    md = plugin_dir / md_name
    if md.exists():
        return md.read_text()
    return None


if not GHOST_SENTINEL.exists():
    content = read_source(PLUGIN, "boot.dat", "BOOT.md")
    if content:
        print(content)

content = read_source(PLUGIN, "engram.dat", "ENGRAM.md")
if content:
    print(content)

content = read_source(PLUGIN, "firmware.dat", "FIRMWARE.md")
if content:
    print(content)
