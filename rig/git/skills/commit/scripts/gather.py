#!/usr/bin/env python3
"""Gather all git state for commit planning. Outputs JSON to stdout.

Runs precondition checks, collects dirty files with diffs, scans for
safety issues (secrets, large files, junk, build artifacts), and grabs
recent commit history for convention detection — all in a single call.
"""

import json
import os
import re
import subprocess
import sys

# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------
DIFF_LINE_LIMIT = 500        # truncate per-file diffs beyond this
FILE_READ_LIMIT = 200         # max lines to read for untracked files
LARGE_THRESHOLD = 1_000_000   # 1 MB
SECRET_SCAN_LIMIT = 100_000   # only scan content of files under this size

# ---------------------------------------------------------------------------
# Safety patterns
# ---------------------------------------------------------------------------
SECRET_NAMES = {
    ".env", ".env.local", ".env.production", ".env.development",
    ".env.staging", ".env.test",
}
SECRET_EXTENSIONS = {".pem", ".key", ".p12", ".pfx", ".keystore"}
SECRET_CONTENT_RE = re.compile(
    r"(API_KEY|SECRET|TOKEN|PRIVATE_KEY|PASSWORD"
    r"|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*=\s*\S"
)
JUNK_NAMES = {".DS_Store", "Thumbs.db"}
JUNK_EXTENSIONS = {".swp", ".swo"}
BUILD_DIRS = {
    "node_modules", "__pycache__", "dist", "build",
    ".next", "target", "vendor",
}
LOCK_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Gemfile.lock", "poetry.lock", "Cargo.lock", "composer.lock",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def run(cmd):
    """Run a command, return stdout or '' on failure.

    Uses rstrip to preserve leading whitespace — critical for
    git status --porcelain where column 0 can be a space.
    """
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.rstrip() if r.returncode == 0 else ""


def truncate(text, limit):
    lines = text.splitlines(True)
    if len(lines) <= limit:
        return text
    return "".join(lines[:limit]) + f"\n... ({len(lines)} lines total, truncated to {limit})"


# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
def check_preconditions():
    """Return list of issue strings. Empty means all clear."""
    issues = []
    if not run(["git", "rev-parse", "--is-inside-work-tree"]):
        return ["not_git_repo"]

    if not run(["git", "symbolic-ref", "-q", "HEAD"]):
        issues.append("detached_head")

    git_dir = run(["git", "rev-parse", "--git-dir"])
    if git_dir:
        markers = [
            ("MERGE_HEAD",    "merge_in_progress"),
            ("rebase-merge",  "rebase_in_progress"),
            ("rebase-apply",  "rebase_in_progress"),
            ("BISECT_LOG",    "bisect_in_progress"),
        ]
        for marker, issue in markers:
            if os.path.exists(os.path.join(git_dir, marker)):
                issues.append(issue)
    return issues


# ---------------------------------------------------------------------------
# Safety scanning
# ---------------------------------------------------------------------------
def scan_safety(path):
    """Return list of {type, reason} flags for a file path."""
    flags = []
    name = os.path.basename(path)
    _, ext = os.path.splitext(name)

    # Filename / extension checks
    if name in SECRET_NAMES or name.startswith(".env."):
        flags.append({"type": "secrets", "reason": f"Secret file: {name}"})
    if ext in SECRET_EXTENSIONS:
        flags.append({"type": "secrets", "reason": f"Key/cert file: {name}"})
    if "credentials" in name.lower() or "secret" in name.lower():
        flags.append({"type": "secrets", "reason": f"Name contains credentials/secret"})

    if name in JUNK_NAMES or ext in JUNK_EXTENSIONS:
        flags.append({"type": "junk", "reason": f"OS/editor file: {name}"})

    for part in path.split("/"):
        if part in BUILD_DIRS:
            flags.append({"type": "build", "reason": f"Inside {part}/"})
            break

    if name in LOCK_FILES:
        flags.append({"type": "lock", "reason": "Lock file (may be intentional)"})

    # Large file check
    if os.path.isfile(path):
        try:
            size = os.path.getsize(path)
            if size > LARGE_THRESHOLD:
                flags.append({"type": "large", "reason": f"{size / 1e6:.1f} MB"})
        except OSError:
            pass

    # Content scan for secrets (small, not-already-flagged files)
    if not any(f["type"] == "secrets" for f in flags) and os.path.isfile(path):
        try:
            if os.path.getsize(path) < SECRET_SCAN_LIMIT:
                with open(path, "r", errors="ignore") as f:
                    chunk = f.read(10_000)
                m = SECRET_CONTENT_RE.search(chunk)
                if m:
                    flags.append({"type": "secrets", "reason": f"Contains {m.group(1)}=..."})
        except (OSError, UnicodeDecodeError):
            pass

    return flags


# ---------------------------------------------------------------------------
# Diff collection
# ---------------------------------------------------------------------------
def get_diff(path, staged=False):
    cmd = ["git", "diff"]
    if staged:
        cmd.append("--cached")
    cmd += ["--", path]
    d = run(cmd)
    return truncate(d, DIFF_LINE_LIMIT) if d else ""


def read_file(path):
    try:
        with open(path, "r", errors="ignore") as f:
            return truncate(f.read(), FILE_READ_LIMIT)
    except (OSError, UnicodeDecodeError):
        return "(binary or unreadable)"


def parse_numstat(raw):
    """Parse git diff --numstat → {path: {add, del}}."""
    stats = {}
    for line in raw.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            add, delete, path = parts
            # Handle renames: {old => new}/rest
            if " => " in path:
                path = re.sub(r"\{[^}]*=> ([^}]*)\}", r"\1", path)
            stats[path] = {
                "add": int(add) if add != "-" else 0,
                "del": int(delete) if delete != "-" else 0,
            }
    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # 1. Preconditions
    issues = check_preconditions()
    if issues:
        json.dump({"precondition_failures": issues}, sys.stdout, indent=2)
        return

    # 2. Gather raw git data
    porcelain = run(["git", "status", "--porcelain"])
    if not porcelain:
        json.dump({"clean": True}, sys.stdout, indent=2)
        return

    staged_numstat = parse_numstat(run(["git", "diff", "--cached", "--numstat"]))
    unstaged_numstat = parse_numstat(run(["git", "diff", "--numstat"]))
    recent_log = run(["git", "log", "--oneline", "-20"])

    # 3. Process each file
    files = []
    for line in porcelain.splitlines():
        if len(line) < 4:
            continue

        idx, wt, path = line[0], line[1], line[3:]
        renamed_from = None
        if " -> " in path:
            renamed_from, path = path.split(" -> ", 1)

        # Categorize
        if idx == "?" and wt == "?":
            cat = "untracked"
        elif wt == "D" or idx == "D":
            cat = "deleted"
        elif idx in "AMDR" and wt == " ":
            cat = "staged"
        elif idx in "AMDR" and wt != " ":
            cat = "staged+modified"
        else:
            cat = "modified"

        # Collect diff
        if cat == "untracked":
            diff = read_file(path)
        elif cat == "deleted":
            diff = "(deleted)"
        elif cat in ("staged", "staged+modified"):
            diff = get_diff(path, staged=True)
        else:
            diff = get_diff(path, staged=False)

        # Numstat
        stat = staged_numstat.get(path) or unstaged_numstat.get(path) or {}

        entry = {
            "path": path,
            "status": line[:2].rstrip(),
            "category": cat,
            "stat": stat,
            "diff": diff,
            "flags": scan_safety(path),
        }
        if renamed_from:
            entry["renamed_from"] = renamed_from
        files.append(entry)

    # 4. Output
    result = {
        "files": files,
        "recent_commits": recent_log,
        "total_files": len(files),
        "flagged_count": sum(1 for f in files if f["flags"]),
        "staged_count": sum(1 for f in files if f["category"] in ("staged", "staged+modified")),
    }
    json.dump(result, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
