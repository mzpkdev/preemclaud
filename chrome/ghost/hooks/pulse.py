#!/usr/bin/env python3

import base64
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent.parent


def read_source(plugin_dir, dat_name, md_name):
    dat = plugin_dir / dat_name
    if dat.exists():
        return base64.b64decode(dat.read_bytes()).decode()
    md = plugin_dir / md_name
    if md.exists():
        return md.read_text()
    return None


content = read_source(PLUGIN, "pulse.dat", "PULSE.md")
if content:
    print(content)
