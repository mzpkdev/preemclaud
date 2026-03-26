#!/usr/bin/env python3
"""PreToolUse hook — inject CCR subagent routing tag into Agent prompts."""
import json, os, sys
from pathlib import Path

ROUTING_CONFIG = Path.home() / ".claude" / "routing.json"


def detect_tier(model):
    if not model:
        return None
    low = model.lower()
    for tier in ("opus", "sonnet", "haiku"):
        if tier in low:
            return tier
    return None


def resolve(name, model, cfg):
    overrides = cfg.get("override", {})
    if name and name in overrides:
        return overrides[name]           # None = pin native, str = route
    tier = detect_tier(model)
    if tier:
        route = cfg.get("models", {}).get(tier)
        if route:
            return route
    return None


def main():
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input", {})

    # Not behind CCRouter — no-op
    base_url = os.environ.get("ANTHROPIC_BASE_URL", "")
    if "localhost" not in base_url and "127.0.0.1" not in base_url:
        return print("{}")

    # Already tagged — pass through
    if "<CCR-SUBAGENT-MODEL>" in tool_input.get("prompt", ""):
        return print("{}")

    # Load config
    try:
        cfg = json.loads(ROUTING_CONFIG.read_text())
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return print("{}")

    # Resolve route
    target = resolve(tool_input.get("name"), tool_input.get("model", ""), cfg)
    if not target:
        return print("{}")

    # Inject tag via updatedInput
    tag = f"<CCR-SUBAGENT-MODEL>{target}</CCR-SUBAGENT-MODEL>"
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": {
                **tool_input,
                "prompt": f"{tag}\n{tool_input.get('prompt', '')}",
            },
        }
    }))


if __name__ == "__main__":
    main()
