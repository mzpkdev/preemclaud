#!/usr/bin/env python3
"""Run mdformat --wrap 120 on all .md files except those under arasaka/."""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXCLUDE_DIRS = {"arasaka"}


def main() -> None:
    files = [
        p for p in REPO_ROOT.rglob("*.md") if not any(part in EXCLUDE_DIRS for part in p.relative_to(REPO_ROOT).parts)
    ]

    if not files:
        print("No .md files found.", file=sys.stderr)
        sys.exit(0)

    print(f"Formatting {len(files)} file(s)...", file=sys.stderr)

    result = subprocess.run(
        ["python3", "-m", "mdformat", "--wrap", "120"] + [str(f) for f in files],
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
