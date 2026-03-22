#!/usr/bin/env python3
"""Scope the diff for code review. Outputs JSON to stdout."""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile


def die(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def run(cmd, check=True):
    """Run a command (list of args), return stripped stdout."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    if check and r.returncode != 0:
        if r.stderr.strip():
            print(f"  warn: {' '.join(cmd)}: {r.stderr.strip()}", file=sys.stderr)
        return ""
    return r.stdout.strip()


def detect_main_branch():
    """3-level fallback: symbolic-ref, remote show, local branch list."""
    # 1. Local symbolic ref (works offline)
    main = run(["git", "symbolic-ref", "refs/remotes/origin/HEAD"])
    if main:
        return re.sub(r"^refs/remotes/origin/", "", main)

    # 2. Ask remote
    out = run(["git", "remote", "show", "origin"])
    for line in out.splitlines():
        if "HEAD branch" in line:
            branch = line.split(":")[-1].strip()
            if branch:
                return branch

    # 3. Guess from local branches
    out = run(["git", "branch", "--list", "main", "master", "develop"])
    for line in out.splitlines():
        name = line.strip().lstrip("* ")
        if name:
            return name

    die("cannot detect main branch")


def get_current_branch():
    return run(["git", "branch", "--show-current"])


def collect_diff(ref_range):
    """git diff for a ref range like 'abc123..HEAD'."""
    return run(["git", "diff", ref_range])


def collect_staged():
    return run(["git", "diff", "--cached"])


def collect_unstaged():
    return run(["git", "diff"])


def handle_pr(pr_arg):
    """Fetch PR metadata, create worktree, compute diff, clean up."""
    if not shutil.which("gh"):
        die("gh CLI required for --pr mode")

    # Fetch metadata in one call
    raw = run(["gh", "pr", "view", pr_arg, "--json",
               "headRefName,baseRefName,number,title,url"])
    if not raw:
        die(f"could not fetch PR {pr_arg}")
    meta = json.loads(raw)

    head = meta["headRefName"]
    base = meta["baseRefName"]
    number = meta["number"]

    # Worktree for isolated checkout
    worktree = tempfile.mkdtemp(prefix=f"review-pr-{number}-")
    try:
        run(["git", "fetch", "origin", head])
        r = subprocess.run(
            ["git", "worktree", "add", worktree, f"origin/{head}"],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            die(f"failed to create worktree: {r.stderr.strip()}")

        merge_base = run(["git", "-C", worktree, "merge-base",
                          f"origin/{base}", "HEAD"])
        if not merge_base:
            die(f"cannot compute merge-base for PR #{number}")

        diff = run(["git", "-C", worktree, "diff", f"{merge_base}..HEAD"])
    finally:
        subprocess.run(
            ["git", "worktree", "remove", "--force", worktree],
            capture_output=True,
        )

    pr_meta = {
        "number": number,
        "title": meta["title"],
        "url": meta["url"],
        "base": base,
        "head": head,
    }
    return pr_meta, merge_base, diff


def compute_metadata(*diffs):
    """Count files and lines changed across all diff texts."""
    combined = "\n".join(d for d in diffs if d)
    files = 0
    adds = 0
    dels = 0
    for line in combined.splitlines():
        if line.startswith("diff --git"):
            files += 1
        elif line.startswith("+") and not line.startswith("+++"):
            adds += 1
        elif line.startswith("-") and not line.startswith("---"):
            dels += 1
    total = adds + dels
    return files, total, total > 500


def main():
    parser = argparse.ArgumentParser(description="Scope the diff for code review.")
    parser.add_argument("arg", nargs="?", metavar="PR_OR_BRANCH",
                        help="PR number/URL or branch name (auto-detected)")
    parser.add_argument("--pr", metavar="URL_OR_NUMBER", help="Review a PR")
    parser.add_argument("--ref", metavar="BRANCH", help="Diff against a specific branch")
    parser.add_argument("--max-diff-lines", type=int, default=10000, metavar="N",
                        help="Truncate diffs that exceed N total lines (default: 10000)")
    args = parser.parse_args()

    # Auto-route bare positional arg → --pr or --ref
    if args.arg and not args.pr and not args.ref:
        val = args.arg
        if re.match(r"^\d+$", val) or "github.com" in val or val.startswith("http"):
            args.pr = val
        else:
            args.ref = val

    # Sanity checks
    if not run(["git", "rev-parse", "--is-inside-work-tree"]):
        die("not in a git repo")

    main_branch = detect_main_branch()
    current_branch = get_current_branch()

    result = {
        "main_branch": main_branch,
        "current_branch": current_branch,
        "merge_base": "",
        "sources": [],
        "diff": {"branch": "", "staged": "", "unstaged": ""},
    }

    if args.pr:
        # PR mode
        pr_meta, merge_base, branch_diff = handle_pr(args.pr)
        result["mode"] = "pr"
        result["merge_base"] = merge_base
        result["pr"] = pr_meta
        result["diff"]["branch"] = branch_diff
        if branch_diff:
            result["sources"].append("branch")

    elif args.ref:
        # Explicit ref mode
        ref = args.ref
        run(["git", "fetch", "origin", ref], check=False)
        merge_base = run(["git", "merge-base", f"origin/{ref}", "HEAD"])
        if not merge_base:
            # fallback: local ref (e.g. not on origin, or detached)
            merge_base = run(["git", "merge-base", ref, "HEAD"])
        if not merge_base:
            die(f"cannot compute merge-base against {ref}")
        result["mode"] = "ref"
        result["merge_base"] = merge_base
        result["diff"]["branch"] = collect_diff(f"{merge_base}..HEAD")
        result["diff"]["staged"] = collect_staged()
        result["diff"]["unstaged"] = collect_unstaged()
        for key in ("branch", "staged", "unstaged"):
            if result["diff"][key]:
                result["sources"].append(key)

    elif current_branch and current_branch != main_branch:
        # Feature branch
        merge_base = run(["git", "merge-base", main_branch, "HEAD"])
        if not merge_base:
            merge_base = run(["git", "merge-base", f"origin/{main_branch}", "HEAD"])
        if not merge_base:
            die(f"cannot compute merge-base against {main_branch}")
        result["mode"] = "branch"
        result["merge_base"] = merge_base
        result["diff"]["branch"] = collect_diff(f"{merge_base}..HEAD")
        result["diff"]["staged"] = collect_staged()
        result["diff"]["unstaged"] = collect_unstaged()
        for key in ("branch", "staged", "unstaged"):
            if result["diff"][key]:
                result["sources"].append(key)

    else:
        # On main or detached HEAD — uncommitted work only
        result["mode"] = "main"
        result["diff"]["staged"] = collect_staged()
        result["diff"]["unstaged"] = collect_unstaged()
        for key in ("staged", "unstaged"):
            if result["diff"][key]:
                result["sources"].append(key)

    # Compute metadata from all diffs
    files, lines, large = compute_metadata(
        result["diff"]["branch"],
        result["diff"]["staged"],
        result["diff"]["unstaged"],
    )
    result["files_changed"] = files
    result["lines_changed"] = lines
    result["large_diff"] = large

    # Truncate diffs if total lines exceed the limit
    diff_keys = [k for k in ("branch", "staged", "unstaged") if result["diff"][k]]
    total_lines = sum(result["diff"][k].count("\n") + 1 for k in diff_keys) if diff_keys else 0
    if total_lines > args.max_diff_lines and diff_keys:
        result["truncated"] = True
        for k in diff_keys:
            section_lines = result["diff"][k].count("\n") + 1
            proportion = section_lines / total_lines
            allowed = max(1, int(args.max_diff_lines * proportion))
            lines = result["diff"][k].splitlines()
            if len(lines) > allowed:
                result["diff"][k] = "\n".join(lines[:allowed]) + \
                    f"\n[diff truncated at {allowed} lines — use --ref or file filters to narrow scope]"

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
