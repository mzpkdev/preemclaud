#!/usr/bin/env python3
"""sys:router — view and configure CCR model routing."""

import json
import shutil
import socket
import subprocess
import sys
from pathlib import Path

ROUTING_CONFIG = Path.home() / ".claude" / "routing.json"
CCR_CONFIG = Path.home() / ".claude-code-router" / "config.json"
CCR_PORT = 2077

CYAN = "\033[96m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"
GREEN = "\033[92m"
RED = "\033[91m"

ROUTING_SCAFFOLD = {
    "models": {"opus": "", "sonnet": "", "haiku": ""},
    "override": {},
}

TIERS = ("opus", "sonnet", "haiku")
WIDTH = 44
CCR_BIN = "claude-code-router"

CCR_DAEMON_SCAFFOLD = {
    "PORT": 2077,
    "Providers": [
        {
            "name": "openrouter",
            "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
            "api_key": "$OPENROUTER_API_KEY",
            "models": [
                "anthropic/claude-opus-4",
                "anthropic/claude-sonnet-4-6",
                "anthropic/claude-haiku-4-5",
            ],
            "transformer": {"use": ["openrouter", "tooluse"]},
        }
    ],
    "Router": {"default": "openrouter,anthropic/claude-sonnet-4-6"},
    "LOG": False,
}


def ccr_running():
    try:
        with socket.create_connection(("localhost", get_ccr_port()), timeout=0.5):
            return True
    except OSError:
        return False


def load_routing():
    try:
        return json.loads(ROUTING_CONFIG.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(ROUTING_SCAFFOLD)


def save_routing(cfg):
    ROUTING_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    ROUTING_CONFIG.write_text(json.dumps(cfg, indent=2) + "\n")


def load_ccr():
    try:
        return json.loads(CCR_CONFIG.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def get_ccr_port():
    cfg = load_ccr()
    if cfg:
        return cfg.get("PORT", CCR_PORT)
    return CCR_PORT


def find_openrouter(cfg):
    for p in cfg.get("Providers", []):
        if p.get("name") == "openrouter":
            return p
    return None


# ── commands ────────────────────────────────────────────


def cmd_status():
    port = get_ccr_port()
    running = ccr_running()
    dot = f"{GREEN}●{RESET}" if running else f"{RED}○{RESET}"
    ccr_label = f"running · localhost:{port}" if running else "not running"

    cfg = load_routing()
    models = cfg.get("models", {})
    overrides = cfg.get("override", {})

    bar = f"{DIM}─── router {'─' * (WIDTH - 11)}{RESET}"
    end = f"{DIM}{'─' * WIDTH}{RESET}"

    print(f"\n    {bar}")
    print(f"\n    {'Router':<10}{dot} {ccr_label}")
    if not running and not shutil.which(CCR_BIN):
        print(f"    {DIM}run /sys:router install to set up CCR{RESET}")
    print()
    for tier in TIERS:
        val = models.get(tier)
        display = f"{CYAN}{val}{RESET}" if val else f"{DIM}—{RESET}"
        print(f"    {tier:<10}{display}")

    if overrides:
        print(f"\n    {'agents'}")
        for name, model in overrides.items():
            display = f"{DIM}native{RESET}" if model is None else f"{CYAN}{model}{RESET}"
            print(f"      {DIM}›{RESET} {name:<22}{display}")

    print(f"\n    {end}\n")


def cmd_key(args):
    if not args:
        print("usage: /sys:router key <value>")
        return
    key = args[0]
    ccr_cfg = load_ccr()
    if ccr_cfg is None:
        print("CCR config not found — install claude-code-router first")
        return
    provider = find_openrouter(ccr_cfg)
    if provider is None:
        print("openrouter provider not found in CCR config")
        return
    provider["api_key"] = key
    CCR_CONFIG.write_text(json.dumps(ccr_cfg, indent=2) + "\n")
    print("key set — restart CCR to apply")


def cmd_default(args):
    if len(args) < 2:
        print("usage: /sys:router default <opus|sonnet|haiku> <value|--unset>")
        return
    tier, value = args[0], args[1]
    if tier not in TIERS:
        print(f"unknown tier '{tier}' — use: opus, sonnet, haiku")
        return
    cfg = load_routing()
    if value == "--unset":
        cfg.setdefault("models", {})[tier] = ""
        save_routing(cfg)
        print(f"{tier} cleared")
    else:
        normalised = _normalise_model(value)
        cfg.setdefault("models", {})[tier] = normalised
        save_routing(cfg)
        print(f"{tier} → {normalised}")


def cmd_agent(args):
    if len(args) < 2:
        print("usage: /sys:router agent <name> <model|native|--unset>")
        return
    name, value = args[0], args[1]
    cfg = load_routing()
    overrides = cfg.setdefault("override", {})
    if value == "--unset":
        overrides.pop(name, None)
        save_routing(cfg)
        print(f"{name} override removed")
    elif value == "native":
        overrides[name] = None
        save_routing(cfg)
        print(f"{name} → native")
    else:
        normalised = _normalise_model(value)
        overrides[name] = normalised
        save_routing(cfg)
        print(f"{name} → {normalised}")


def _cc(text):
    """Colorize `backtick` spans cyan+bold."""
    return text.replace("`", CYAN + BOLD, 1).replace("`", RESET, 1)


def _sub(msg):
    print(f"        {DIM}›{RESET} {msg}")


def cmd_install():
    bar = f"{DIM}─── Router {'─' * (WIDTH - 11)}{RESET}"
    print(f"\n    {bar}\n")

    if shutil.which(CCR_BIN):
        _sub(f"{_cc('`claude-code-router`')} {DIM}found{RESET}")
        _scaffold_configs()
        _sub(f"writing {DIM}~/.claude/routing.json{RESET}")
        rc = _inject_shell_rc()
        if rc:
            _sub(f"patching {DIM}{rc}{RESET}")
        print(f"\n    Restart your shell, then: {CYAN}/sys:router key <your-openrouter-key>{RESET}\n")
        return

    _sub(f"installing {_cc('`claude-code-router`')}")
    result = subprocess.run(
        ["npm", "install", "-g", CCR_BIN],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    if result.returncode != 0:
        print(f"\n    {DIM}{result.stderr.strip()}{RESET}\n")
        return

    _scaffold_configs()
    _sub(f"writing {DIM}~/.claude/routing.json{RESET}")
    rc = _inject_shell_rc()
    if rc:
        _sub(f"patching {DIM}{rc}{RESET}")

    print(f"\n    Restart your shell, then: {CYAN}/sys:router key <your-openrouter-key>{RESET}\n")


def _inject_shell_rc():
    """Append shell integration snippet. Returns the rc path if written, None if already present."""
    marker = "ccr activate"
    if sys.platform == "win32":
        rc = Path(subprocess.run(
            ["powershell", "-NoProfile", "-Command", "echo $PROFILE"],
            capture_output=True, text=True,
        ).stdout.strip())
        snippet = "\n# preemclaud — model routing\nif (Get-Command ccr -ErrorAction SilentlyContinue) { ccr start *>$null; Invoke-Expression (ccr activate 2>$null) }\n"
    else:
        zshrc = Path.home() / ".zshrc"
        bashrc = Path.home() / ".bashrc"
        rc = zshrc if zshrc.exists() or not bashrc.exists() else bashrc
        snippet = "\n# preemclaud — model routing\ncommand -v ccr >/dev/null && { ccr start >/dev/null 2>&1 & eval \"$(ccr activate 2>/dev/null)\"; }\n"

    if rc.exists() and marker in rc.read_text():
        return None
    rc.parent.mkdir(parents=True, exist_ok=True)
    with rc.open("a") as f:
        f.write(snippet)
    return rc.name


def _normalise_model(value):
    """Ensure value is provider,model — default provider is openrouter."""
    if "," not in value:
        return f"openrouter,{value}"
    return value


def _scaffold_configs():
    if not ROUTING_CONFIG.exists():
        save_routing(dict(ROUTING_SCAFFOLD))
    if not CCR_CONFIG.exists():
        CCR_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        CCR_CONFIG.write_text(json.dumps(CCR_DAEMON_SCAFFOLD, indent=2) + "\n")


# ── main ────────────────────────────────────────────────


def main():
    args = sys.argv[1:]
    if not args:
        cmd_status()
    elif args[0] == "key":
        cmd_key(args[1:])
    elif args[0] == "default":
        cmd_default(args[1:])
    elif args[0] == "agent":
        cmd_agent(args[1:])
    elif args[0] == "install":
        cmd_install()
    else:
        print(f"unknown command '{args[0]}' — try: install, key, default, agent")


if __name__ == "__main__":
    main()
