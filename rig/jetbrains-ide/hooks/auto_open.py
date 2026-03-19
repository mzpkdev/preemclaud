#!/usr/bin/env python3
"""PostToolUse hook: auto-open specs, briefs, and plans in the correct JetBrains IDE."""

import glob
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path, PurePath

MODULE_MAP = {
    "WEB_MODULE": "webstorm",
    "JAVA_MODULE": "idea",
    "PYTHON_MODULE": "pycharm",
    "GO_MODULE": "goland",
    "PHP_MODULE": "phpstorm",
    "RUBY_MODULE": "rubymine",
}

FILTER_DIRS = {"specs", "briefs", "plans"}


def main():
    # 1. ENV CHECK — Are we in a JetBrains context?
    terminal = os.environ.get("TERMINAL_EMULATOR", "")
    acp = os.environ.get("npm_lifecycle_script", "")
    if terminal != "JetBrains-JediTerm" and acp != "claude-agent-acp":
        return

    # Read PostToolUse input from stdin
    try:
        data = json.load(sys.stdin)
        file_path = data["tool_input"]["file_path"]
        cwd = data["cwd"]
    except (json.JSONDecodeError, KeyError):
        return

    # 2. PATH FILTER — Is this a spec/brief/plan?
    parts = PurePath(file_path).parts
    if not FILTER_DIRS.intersection(parts):
        return

    # 3. IDE DETECTION — Which IDE owns this project?
    idea_dir = os.path.join(cwd, ".idea")
    iml_files = glob.glob(os.path.join(idea_dir, "*.iml"))
    if not iml_files:
        return

    # Prefer <project-dir-name>.iml, fall back to first match
    project_name = os.path.basename(cwd)
    preferred = os.path.join(idea_dir, f"{project_name}.iml")
    iml = preferred if preferred in iml_files else iml_files[0]

    try:
        tree = ET.parse(iml)
        module_type = tree.getroot().get("type", "")
    except Exception:
        return

    # 4. MAP — Module type to CLI command
    ide = MODULE_MAP.get(module_type)
    if not ide:
        return

    # 5. RESOLVE — Normalize file path
    resolved = str(Path(cwd, file_path).resolve())

    # 6. LAUNCH — Fire and forget
    try:
        subprocess.Popen([ide, cwd, "--line", "1", resolved])
    except Exception:
        return


if __name__ == "__main__":
    main()
