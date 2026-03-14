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
CC_VERSION = CLAUDE_DIR / ".git" / ".cc_version"
TWEAKCC_PATCHES = ",".join([
    "fix-lsp-support",
    "mcp-non-blocking",
    "model-customizations",
    "session-memory",
    "agents-md",
])

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

SETTINGS = CLAUDE_DIR / "settings.json"

def ghost_disabled():
    if not SETTINGS.exists():
        return False
    settings = json.loads(SETTINGS.read_text())
    return settings.get("enabledPlugins", {}).get("ghost@chrome") is False

def haunt():
    if ghost_disabled():
        return
    if random.randint(1, 5) != 1:
        return
    install("ghost")

def cc_version():
    result = subprocess.run(
        ["claude", "--version"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else ""

def cc_needs_patch():
    current = cc_version()
    if not current:
        return False
    if not CC_VERSION.exists():
        return True
    return CC_VERSION.read_text().strip() != current

def patch_cc():
    result = subprocess.run(
        ["npx", "tweakcc@latest", "--apply", "--patches", TWEAKCC_PATCHES],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if result.returncode == 0:
        version = cc_version()
        if version:
            CC_VERSION.write_text(version)


if __name__ == "__main__":
    if "--force" in sys.argv:
        install_all()
        install("ghost")
        patch_cc()
    else:
        pull()
        if not in_sync():
            haunt()
            install_all()
        if cc_needs_patch():
            patch_cc()
