#!/usr/bin/env python3
"""Gather git state for merge/rebase operations. Outputs JSON to stdout.

Two modes:
  --context <target>  Pre-operation: preconditions, dirty tree, cross-branch context
  --conflicts         Post-operation: list conflicted files with parsed hunks
"""

import argparse
import json
import os
import subprocess
import sys


def run(cmd):
    """Run a command, return stdout or '' on failure."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.rstrip() if r.returncode == 0 else ""


# ---------------------------------------------------------------------------
# Context mode: preconditions + cross-branch analysis
# ---------------------------------------------------------------------------
def gather_context(target):
    """Gather pre-operation state and cross-branch context."""
    result = {}

    # Preconditions
    if not run(["git", "rev-parse", "--is-inside-work-tree"]):
        json.dump({"fatal": "not_git_repo"}, sys.stdout, indent=2)
        return

    if not run(["git", "symbolic-ref", "-q", "HEAD"]):
        json.dump({"fatal": "detached_head"}, sys.stdout, indent=2)
        return

    result["current_branch"] = run(["git", "branch", "--show-current"])

    # Check for in-progress operations
    git_dir = run(["git", "rev-parse", "--git-dir"])
    in_progress = None
    if git_dir:
        markers = [
            ("MERGE_HEAD", "merge"),
            ("rebase-merge", "rebase"),
            ("rebase-apply", "rebase"),
            ("CHERRY_PICK_HEAD", "cherry_pick"),
        ]
        for marker, op_type in markers:
            if os.path.exists(os.path.join(git_dir, marker)):
                in_progress = op_type
                break

    result["in_progress"] = in_progress

    # Dirty working tree check
    porcelain = run(["git", "status", "--porcelain"])
    result["dirty_files"] = porcelain.splitlines() if porcelain else []
    result["is_dirty"] = bool(porcelain)

    # If resuming an in-progress operation, skip cross-branch context
    if in_progress:
        json.dump(result, sys.stdout, indent=2)
        return

    # Verify target exists
    if not run(["git", "rev-parse", "--verify", target]):
        # Try with origin/ prefix
        if not run(["git", "rev-parse", "--verify", f"origin/{target}"]):
            json.dump({**result, "fatal": f"branch_not_found: {target}"}, sys.stdout, indent=2)
            return
        target = f"origin/{target}"

    result["target"] = target

    # Cross-branch context
    result["incoming_commits"] = run(["git", "log", "--oneline", f"HEAD..{target}"])
    result["our_commits"] = run(["git", "log", "--oneline", f"{target}..HEAD"])
    result["incoming_stat"] = run(["git", "diff", "--stat", f"HEAD...{target}"])
    result["our_stat"] = run(["git", "diff", "--stat", f"{target}...HEAD"])

    # Count commits
    incoming_lines = result["incoming_commits"].splitlines() if result["incoming_commits"] else []
    our_lines = result["our_commits"].splitlines() if result["our_commits"] else []
    result["incoming_count"] = len(incoming_lines)
    result["our_count"] = len(our_lines)

    # Check if already up to date
    result["up_to_date"] = len(incoming_lines) == 0

    json.dump(result, sys.stdout, indent=2)


# ---------------------------------------------------------------------------
# Conflicts mode: parse conflicted files
# ---------------------------------------------------------------------------
def gather_conflicts():
    """List conflicted files and parse their conflict hunks."""
    conflicted = run(["git", "diff", "--name-only", "--diff-filter=U"])

    if not conflicted:
        json.dump({"conflicted_files": [], "total_conflicts": 0}, sys.stdout, indent=2)
        return

    files = []
    total_hunks = 0

    for path in conflicted.splitlines():
        path = path.strip()
        if not path:
            continue

        # Check if binary by looking for null bytes
        is_binary = False
        if os.path.isfile(path):
            try:
                with open(path, "rb") as f:
                    chunk = f.read(8192)
                    is_binary = b"\x00" in chunk
            except OSError:
                is_binary = True

        if is_binary or not os.path.isfile(path):
            files.append({
                "path": path,
                "binary": True,
                "hunks": [],
                "hunk_count": 0,
            })
            continue

        # Read file and parse conflict markers
        try:
            with open(path, "r", errors="replace") as f:
                content = f.read()
        except OSError:
            files.append({
                "path": path,
                "binary": True,
                "hunks": [],
                "hunk_count": 0,
            })
            continue

        hunks = []
        lines = content.splitlines(True)
        i = 0
        while i < len(lines):
            if lines[i].startswith("<<<<<<<"):
                ours_label = lines[i].strip()
                theirs_label = ""
                ours_lines = []
                theirs_lines = []
                start_line = i + 1
                in_theirs = False
                i += 1

                while i < len(lines):
                    if lines[i].startswith("======="):
                        in_theirs = True
                        i += 1
                        continue
                    if lines[i].startswith(">>>>>>>"):
                        theirs_label = lines[i].strip()
                        break
                    if in_theirs:
                        theirs_lines.append(lines[i].rstrip("\n"))
                    else:
                        ours_lines.append(lines[i].rstrip("\n"))
                    i += 1

                hunks.append({
                    "start_line": start_line,
                    "ours_label": ours_label,
                    "theirs_label": theirs_label,
                    "ours": ours_lines,
                    "theirs": theirs_lines,
                })
                total_hunks += 1
            i += 1

        files.append({
            "path": path,
            "binary": False,
            "hunks": hunks,
            "hunk_count": len(hunks),
            "full_content": content,
        })

    json.dump({
        "conflicted_files": files,
        "total_conflicts": total_hunks,
        "total_files": len(files),
    }, sys.stdout, indent=2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Gather git state for resolve operations.")
    parser.add_argument("--context", metavar="TARGET", help="Pre-operation: gather context against target branch")
    parser.add_argument("--conflicts", action="store_true", help="Post-operation: parse conflicted files")
    args = parser.parse_args()

    if args.context:
        gather_context(args.context)
    elif args.conflicts:
        gather_conflicts()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
