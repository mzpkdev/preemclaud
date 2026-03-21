#!/usr/bin/env python3
"""PREEMCLAUD installer — jacks the rig into ~/.claude."""

import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from core import (
    CLAUDE_DIR, MARKETPLACES, PLUGIN_FLAVOR, PATCH_FLAVOR,
    TWEAKCC, TWEAKCC_PATCHES,
    get_env, install, install_lsp_deps, remote_head,
    cc_version, SYNC_SENTINEL, VERSION_SENTINEL,
)

REPO = "https://github.com/mzpkdev/preemclaud"

CYAN = "\033[96m"
RED = "\033[91m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"
WHITE = "\033[97m"

BANNER = rf"""
{CYAN}{BOLD}
    ██████╗ ██████╗ ███████╗███████╗███╗   ███╗ ██████╗██╗      █████╗ ██╗   ██╗██████╗
    ██╔══██╗██╔══██╗██╔════╝██╔════╝████╗ ████║██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗
    ██████╔╝██████╔╝█████╗  █████╗  ██╔████╔██║██║     ██║     ███████║██║   ██║██║  ██║
    ██╔═══╝ ██╔══██╗██╔══╝  ██╔══╝  ██║╚██╔╝██║██║     ██║     ██╔══██║██║   ██║██║  ██║
    ██║     ██║  ██║███████╗███████╗██║ ╚═╝ ██║╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝
    ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝
{RESET}{DIM}                         chrome for claude code — v1{RESET}
"""

PREREQS = [
    ("git",     lambda: shutil.which("git")),
    ("claude",  lambda: shutil.which("claude")),
    ("python3", lambda: shutil.which("python3")),
]


def typing(text, delay=0.012):
    sys.stdout.write("    ")
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\n")


def section(label):
    print(f"    {DIM}>>>{RESET} {BOLD}{label}{RESET}")


def sub(msg):
    print(f"        {DIM}\u203a{RESET} {msg}")


def fail(msg):
    print(f"\n    {RED}{BOLD}ABORT{RESET}  {msg}")
    sys.exit(1)


# ── phases ──────────────────────────────────────────────


def preflight():
    section("preflight")
    for name, check in PREREQS:
        time.sleep(0.1)
        if not check():
            fail(f"`{name}` not found on PATH. Install it and re-run.")
        sub(f"{name:<14}{DIM}found{RESET}")
    print()


def archive():
    if not os.path.isdir(str(CLAUDE_DIR)):
        return
    section("archiving previous rig")
    ts = int(time.time())
    dest = f"{CLAUDE_DIR}.bak.{ts}"
    sub(f"{DIM}{CLAUDE_DIR} -> {dest}{RESET}")
    os.rename(str(CLAUDE_DIR), dest)
    print()


def sync():
    section("syncing preemclaud")
    sub(f"{DIM}git clone --depth 1 {REPO}{RESET}")
    result = subprocess.run(
        ["git", "clone", "--depth", "1", REPO, str(CLAUDE_DIR), "--quiet"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        fail(f"git clone failed: {result.stderr.strip()}")
    print()


def register_marketplaces():
    section("registering marketplaces")
    for mkt_name, mkt in MARKETPLACES.items():
        sub(f"{CYAN}{mkt_name}{RESET}")
        subprocess.run(
            ["claude", "plugin", "marketplace", "add", str(mkt["path"])],
            env=get_env(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    print()


def install_plugins():
    section("installing plugins")
    for mkt_name, mkt in MARKETPLACES.items():
        manifest = mkt["path"] / ".claude-plugin" / "marketplace.json"
        if not manifest.exists():
            continue
        marketplace = json.loads(manifest.read_text())
        for plugin in marketplace.get("plugins", []):
            name = plugin["name"]
            if name in mkt["skip"]:
                continue
            if mkt_name == "lsp":
                plugin_dir = mkt["path"] / name
                if not install_lsp_deps(plugin_dir, name):
                    continue
            flavor = PLUGIN_FLAVOR.get(name, name)
            sub(f"{flavor.replace('`', CYAN + BOLD).replace('`', RESET)}")
            install(name, mkt_name)
    SYNC_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
    SYNC_SENTINEL.write_text(remote_head())
    print()


def break_ice():
    section("breaking ICE")
    for patch in TWEAKCC_PATCHES:
        flavor = PATCH_FLAVOR.get(patch, patch)
        sub(f"{flavor.replace('`', CYAN + BOLD).replace('`', RESET)}")
        result = subprocess.run(
            ["npx", TWEAKCC, "--apply", "--patches", patch],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            sub(f"{DIM}skipped{RESET}")
    version = cc_version()
    if version:
        VERSION_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
        VERSION_SENTINEL.write_text(version)
    print()


# ── main ────────────────────────────────────────────────


def main():
    print(BANNER)
    time.sleep(0.3)

    typing("initiating installation sequence...", delay=0.02)
    print()

    preflight()
    archive()
    sync()
    register_marketplaces()
    install_plugins()
    break_ice()

    print(f"    {CYAN}{BOLD}\u2501\u2501\u2501{RESET} {WHITE}{BOLD}preem, choom. you're chromed.{RESET}")
    print(f"        {DIM}restart claude code to load the new rig.{RESET}")
    print()


if __name__ == "__main__":
    main()
