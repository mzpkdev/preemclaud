#!/usr/bin/env python3
"""Gather git state for merge/rebase operations. Outputs JSON to stdout.

Three modes:
  --status            Lightweight: preconditions, dirty tree, in-progress state (no target)
  --context <target>  Pre-operation: preconditions, dirty tree, cross-branch context
  --conflicts         Post-operation: list conflicted files with parsed hunks
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


MAX_CONTENT_LINES = 500


def run(cmd):
    """Run a command, return stdout or '' on failure."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.rstrip() if r.returncode == 0 else ""


def repo_root():
    """Return the absolute path to the repo root."""
    return run(["git", "rev-parse", "--show-toplevel"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def check_preconditions():
    """Check basic git preconditions. Returns (result_dict, git_dir) or dumps fatal JSON and returns None."""
    if not run(["git", "rev-parse", "--is-inside-work-tree"]):
        json.dump({"fatal": "not_git_repo"}, sys.stdout, indent=2)
        return None

    if not run(["git", "symbolic-ref", "-q", "HEAD"]):
        json.dump({"fatal": "detached_head"}, sys.stdout, indent=2)
        return None

    result = {"current_branch": run(["git", "branch", "--show-current"])}
    git_dir = run(["git", "rev-parse", "--git-dir"])
    return result, git_dir


def detect_in_progress(git_dir):
    """Detect in-progress operation and its target branch."""
    if not git_dir:
        return None, None

    markers = [
        ("MERGE_HEAD", "merge"),
        ("rebase-merge", "rebase"),
        ("rebase-apply", "rebase"),
        ("CHERRY_PICK_HEAD", "cherry_pick"),
    ]

    in_progress = None
    for marker, op_type in markers:
        if os.path.exists(os.path.join(git_dir, marker)):
            in_progress = op_type
            break

    if not in_progress:
        return None, None

    # Try to identify the target of the in-progress operation
    in_progress_target = None
    if in_progress == "merge":
        merge_head = os.path.join(git_dir, "MERGE_HEAD")
        sha = Path(merge_head).read_text().strip() if os.path.isfile(merge_head) else ""
        if sha:
            # Resolve SHA to a branch name
            name = run(["git", "name-rev", "--name-only", "--no-undefined", sha])
            in_progress_target = name if name else sha[:10]
    elif in_progress == "rebase":
        for onto_path in ["rebase-merge/onto", "rebase-apply/onto"]:
            full = os.path.join(git_dir, onto_path)
            if os.path.isfile(full):
                sha = Path(full).read_text().strip()
                name = run(["git", "name-rev", "--name-only", "--no-undefined", sha])
                in_progress_target = name if name else sha[:10]
                break
    elif in_progress == "cherry_pick":
        cp_head = os.path.join(git_dir, "CHERRY_PICK_HEAD")
        sha = Path(cp_head).read_text().strip() if os.path.isfile(cp_head) else ""
        if sha:
            in_progress_target = sha[:10]

    return in_progress, in_progress_target


def gather_dirty_state():
    """Check for dirty working tree."""
    porcelain = run(["git", "status", "--porcelain"])
    return {
        "dirty_files": porcelain.splitlines() if porcelain else [],
        "is_dirty": bool(porcelain),
    }


# ---------------------------------------------------------------------------
# Status mode: lightweight state check (no target required)
# ---------------------------------------------------------------------------
def gather_status():
    """Check preconditions, dirty tree, and in-progress state without a target."""
    pre = check_preconditions()
    if pre is None:
        return
    result, git_dir = pre

    in_progress, in_progress_target = detect_in_progress(git_dir)
    result["in_progress"] = in_progress
    result["in_progress_target"] = in_progress_target
    result.update(gather_dirty_state())

    json.dump(result, sys.stdout, indent=2)


# ---------------------------------------------------------------------------
# Context mode: preconditions + cross-branch analysis
# ---------------------------------------------------------------------------
def gather_context(target):
    """Gather pre-operation state and cross-branch context."""
    pre = check_preconditions()
    if pre is None:
        return
    result, git_dir = pre

    in_progress, in_progress_target = detect_in_progress(git_dir)
    result["in_progress"] = in_progress
    result["in_progress_target"] = in_progress_target
    result.update(gather_dirty_state())

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
    root = repo_root()
    conflicted = run(["git", "diff", "--name-only", "--diff-filter=U"])

    if not conflicted:
        json.dump({"conflicted_files": [], "total_conflicts": 0}, sys.stdout, indent=2)
        return

    files = []
    total_hunks = 0

    for rel_path in conflicted.splitlines():
        rel_path = rel_path.strip()
        if not rel_path:
            continue

        abs_path = os.path.join(root, rel_path) if root else rel_path

        # Check if binary by looking for null bytes
        is_binary = False
        if os.path.isfile(abs_path):
            try:
                with open(abs_path, "rb") as f:
                    chunk = f.read(8192)
                    is_binary = b"\x00" in chunk
            except OSError:
                is_binary = True

        if is_binary or not os.path.isfile(abs_path):
            files.append({
                "path": rel_path,
                "binary": True,
                "hunks": [],
                "hunk_count": 0,
            })
            continue

        # Read file and parse conflict markers
        try:
            with open(abs_path, "r", errors="replace") as f:
                content = f.read()
        except OSError:
            files.append({
                "path": rel_path,
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

        # Cap full_content to avoid blowing the context window
        content_lines = content.splitlines(True)
        truncated = len(content_lines) > MAX_CONTENT_LINES
        if truncated:
            content = "".join(content_lines[:MAX_CONTENT_LINES])

        files.append({
            "path": rel_path,
            "binary": False,
            "hunks": hunks,
            "hunk_count": len(hunks),
            "full_content": content,
            "truncated": truncated,
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
    parser = argparse.ArgumentParser(description="Gather git state for deconflict operations.")
    parser.add_argument("--status", action="store_true", help="Lightweight state check (no target required)")
    parser.add_argument("--context", metavar="TARGET", help="Pre-operation: gather context against target branch")
    parser.add_argument("--conflicts", action="store_true", help="Post-operation: parse conflicted files")
    args = parser.parse_args()

    if args.status:
        gather_status()
    elif args.context:
        gather_context(args.context)
    elif args.conflicts:
        gather_conflicts()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
