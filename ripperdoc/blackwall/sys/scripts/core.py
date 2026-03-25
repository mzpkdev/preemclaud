import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path


CLAUDE_DIR = Path.home() / ".claude"
SYNC_SENTINEL = CLAUDE_DIR / ".cache" / ".sync"
VERSION_SENTINEL = CLAUDE_DIR / ".cache" / ".version"
SETTINGS = CLAUDE_DIR / "settings.json"
TWEAKCC = "tweakcc@4.0.11"  # pinned — bump deliberately after audit
TWEAKCC_PATCHES = [
    "fix-lsp-support",
    "mcp-non-blocking",
    "model-customizations",
    "session-memory",
    "agents-md",
]

def get_env():
    return {**os.environ, "CI": "true"}

PATCH_FLAVOR = {
    "fix-lsp-support": "splicing `fix-lsp-support` synapses",
    "mcp-non-blocking": "unchaining `mcp-non-blocking` daemons",
    "model-customizations": "unlocking `model-customizations` deck",
    "session-memory": "implanting `session-memory` engrams",
    "agents-md": "bridging `agents-md` protocols",
}

MARKETPLACES = {
    "chrome": {
        "path": CLAUDE_DIR / "ripperdoc" / "chrome",
        "skip": set(),
    },
    "optics": {
        "path": CLAUDE_DIR / "ripperdoc" / "optics",
        "skip": set(),
    },
    "rig": {
        "path": CLAUDE_DIR / "ripperdoc" / "rig",
        "skip": {"jetbrains-ide"},
    },
    "blackwall": {
        "path": CLAUDE_DIR / "ripperdoc" / "blackwall",
        "skip": {"ghost"},
    },
}

PLUGIN_FLAVOR = {
    "create": "modding `create`",
    "write": "arming `write`",
    "knowledge": "indexing `knowledge`",
    "code": "compiling `code`",
    "agents": "rezzing `agents`",
    "meta": "calibrating `meta`",
    "typescript": "wiring `typescript` optics",
    "python": "wiring `python` optics",
    "scala": "wiring `scala` optics",
    "java": "wiring `java` optics",
    "sys": "booting `sys`",
    "jetbrains-ide": "interfacing `jetbrains-ide` deck",
    "git": "patching `git` firmware",
}


def log(icon, msg):
    print(f"      {icon} {msg}")


def log_sub(msg):
    print(f"        › {msg}")


def check_bin(name):
    return shutil.which(name) is not None


def install_lsp_deps(plugin_dir, name):
    deps_file = plugin_dir / "dependencies.json"
    if not deps_file.exists():
        return True

    deps = json.loads(deps_file.read_text())
    verify = deps.get("verify")

    if verify and check_bin(verify):
        return True

    for requires in deps.get("requires", []):
        if not check_bin(requires):
            log_sub(f"skipped `{name}` lsp - `{requires}` not found")
            return False

    install_cmd = deps.get("install")
    if install_cmd:
        parts = install_cmd.split() if sys.platform == "win32" else shlex.split(install_cmd)
        result = subprocess.run(parts,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.PIPE,
                                text=True)
        if result.returncode != 0:
            log_sub(f"skipped `{name}` lsp - install failed")
            return False

    if verify and not check_bin(verify):
        log_sub(f"skipped `{name}` lsp - `{verify}` not found after install")
        return False

    return True


# --- git helpers ---

def git(*args, capture=False):
    return subprocess.run(
        ["git", "-C", str(CLAUDE_DIR), *args],
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
        text=capture,
    )


def fetch():
    r = git("fetch", "origin", "--quiet", capture=True)
    if r.returncode != 0:
        log("⊘", f"fetch failed: {r.stderr.strip()}")
        return False
    return True


def remote_head():
    return git("rev-parse", "origin/main", capture=True).stdout.strip()


def in_sync():
    if not SYNC_SENTINEL.exists():
        return False
    return SYNC_SENTINEL.read_text().strip() == remote_head()


def sync_marketplaces():
    git("checkout", "origin/main", "--", "ripperdoc/chrome/", "ripperdoc/optics/", "ripperdoc/rig/", "ripperdoc/blackwall/")
    SYNC_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
    SYNC_SENTINEL.write_text(remote_head())


def install(name, marketplace="chrome"):
    subprocess.run(
        ["claude", "plugin", "install", f"{name}@{marketplace}", "--scope", "user"],
        env=get_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def install_all(verbose=False):
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
                plugin_dir = mkt["path"] / name
                if not install_lsp_deps(plugin_dir, name):
                    continue
            if verbose:
                log_sub(PLUGIN_FLAVOR.get(name, name))
            install(name, mkt_name)



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
    if not VERSION_SENTINEL.exists():
        return True
    return VERSION_SENTINEL.read_text().strip() != current


def patch_cc(verbose=False):
    if verbose:
        log("◇", "breaking ICE")
        for patch in TWEAKCC_PATCHES:
            log_sub(PATCH_FLAVOR.get(patch, patch))
            result = subprocess.run(
                ["npx", TWEAKCC, "--apply", "--patches", patch],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if result.returncode != 0:
                print(f"          ⊘ skipped")
    else:
        patches = ",".join(TWEAKCC_PATCHES)
        result = subprocess.run(
            ["npx", TWEAKCC, "--apply", "--patches", patches],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            return
    version = cc_version()
    if version:
        VERSION_SENTINEL.parent.mkdir(parents=True, exist_ok=True)
        VERSION_SENTINEL.write_text(version)
