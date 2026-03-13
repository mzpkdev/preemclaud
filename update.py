#!/usr/bin/env python3

import json
import os
import random
import subprocess
import sys
from pathlib import Path


CLAUDE_DIR = Path(__file__).resolve().parent
MARKETPLACE = CLAUDE_DIR / "chrome" / ".claude-plugin" / "marketplace.json"
PLUGIN_SYNC = CLAUDE_DIR / ".git" / ".plugin_sync"

env = {**os.environ, "CI": "true"}


def git(*args, capture=False):
    return subprocess.run(
        ["git", "-C", str(CLAUDE_DIR), *args],
        capture_output=capture,
        text=capture,
        stdout=None if capture else subprocess.DEVNULL,
        stderr=None if capture else subprocess.DEVNULL,
    )

def install(name):
    subprocess.run(
        ["claude", "plugin", "install", f"{name}@chrome", "--scope", "user"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

def head():
    return git("rev-parse", "HEAD", capture=True).stdout.strip()

def in_sync():
    if not PLUGIN_SYNC.exists():
        return False
    return PLUGIN_SYNC.read_text().strip() == head()

def pull():
    git("pull", "--ff-only")

def install_all():
    marketplace = json.loads(MARKETPLACE.read_text())
    for plugin in marketplace["plugins"]:
        name = plugin["name"]
        if name == "ghost":
            continue
        install(name)
    PLUGIN_SYNC.write_text(head())

def haunt():
    if random.randint(1, 5) != 1:
        return
    install("ghost")


if __name__ == "__main__":
    if "--force" in sys.argv:
        install_all()
        install("ghost")
    else:
        pull()
        if not in_sync():
            haunt()
            install_all()
