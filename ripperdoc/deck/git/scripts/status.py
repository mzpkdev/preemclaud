#!/usr/bin/env python3
"""Gather all git state for status summary. Outputs JSON to stdout.

Runs precondition checks, collects dirty files with diffs, branch info,
last commit, stash list, and ahead/behind tracking — all in a single call.
"""

import json
import os
import subprocess
import sys

DIFF_LINE_LIMIT = 500
FILE_READ_LIMIT = 80


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
    """Return dict with warnings (not fatal for status — it's read-only)."""
    warnings = []

    if not run(["git", "rev-parse", "--is-inside-work-tree"]):
        return {"fatal": "not_git_repo"}

    if not run(["git", "symbolic-ref", "-q", "HEAD"]):
        warnings.append("detached_head")

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
                warnings.append(issue)

    return {"warnings": warnings} if warnings else {}


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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # 1. Preconditions
    precond = check_preconditions()
    if "fatal" in precond:
        json.dump({"fatal": precond["fatal"]}, sys.stdout, indent=2)
        return

    # 2. Gather git metadata
    porcelain = run(["git", "status", "--porcelain"])
    numstat = run(["git", "diff", "--numstat"])
    cached_numstat = run(["git", "diff", "--cached", "--numstat"])
    last_commit = run(["git", "log", "--oneline", "-1", "--format=%h %s (%cr)"])
    branch = run(["git", "branch", "--show-current"])
    stash_list = run(["git", "stash", "list"])
    ahead_behind = run(["git", "rev-list", "--left-right", "--count", "@{upstream}...HEAD"])

    # Parse ahead/behind
    remote_tracking = {}
    if ahead_behind:
        parts = ahead_behind.split()
        if len(parts) == 2:
            remote_tracking = {
                "behind": int(parts[0]),
                "ahead": int(parts[1]),
            }

    # Detect detached HEAD ref
    detached_ref = ""
    if precond.get("warnings") and "detached_head" in precond["warnings"]:
        detached_ref = run(["git", "rev-parse", "--short", "HEAD"])

    # 3. Early exit if clean
    if not porcelain:
        result = {
            "clean": True,
            "branch": branch or f"(detached at {detached_ref})",
            "last_commit": last_commit,
            "remote_tracking": remote_tracking,
            "stashes": stash_list.splitlines() if stash_list else [],
        }
        if precond.get("warnings"):
            result["warnings"] = precond["warnings"]
        json.dump(result, sys.stdout, indent=2)
        return

    # 4. Process files
    files = []
    staged_count = 0
    unstaged_count = 0
    untracked_count = 0

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
            untracked_count += 1
        elif wt == "D" or idx == "D":
            cat = "deleted"
            if idx == "D" and wt == " ":
                staged_count += 1
            else:
                unstaged_count += 1
        elif idx in "AMDR" and wt == " ":
            cat = "staged"
            staged_count += 1
        elif idx in "AMDR" and wt != " ":
            cat = "staged+modified"
            staged_count += 1
            unstaged_count += 1
        else:
            cat = "modified"
            unstaged_count += 1

        # Collect diff
        if cat == "untracked":
            diff = read_file(path)
        elif cat == "deleted":
            diff = "(deleted)"
        elif cat == "staged":
            diff = get_diff(path, staged=True)
        elif cat == "staged+modified":
            diff = get_diff(path, staged=True)
            unstaged_diff = get_diff(path, staged=False)
            if unstaged_diff:
                diff += "\n--- unstaged changes ---\n" + unstaged_diff
        else:
            diff = get_diff(path, staged=False)

        entry = {
            "path": path,
            "status": line[:2].rstrip(),
            "category": cat,
            "diff": diff,
        }
        if renamed_from:
            entry["renamed_from"] = renamed_from
        files.append(entry)

    # 5. Compute stats from --numstat (actual line counts, not visual bars)
    total_add = 0
    total_del = 0
    for line in (numstat + "\n" + cached_numstat).splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and parts[0] != "-":  # "-" means binary
            total_add += int(parts[0])
            total_del += int(parts[1])

    # 6. Output
    result = {
        "branch": branch or f"(detached at {detached_ref})",
        "last_commit": last_commit,
        "remote_tracking": remote_tracking,
        "stashes": stash_list.splitlines() if stash_list else [],
        "files": files,
        "total_files": len(files),
        "staged_count": staged_count,
        "unstaged_count": unstaged_count,
        "untracked_count": untracked_count,
        "stats": {"add": total_add, "del": total_del},
    }
    if precond.get("warnings"):
        result["warnings"] = precond["warnings"]

    json.dump(result, sys.stdout, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": f"gather failed: {e}"}))
