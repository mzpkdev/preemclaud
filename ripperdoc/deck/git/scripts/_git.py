"""Shared git helpers for status, commit, and deconflict scripts."""

import subprocess
import sys

DIFF_LINE_LIMIT = 500


def run(cmd: list[str], *, warn: bool = False) -> str:
    """Run a command, return stdout or '' on failure.

    Uses rstrip to preserve leading whitespace — critical for
    git status --porcelain where column 0 can be a space.
    """
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
    if r.returncode != 0:
        if warn and r.stderr:
            print(f"warning: {' '.join(cmd)}: {r.stderr.strip()}", file=sys.stderr)
        return ""
    return r.stdout.rstrip()


def truncate(text: str, limit: int) -> str:
    lines = text.splitlines(True)
    if len(lines) <= limit:
        return text
    return "".join(lines[:limit]) + f"\n... ({len(lines)} lines total, truncated to {limit})"


def get_diff(path: str, staged: bool = False) -> str:
    cmd = ["git", "diff"]
    if staged:
        cmd.append("--cached")
    cmd += ["--", path]
    diff = run(cmd)
    return truncate(diff, DIFF_LINE_LIMIT) if diff else ""


def read_file(path: str, limit: int) -> str:
    try:
        with open(path, "r", errors="ignore") as f:
            return truncate(f.read(), limit)
    except (OSError, UnicodeDecodeError):
        return "(binary or unreadable)"
