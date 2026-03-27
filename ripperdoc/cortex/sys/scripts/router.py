#!/usr/bin/env python3
"""sys:router — view and configure CCR model routing."""

import json
import socket
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
        cfg.setdefault("models", {})[tier] = value
        save_routing(cfg)
        print(f"{tier} → {value}")


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
        overrides[name] = value
        save_routing(cfg)
        print(f"{name} → {value}")


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
    else:
        print(f"unknown command '{args[0]}' — try: key, default, agent")


if __name__ == "__main__":
    main()
