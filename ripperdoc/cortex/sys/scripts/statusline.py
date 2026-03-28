#!/usr/bin/env python3
# preemclaud statusline — session-aware status bar for Claude Code
# stdin: JSON session data from Claude Code

import json
import os
import sys

if sys.platform == "win32":
    os.system("")  # enable VT100 escape processing on Windows 10+

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
DIM    = "\033[2m"
RESET  = "\033[0m"

MODEL_SHORT = {
    "claude-opus-4-6":    "Opus 4.6",
    "claude-opus-4":      "Opus 4",
    "claude-sonnet-4-6":  "Sonnet 4.6",
    "claude-sonnet-4-5":  "Sonnet 4.5",
    "claude-sonnet-4":    "Sonnet 4",
    "claude-haiku-4-5":   "Haiku 4.5",
    "claude-haiku-4":     "Haiku 4",
    "claude-3-5-sonnet":  "Sonnet 3.5",
    "claude-3-5-haiku":   "Haiku 3.5",
    "claude-3-opus":      "Opus 3",
}


def fmt_tokens(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    return f"{round(n / 1000)}k"


def model_name(data):
    try:
        model = data.get("model", {})
        display = model.get("display_name", "")
        if display:
            return display.replace("Claude ", "").strip()
        mid = model.get("id", "")
        if mid:
            return MODEL_SHORT.get(mid, mid.split("-")[-1].title())
    except Exception:
        pass
    return ""


def context_bar(data):
    try:
        ctx = data.get("context_window", {})
        pct = ctx.get("used_percentage")
        if pct is None:
            return ""
        pct = max(0.0, min(100.0, float(pct)))
        filled = round(pct / 10)
        bar = "\u25b0" * filled + "\u25b1" * (10 - filled)
        color = RED if pct >= 85 else YELLOW if pct >= 60 else GREEN
        bar_str = f"{color}{bar}{RESET} {pct:.0f}%"
        inp = ctx.get("total_input_tokens")
        out = ctx.get("total_output_tokens", 0)
        limit = ctx.get("context_window_size")
        if inp is not None and limit:
            bar_str += f" {fmt_tokens(int(inp) + int(out))}/{fmt_tokens(int(limit))}"
        return bar_str
    except Exception:
        return ""


def effort_level():
    try:
        val = os.environ.get("CLAUDE_CODE_EFFORT_LEVEL", "")
        if val and val != "unset":
            return {"medium": "med"}.get(val, val)
    except Exception:
        pass
    return ""


def branch_name(data):
    try:
        wt = data.get("worktree", {})
        return wt.get("branch") or wt.get("name") or ""
    except Exception:
        return ""


def main():
    try:
        raw = json.load(sys.stdin)
        data = raw.get("data", raw)
        segments = [model_name(data), context_bar(data), effort_level(), branch_name(data)]
        segments = [s for s in segments if s]
        print(" | ".join(segments) if segments else "\u2013")
    except Exception:
        print("\u2013")


main()
