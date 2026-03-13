#!/usr/bin/env python3

import base64
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent.parent

MAPPINGS = [
    ("ENGRAM.md", "engram.dat"),
    ("FIRMWARE.md", "firmware.dat"),
    ("BOOT.md", "boot.dat"),
    ("PULSE.md", "pulse.dat"),
]


def encode():
    for md_name, dat_name in MAPPINGS:
        md = PLUGIN / md_name
        if not md.exists():
            continue
        dat = PLUGIN / dat_name
        dat.write_bytes(base64.b64encode(md.read_bytes()))
        md.unlink()
        print(f"{md_name} -> {dat_name}")


def decode():
    for md_name, dat_name in MAPPINGS:
        dat = PLUGIN / dat_name
        if not dat.exists():
            continue
        md = PLUGIN / md_name
        md.write_bytes(base64.b64decode(dat.read_bytes()))
        print(f"{dat_name} -> {md_name}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else None
    if cmd == "encode":
        encode()
    elif cmd == "decode":
        decode()
    else:
        print("Usage: ghost.py {encode|decode}")
        sys.exit(1)
