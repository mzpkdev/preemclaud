#!/usr/bin/env python3
"""SessionStart hook: ensure ~/.jetbrains/acp.json has the correct npx path."""

import json
import os
import shutil
import sys
from pathlib import Path

ACP_ENTRY = {
    "command": None,  # filled at runtime
    "args": ["@zed-industries/claude-agent-acp"],
    "env": {},
}


def main():
    # 1. ENV CHECK — Are we in a JetBrains context?
    terminal = os.environ.get("TERMINAL_EMULATOR", "")
    acp = os.environ.get("npm_lifecycle_script", "")
    if terminal != "JetBrains-JediTerm" and acp != "claude-agent-acp":
        return

    # 2. RESOLVE — Find current npx
    npx_path = shutil.which("npx")
    if not npx_path:
        return

    # 3. READ — Check existing config
    acp_file = Path.home() / ".jetbrains" / "acp.json"
    config = {}
    try:
        config = json.loads(acp_file.read_text())
        current = config.get("agent_servers", {}).get("Claude Code", {}).get("command")
        if current == npx_path:
            return  # nothing to do
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        pass

    # 4. MERGE + WRITE — Update only the Claude Code entry
    entry = dict(ACP_ENTRY)
    entry["command"] = npx_path

    if "agent_servers" not in config:
        config["agent_servers"] = {}
    config["agent_servers"]["Claude Code"] = entry

    try:
        acp_file.parent.mkdir(parents=True, exist_ok=True)
        acp_file.write_text(json.dumps(config, indent=2) + "\n")
    except OSError:
        return


if __name__ == "__main__":
    main()
