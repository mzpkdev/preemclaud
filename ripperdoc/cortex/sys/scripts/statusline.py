#!/usr/bin/env python3
# preemclaud statusline — session-aware status bar for Claude Code
# stdin: JSON session data from Claude Code

import datetime
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

if sys.platform == "win32":
    os.system("")  # enable VT100 escape processing on Windows 10+

CYAN    = "\033[96m"
YELLOW  = "\033[93m"
MAGENTA = "\033[95m"
DIM     = "\033[2m"
RESET   = "\033[0m"

SEP = f"{DIM} · {RESET}"

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

CLAUDE_DIR    = Path.home() / ".claude"
CREDS_FILE    = CLAUDE_DIR / ".credentials.json"
CACHE_FILE    = CLAUDE_DIR / ".cache" / "statusline.json"
USAGE_URL     = "https://api.anthropic.com/api/oauth/usage"
REFRESH_URL   = "https://platform.claude.com/v1/oauth/token"
ALLOWED_HOSTS = frozenset({"api.anthropic.com", "platform.claude.com"})
CACHE_TTL     = 60  # seconds
HTTP_TIMEOUT  = 4   # seconds

PLAN_NAMES = {
    "default_claude_ai":      "Pro",
    "default_claude_max_5x":  "Max 5x",
    "default_claude_max_20x": "Max 20x",
}


# ---------------------------------------------------------------------------
# Credential layer
# ---------------------------------------------------------------------------

def _read_credentials():
    """Return (access_token, refresh_token, plan) or None."""
    # 1. Credentials file
    try:
        data = json.loads(CREDS_FILE.read_text())
        oauth = data.get("claudeAiOauth", {})
        token = oauth.get("accessToken", "")
        refresh = oauth.get("refreshToken", "")
        tier = oauth.get("rateLimitTier", "")
        plan = PLAN_NAMES.get(tier, tier.replace("default_claude_", "").replace("_", " ").title() if tier else "")
        if token:
            return token, refresh, plan
    except Exception:
        pass

    # 2. macOS Keychain
    if sys.platform == "darwin":
        try:
            import subprocess
            result = subprocess.run(
                ["/usr/bin/security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
                capture_output=True, text=True, timeout=2,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout.strip())
                oauth = data.get("claudeAiOauth", {})
                token = oauth.get("accessToken", "")
                refresh = oauth.get("refreshToken", "")
                tier = oauth.get("rateLimitTier", "")
                plan = PLAN_NAMES.get(tier, "")
                if token:
                    return token, refresh, plan
        except Exception:
            pass

    # 3. Environment variable
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if token:
        return token, "", ""

    return None


def _refresh_token(refresh_token):
    """POST to token refresh endpoint. Returns new access token (in-memory only) or None."""
    if not refresh_token:
        return None
    try:
        host = urlparse(REFRESH_URL).hostname
        if host not in ALLOWED_HOSTS:
            return None
        body = json.dumps({"grant_type": "refresh_token", "refresh_token": refresh_token}).encode()
        req = urllib.request.Request(
            REFRESH_URL,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read())
            return data.get("access_token") or None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Cache layer
# ---------------------------------------------------------------------------

def _load_cache():
    """Return (usage_dict, plan, is_fresh). All values may be None/False on miss."""
    try:
        data = json.loads(CACHE_FILE.read_text())
        is_fresh = time.time() - data.get("timestamp", 0) < CACHE_TTL
        return data.get("usage"), data.get("plan", ""), is_fresh
    except Exception:
        return None, None, False


def _save_cache(usage, plan):
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps({"timestamp": time.time(), "usage": usage, "plan": plan})
        CACHE_FILE.write_text(payload)
        if sys.platform != "win32":
            CACHE_FILE.chmod(0o600)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# API layer
# ---------------------------------------------------------------------------

def _api_get(url, token):
    """Make a domain-locked GET request. Returns (status_code, parsed_json | None)."""
    host = urlparse(url).hostname
    if host not in ALLOWED_HOSTS:
        return None, None
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "anthropic-beta": "oauth-2025-04-20",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return None, None


def _fetch_usage():
    """Return (usage_dict, plan) or None. Handles caching and token refresh."""
    usage, plan, is_fresh = _load_cache()
    if is_fresh and usage is not None:
        return usage, plan

    creds = _read_credentials()
    if creds is None:
        return (usage, plan) if usage is not None else None

    token, refresh, detected_plan = creds
    effective_plan = plan or detected_plan

    status, data = _api_get(USAGE_URL, token)

    if status == 401 and refresh:
        new_token = _refresh_token(refresh)
        if new_token:
            status, data = _api_get(USAGE_URL, new_token)

    if status == 200 and data:
        _save_cache(data, detected_plan)
        return data, detected_plan

    # Fallback to stale cache on any failure
    if usage is not None:
        return usage, effective_plan

    return None


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _colored_bar(pct, low_thresh=50, mid_thresh=70, high_thresh=85):
    """Return a colored ━╌ bar string for the given percentage."""
    pct = max(0.0, min(100.0, float(pct)))
    filled = round(pct / 10)
    bar = "━" * filled + "╌" * (10 - filled)
    color = MAGENTA if pct >= high_thresh else YELLOW if pct >= mid_thresh else CYAN if pct >= low_thresh else ""
    return f"{color}{bar}{RESET}"


def _format_remaining(resets_at_str):
    """Format time remaining until reset as 'Xh YYm' or 'YYm'."""
    try:
        resets_at = datetime.datetime.fromisoformat(resets_at_str.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        secs = int((resets_at - now).total_seconds())
        if secs <= 0:
            return ""
        hours, remainder = divmod(secs, 3600)
        mins = remainder // 60
        if hours:
            return f"{hours}h {mins:02d}m"
        return f"{mins}m"
    except Exception:
        return ""


def _usage_segments():
    """Return list of status segments for session/weekly usage. Empty on any failure."""
    try:
        result = _fetch_usage()
        if not result:
            return []
        usage, _ = result
        if not usage:
            return []

        segments = []

        five_hour = usage.get("five_hour", {})
        if five_hour and five_hour.get("utilization") is not None:
            pct = float(five_hour["utilization"])
            bar = _colored_bar(pct)
            remaining = _format_remaining(five_hour.get("resets_at", ""))
            seg = f"Session {bar} {pct:.0f}%"
            if remaining:
                seg += f" {remaining}"
            segments.append(seg)

        seven_day = usage.get("seven_day", {})
        if seven_day and seven_day.get("utilization") is not None:
            pct = float(seven_day["utilization"])
            bar = _colored_bar(pct)
            segments.append(f"Weekly {bar} {pct:.0f}%")

        return segments
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Existing session-data helpers (from stdin)
# ---------------------------------------------------------------------------

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
        bar = _colored_bar(pct, low_thresh=50, mid_thresh=70, high_thresh=85)
        bar_str = f"Context {bar} {pct:.0f}%"
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


def pr_info():
    """Return PR label if current branch has an open PR, else empty string."""
    try:
        import subprocess
        result = subprocess.run(
            ["gh", "pr", "view", "--json", "number,state,isDraft"],
            capture_output=True, text=True, timeout=3,
        )
        if result.returncode != 0:
            return ""
        pr = json.loads(result.stdout)
        state = pr.get("state")
        if state == "MERGED":
            return f"{MAGENTA}#{pr['number']}{RESET}"
        if state != "OPEN":
            return ""
        if pr.get("isDraft"):
            return f"{DIM}#{pr['number']}{RESET}"
        return f"{YELLOW}#{pr['number']}{RESET}"
    except Exception:
        return ""


def branch_name(data):
    try:
        wt = data.get("worktree", {})
        name = wt.get("branch") or wt.get("name") or ""
        if name:
            return name
    except Exception:
        pass
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode == 0:
            name = result.stdout.strip()
            if name and name != "HEAD":
                if os.path.isfile(".git"):
                    return f"{CYAN}⎇ {name}{RESET}"
                return name
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    try:
        raw = json.load(sys.stdin)
        data = raw.get("data", raw)
        usage = _usage_segments()
        line1 = [s for s in [
            model_name(data),
            branch_name(data),
            pr_info(),
        ] if s]
        line2 = [s for s in [
            *usage,
            context_bar(data),
        ] if s]
        lines = []
        if line1:
            lines.append(SEP.join(line1))
        if line2:
            lines.append(SEP.join(line2))
        print("\n".join(lines) if lines else "\u2013")
    except Exception:
        print("\u2013")


main()
