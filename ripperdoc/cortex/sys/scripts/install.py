#!/usr/bin/env python3
"""PREEMCLAUD installer — jacks the rig into ~/.claude."""

import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    os.system("")  # enable VT100 escape processing on Windows 10+

sys.path.insert(0, str(Path(__file__).parent))
from core import (
    CLAUDE_DIR, MARKETPLACES, PLUGIN_FLAVOR, PATCH_FLAVOR,
    TWEAKCC, TWEAKCC_PATCHES,
    get_env, install, install_lsp_deps, remote_head,
    cc_version, SYNC_SENTINEL, VERSION_SENTINEL,
    ccr_installed, install_ccr, scaffold_routing, CCR_BIN,
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


def colorize(text):
    return text.replace('`', CYAN + BOLD, 1).replace('`', RESET, 1)


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
    if not CLAUDE_DIR.is_dir():
        return
    section("archiving previous rig")
    ts = int(time.time())
    dest = f"{CLAUDE_DIR}.bak.{ts}"
    sub(f"{DIM}{CLAUDE_DIR} -> {dest}{RESET}")
    shutil.move(str(CLAUDE_DIR), dest)
    print()


def sync():
    section("cloning the shard")
    sub(f"{DIM}git clone --depth 1 {REPO}{RESET}")
    result = subprocess.run(
        ["git", "clone", "--depth", "1", REPO, str(CLAUDE_DIR), "--quiet"],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        fail(f"git clone failed: {result.stderr.strip()}")
    print()


CLEANUP = [
    "CLAUDE.md", "AGENTS.md", "README.md",
    "install.sh", "install.ps1",
    "docs", ".github",
]


def scrub():
    section("scrubbing repo artifacts")
    for name in CLEANUP:
        target = CLAUDE_DIR / name
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()
        sub(f"{DIM}{name}{RESET}")
    print()


def register_marketplaces():
    section("hitting the ripperdoc")
    names = []
    for mkt_name, mkt in MARKETPLACES.items():
        names.append(mkt_name)
        subprocess.run(
            ["claude", "plugin", "marketplace", "add", str(mkt["path"])],
            env=get_env(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    sub(f"{DIM}{' · '.join(names)}{RESET}")
    print()


def lsp_dep_status(lsp_path, name):
    deps_file = lsp_path / name / "dependencies.json"
    if not deps_file.exists():
        return "ready", []
    deps = json.loads(deps_file.read_text())
    requires = deps.get("requires", [])
    present = [r for r in requires if shutil.which(r)]
    missing = [r for r in requires if not shutil.which(r)]
    if not present and missing:
        return "hidden", missing
    if missing:
        return "skipped", missing
    return "ready", []


def select_lsps(plugins, lsp_path):
    visible = [(p, *lsp_dep_status(lsp_path, p["name"])) for p in plugins]
    visible = [(p, status, missing) for p, status, missing in visible if status != "hidden"]
    if not visible:
        return set()
    try:
        tty = open("CON" if sys.platform == "win32" else "/dev/tty")
    except OSError:
        tty = None
    section("choose your optics")
    selected = set()
    for plugin, status, missing in visible:
        name = plugin["name"]
        flavor = PLUGIN_FLAVOR.get(name, name)
        if status == "skipped":
            deps = ", ".join(f"`{m}`" for m in missing)
            sub(f"{colorize(flavor)}    {DIM}[skip \u2014 {deps} not found]{RESET}")
            continue
        if tty is None:
            sub(f"{colorize(flavor)}    {DIM}[auto]{RESET}")
            selected.add(name)
            continue
        try:
            sys.stdout.write(f"        {DIM}\u203a{RESET} {colorize(flavor)}    {BOLD}[Y/n]{RESET} ")
            sys.stdout.flush()
            answer = tty.readline().strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"
            print()
            fail("interrupted")
        if answer in ("", "y", "yes"):
            selected.add(name)
    if tty is not None:
        tty.close()
    print()
    return selected


def install_plugins():
    lsp_selected = None
    lsp_mkt = MARKETPLACES.get("optics")
    if lsp_mkt:
        manifest = lsp_mkt["path"] / ".claude-plugin" / "marketplace.json"
        if manifest.exists():
            marketplace = json.loads(manifest.read_text())
            candidates = [p for p in marketplace.get("plugins", []) if p["name"] not in lsp_mkt["skip"]]
            lsp_selected = select_lsps(candidates, lsp_mkt["path"])

    section("slotting chrome")
    for mkt_name, mkt in MARKETPLACES.items():
        manifest = mkt["path"] / ".claude-plugin" / "marketplace.json"
        if not manifest.exists():
            continue
        marketplace = json.loads(manifest.read_text())
        for plugin in marketplace.get("plugins", []):
            name = plugin["name"]
            if name in mkt["skip"]:
                continue
            if mkt_name == "optics":
                if lsp_selected is not None and name not in lsp_selected:
                    continue
                plugin_dir = mkt["path"] / name
                if not install_lsp_deps(plugin_dir, name):
                    continue
                install(name, mkt_name)
                continue
            flavor = name if name not in PLUGIN_FLAVOR else PLUGIN_FLAVOR[name]
            sub(colorize(flavor))
            install(name, mkt_name)
    SYNC_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
    SYNC_SENTINEL.write_text(remote_head())
    print()


def break_ice():
    section("breaking ICE")
    for patch in TWEAKCC_PATCHES:
        flavor = PATCH_FLAVOR.get(patch, patch)
        sub(colorize(flavor))
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


def setup_routing():
    section("subagent routing")
    if ccr_installed():
        sub(f"{colorize('`claude-code-router`')} {DIM}found{RESET}")
        scaffold_routing()
        sub(f"{DIM}routing config at ~/.claude/routing.json{RESET}")
        print()
        return
    try:
        tty = open("CON" if sys.platform == "win32" else "/dev/tty")
    except OSError:
        tty = None
    if tty is None:
        sub(f"{colorize('`claude-code-router`')} {DIM}skipped (non-interactive){RESET}")
        print()
        return
    try:
        sys.stdout.write(
            f"        {DIM}\u203a{RESET} install {colorize('`claude-code-router`')}?    {BOLD}[y/N]{RESET} "
        )
        sys.stdout.flush()
        answer = tty.readline().strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = "n"
        print()
    finally:
        tty.close()
    if answer not in ("y", "yes"):
        sub(f"{DIM}skipped{RESET}")
        print()
        return
    sub(f"{DIM}npm install -g {CCR_BIN}{RESET}")
    if install_ccr():
        scaffold_routing()
        sub(f"{DIM}routing config at ~/.claude/routing.json{RESET}")
    else:
        sub(f"{DIM}install failed{RESET}")
    print()


# ── main ────────────────────────────────────────────────


def main():
    print(BANNER)
    time.sleep(0.3)

    typing("jacking in...", delay=0.02)
    print()

    preflight()
    archive()
    sync()
    scrub()
    register_marketplaces()
    install_plugins()
    break_ice()
    setup_routing()

    print(f"    {CYAN}{BOLD}\u2501\u2501\u2501{RESET} {WHITE}{BOLD}preem, choom. you're chromed.{RESET}")
    print(f"        {DIM}restart claude code to load the new rig.{RESET}")
    print()


if __name__ == "__main__":
    main()
