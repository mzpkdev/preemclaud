import json
import os
import random
import subprocess
from pathlib import Path


CLAUDE_DIR = Path(__file__).resolve().parent
MARKETPLACE = CLAUDE_DIR / "chrome" / ".claude-plugin" / "marketplace.json"
PLUGIN_SYNC = CLAUDE_DIR / ".git" / ".plugin_sync"
CC_VERSION = CLAUDE_DIR / ".git" / ".cc_version"
SETTINGS = CLAUDE_DIR / "settings.json"
TWEAKCC_PATCHES = [
    "fix-lsp-support",
    "mcp-non-blocking",
    "model-customizations",
    "session-memory",
    "agents-md",
]

env = {**os.environ, "CI": "true"}

PATCH_FLAVOR = {
    "fix-lsp-support": "linking `fix-lsp-support` synapses",
    "mcp-non-blocking": "freeing `mcp-non-blocking` daemons",
    "model-customizations": "unlocking `model-customizations` deck",
    "session-memory": "implanting `session-memory` engrams",
    "agents-md": "bridging `agents-md` protocols",
}

PLUGIN_FLAVOR = {
    "create": "modding `create`",
    "write": "encoding `write`",
    "setup": "calibrating `setup`",
    "knowledge": "indexing `knowledge`",
    "code": "compiling `code`",
    "agents": "rezzing `agents`",
}


def log(icon, msg):
    print(f"      {icon} {msg}")


def log_sub(msg):
    print(f"        › {msg}")


# --- git helpers ---

def git(*args, capture=False):
    return subprocess.run(
        ["git", "-C", str(CLAUDE_DIR), *args],
        capture_output=capture,
        text=capture,
        stdout=None if capture else subprocess.DEVNULL,
        stderr=None if capture else subprocess.DEVNULL,
    )


def head():
    return git("rev-parse", "HEAD", capture=True).stdout.strip()


def pull():
    git("pull", "--ff-only")


def in_sync():
    if not PLUGIN_SYNC.exists():
        return False
    return PLUGIN_SYNC.read_text().strip() == head()


def install(name):
    subprocess.run(
        ["claude", "plugin", "install", f"{name}@chrome", "--scope", "user"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def install_all(verbose=False):
    marketplace = json.loads(MARKETPLACE.read_text())
    for plugin in marketplace["plugins"]:
        name = plugin["name"]
        if name == "ghost":
            continue
        if verbose:
            log_sub(PLUGIN_FLAVOR.get(name, name))
        install(name)
    PLUGIN_SYNC.write_text(head())


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


def patch_cc(verbose=False):
    if verbose:
        log("◇", "breaking ICE")
        for patch in TWEAKCC_PATCHES:
            log_sub(PATCH_FLAVOR.get(patch, patch))
            result = subprocess.run(
                ["npx", "tweakcc@latest", "--apply", "--patches", patch],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if result.returncode != 0:
                print(f"          ⊘ skipped")
    else:
        patches = ",".join(TWEAKCC_PATCHES)
        result = subprocess.run(
            ["npx", "tweakcc@latest", "--apply", "--patches", patches],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if result.returncode != 0:
            return
    version = cc_version()
    if version:
        CC_VERSION.write_text(version)


def bootstrap():
    log("◇", "slotting chrome")
    subprocess.run(
        ["claude", "plugin", "marketplace", "add", str(CLAUDE_DIR / "chrome")],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    install_all(verbose=True)

    log("◇", "wiring daemons")
    subprocess.run(
        ["claude", "plugin", "marketplace", "add", "Piebald-AI/claude-code-lsps"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    patch_cc(verbose=True)

    print("    ◉ preem, choom.")
    print()
