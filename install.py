import json
import os
import random
import shutil
import subprocess
from pathlib import Path


CLAUDE_DIR = Path(__file__).resolve().parent
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

MARKETPLACES = {
    "chrome": {
        "path": CLAUDE_DIR / "chrome",
        "skip": {"ghost"},
    },
    "lsp": {
        "path": CLAUDE_DIR / "lsp",
        "skip": set(),
    },
    "rig": {
        "path": CLAUDE_DIR / "rig",
        "skip": set(),
    },
}

PLUGIN_FLAVOR = {
    "create": "modding `create`",
    "write": "encoding `write`",
    "setup": "calibrating `setup`",
    "knowledge": "indexing `knowledge`",
    "code": "compiling `code`",
    "agents": "rezzing `agents`",
    "meta": "tuning `meta`",
    "typescript": "installing `typescript` lsp",
    "python": "installing `python` lsp",
    "scala": "installing `scala` lsp",
    "java": "installing `java` lsp",
    "jetbrains": "interfacing `jetbrains` deck",
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

    for req in deps.get("requires", []):
        if not check_bin(req):
            return False

    install_cmd = deps.get("install")
    if install_cmd:
        result = subprocess.run(install_cmd, shell=True,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.PIPE,
                                text=True)
        if result.returncode != 0:
            return False

    if verify and not check_bin(verify):
        return False

    return True


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


def install(name, marketplace="chrome"):
    subprocess.run(
        ["claude", "plugin", "install", f"{name}@{marketplace}", "--scope", "user"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def install_all(verbose=False):
    for mkt_name, mkt in MARKETPLACES.items():
        manifest = mkt["path"] / ".claude-plugin" / "marketplace.json"
        if not manifest.exists():
            continue
        marketplace = json.loads(manifest.read_text())
        for plugin in marketplace["plugins"]:
            name = plugin["name"]
            if name in mkt["skip"]:
                continue
            if mkt_name == "lsp":
                plugin_dir = mkt["path"] / name
                if not install_lsp_deps(plugin_dir, name):
                    continue
            if verbose:
                log_sub(PLUGIN_FLAVOR.get(name, name))
            install(name, mkt_name)
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
    install("ghost", "chrome")


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
    for mkt_name, mkt in MARKETPLACES.items():
        log("◇", f"slotting {mkt_name}")
        subprocess.run(
            ["claude", "plugin", "marketplace", "add", str(mkt["path"])],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    install_all(verbose=True)

    patch_cc(verbose=True)

    print("    ◉ preem, choom.")
    print()
