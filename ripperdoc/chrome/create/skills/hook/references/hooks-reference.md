# Hooks Reference

Quick-reference for all hook events, matchers, input schemas, output formats, and decision control.

## Table of Contents
1. [Hook Events Summary](#hook-events-summary)
2. [Hook Types](#hook-types)
3. [Configuration Structure](#configuration-structure)
4. [Matcher Reference](#matcher-reference)
5. [Common Input Fields](#common-input-fields)
6. [Event Input Schemas](#event-input-schemas)
7. [Output & Decision Control](#output--decision-control)
8. [Exit Codes](#exit-codes)
9. [Environment Variables](#environment-variables)
10. [Tool Input Schemas](#tool-input-schemas)
11. [Hook Type Support by Event](#hook-type-support-by-event)
12. [Settings File Locations](#settings-file-locations)
13. [Security Best Practices](#security-best-practices)

---

## Hook Events Summary

| Event                | When it fires                                           | Can block? | Matcher field            |
|:---------------------|:--------------------------------------------------------|:-----------|:-------------------------|
| `SessionStart`       | Session begins or resumes                               | No         | source                   |
| `InstructionsLoaded` | CLAUDE.md or rules file loaded                          | No         | (none)                   |
| `UserPromptSubmit`   | User submits a prompt                                   | Yes        | (none)                   |
| `PreToolUse`         | Before a tool call executes                             | Yes        | tool name                |
| `PermissionRequest`  | Permission dialog appears                               | Yes        | tool name                |
| `PostToolUse`        | After a tool call succeeds                              | No*        | tool name                |
| `PostToolUseFailure` | After a tool call fails                                 | No         | tool name                |
| `Notification`       | Claude sends a notification                             | No         | notification type        |
| `SubagentStart`      | Subagent spawned                                        | No         | agent type               |
| `SubagentStop`       | Subagent finishes                                       | Yes        | agent type               |
| `Stop`               | Claude finishes responding                              | Yes        | (none)                   |
| `TeammateIdle`       | Teammate about to go idle                               | Yes        | (none)                   |
| `TaskCompleted`      | Task marked completed                                   | Yes        | (none)                   |
| `ConfigChange`       | Config file changes                                     | Yes        | config source            |
| `WorktreeCreate`     | Worktree being created                                  | Yes        | (none)                   |
| `WorktreeRemove`     | Worktree being removed                                  | No         | (none)                   |
| `PreCompact`         | Before compaction                                       | No         | trigger (manual/auto)    |
| `SessionEnd`         | Session terminates                                      | No         | exit reason              |

*PostToolUse can provide feedback via `decision: "block"` but the tool already ran.

---

## Hook Types

### Command (`type: "command"`)
- Runs a shell command. Input via stdin (JSON), output via stdout/stderr + exit codes.
- Fields: `command` (required), `async` (optional), `timeout`, `statusMessage`

### HTTP (`type: "http"`)
- POSTs event JSON to a URL. Response body uses same JSON format as command hooks.
- Fields: `url` (required), `headers` (optional), `allowedEnvVars` (optional), `timeout`
- Header values support `$VAR_NAME` interpolation for vars listed in `allowedEnvVars`

### Prompt (`type: "prompt"`)
- Single-turn LLM evaluation. Returns `{ "ok": true/false, "reason": "..." }`.
- Fields: `prompt` (required), `model` (optional, defaults to fast model), `timeout` (default: 30s)
- Use `$ARGUMENTS` in prompt to inject hook input JSON

### Agent (`type: "agent"`)
- Multi-turn subagent with tool access (Read, Grep, Glob, etc.). Same response format as prompt.
- Fields: `prompt` (required), `model` (optional), `timeout` (default: 60s, up to 50 tool turns)
- Use `$ARGUMENTS` in prompt to inject hook input JSON

---

## Configuration Structure

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex pattern>",   // optional, filters when hook fires
        "hooks": [
          {
            "type": "command",          // or "http", "prompt", "agent"
            "command": "python3 .claude/hooks/my-hook.py",  // for command type
            "timeout": 600,             // seconds, optional
            "statusMessage": "Running checks...",  // optional spinner text
            "async": false              // command-only, optional
          }
        ]
      }
    ]
  }
}
```

---

## Matcher Reference

| Event(s)                                                       | Matches on          | Example values                                                    |
|:---------------------------------------------------------------|:--------------------|:------------------------------------------------------------------|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest` | tool name    | `Bash`, `Edit\|Write`, `mcp__.*`, `mcp__github__.*`              |
| `SessionStart`                                                 | session source      | `startup`, `resume`, `clear`, `compact`                           |
| `SessionEnd`                                                   | exit reason         | `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` |
| `Notification`                                                 | notification type   | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` |
| `SubagentStart`, `SubagentStop`                                | agent type          | `Bash`, `Explore`, `Plan`, or custom agent names                  |
| `PreCompact`                                                   | trigger type        | `manual`, `auto`                                                  |
| `ConfigChange`                                                 | config source       | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `InstructionsLoaded` | (no matcher) | always fires |

Matchers are regex. `""`, `"*"`, or omitting matcher = match all.

### MCP Tool Names
Pattern: `mcp__<server>__<tool>`. Examples:
- `mcp__memory__create_entities`
- `mcp__github__search_repositories`
- `mcp__.*__write.*` (any write tool from any server)

---

## Common Input Fields

All events receive these on stdin (command) or POST body (HTTP):

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",  // default|plan|acceptEdits|dontAsk|bypassPermissions
  "hook_event_name": "PreToolUse"
}
```

When in subagent context, also includes `agent_id` and `agent_type`.

---

## Event Input Schemas

### SessionStart
Additional: `source` (startup|resume|clear|compact), `model`, optionally `agent_type`
Also has `CLAUDE_ENV_FILE` env var for persisting env vars.

### InstructionsLoaded
Additional: `file_path`, `memory_type` (User|Project|Local|Managed), `load_reason` (session_start|nested_traversal|path_glob_match|include), optionally `globs`, `trigger_file_path`, `parent_file_path`

### UserPromptSubmit
Additional: `prompt`

### PreToolUse
Additional: `tool_name`, `tool_input` (varies by tool), `tool_use_id`

### PermissionRequest
Additional: `tool_name`, `tool_input`, optionally `permission_suggestions`

### PostToolUse
Additional: `tool_name`, `tool_input`, `tool_response`, `tool_use_id`

### PostToolUseFailure
Additional: `tool_name`, `tool_input`, `tool_use_id`, `error`, optionally `is_interrupt`

### Notification
Additional: `message`, `notification_type`, optionally `title`

### SubagentStart
Additional: `agent_id`, `agent_type`

### SubagentStop
Additional: `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`

### Stop
Additional: `stop_hook_active`, `last_assistant_message`

### TeammateIdle
Additional: `teammate_name`, `team_name`

### TaskCompleted
Additional: `task_id`, `task_subject`, optionally `task_description`, `teammate_name`, `team_name`

### ConfigChange
Additional: `source`, optionally `file_path`

### WorktreeCreate
Additional: `name`

### WorktreeRemove
Additional: `worktree_path`

### PreCompact
Additional: `trigger` (manual|auto), `custom_instructions`

### SessionEnd
Additional: `reason` (clear|logout|prompt_input_exit|bypass_permissions_disabled|other)

---

## Output & Decision Control

### Universal JSON fields (all events)
```json
{
  "continue": true,           // false = stop Claude entirely
  "stopReason": "...",        // shown to user when continue=false
  "suppressOutput": false,    // hide stdout from verbose mode
  "systemMessage": "..."      // warning shown to user
}
```

### Event-specific decision patterns

**Top-level `decision` (UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, SubagentStop, ConfigChange):**
```json
{ "decision": "block", "reason": "explanation" }
```

**PreToolUse — `hookSpecificOutput`:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "permissionDecisionReason": "explanation",
    "updatedInput": { "field": "new value" },
    "additionalContext": "extra context for Claude"
  }
}
```

**PermissionRequest — `hookSpecificOutput`:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow|deny",
      "updatedInput": { ... },
      "updatedPermissions": [ ... ],
      "message": "deny reason",
      "interrupt": false
    }
  }
}
```

**SessionStart / UserPromptSubmit — context injection:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "context text"
  }
}
```
Or just print plain text to stdout (exit 0).

**WorktreeCreate:**
Print absolute path to created worktree on stdout. Non-zero exit = fail.

**TeammateIdle / TaskCompleted:**
Exit 2 + stderr = continue working. JSON `{"continue": false}` = stop entirely.

---

## Exit Codes

| Code | Meaning | Behavior |
|:-----|:--------|:---------|
| 0    | Success | Action proceeds. Stdout parsed for JSON |
| 2    | Block   | Action blocked. Stderr fed to Claude as feedback |
| Other | Error  | Non-blocking. Stderr shown in verbose mode only |

### Exit 2 per event
- **Blocks**: PreToolUse, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate
- **Cannot block (shows stderr only)**: PostToolUse, PostToolUseFailure, Notification, SubagentStart, SessionStart, SessionEnd, PreCompact, WorktreeRemove
- **Ignored**: InstructionsLoaded

---

## Environment Variables

Available in hook commands:
- `$CLAUDE_PROJECT_DIR` — project root
- `${CLAUDE_PLUGIN_ROOT}` — plugin root (for plugin hooks)
- `$CLAUDE_CODE_REMOTE` — `"true"` in remote web environments
- `$CLAUDE_ENV_FILE` — SessionStart only, path to write `export` statements for persisting env vars

---

## Tool Input Schemas (for PreToolUse/PostToolUse)

### Bash
`command`, `description`, `timeout`, `run_in_background`

### Write
`file_path`, `content`

### Edit
`file_path`, `old_string`, `new_string`, `replace_all`

### Read
`file_path`, `offset`, `limit`

### Glob
`pattern`, `path`

### Grep
`pattern`, `path`, `glob`, `output_mode`, `-i`, `multiline`

### WebFetch
`url`, `prompt`

### WebSearch
`query`, `allowed_domains`, `blocked_domains`

### Agent
`prompt`, `description`, `subagent_type`, `model`

---

## Hook Type Support by Event

**All 4 types (command, http, prompt, agent):**
PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop, SubagentStop, TaskCompleted, UserPromptSubmit

**Command only:**
SessionStart, SessionEnd, Notification, SubagentStart, TeammateIdle, ConfigChange, InstructionsLoaded, PreCompact, WorktreeCreate, WorktreeRemove

---

## Settings File Locations

| Location | Scope | Shareable |
|:---------|:------|:----------|
| `~/.claude/settings.json` | All projects | No |
| `.claude/settings.json` | Single project | Yes (commit) |
| `.claude/settings.local.json` | Single project | No (gitignored) |
| Managed policy settings | Organization | Yes (admin) |
| Plugin `hooks/hooks.json` | When plugin enabled | Yes |
| Skill/agent frontmatter | While component active | Yes |

---

## Security Best Practices

- Validate and sanitize all input from stdin
- Check for path traversal (`..` in file paths)
- Use absolute paths or `os.environ['CLAUDE_PROJECT_DIR']` for scripts
- Skip sensitive files (.env, .git/, keys)
- Use `subprocess.run()` without `shell=True` to avoid command injection
- Make scripts executable: `chmod +x hook.py`
- Test hooks manually: `echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | python3 ./my-hook.py`

---

## Common Pitfalls

1. **Stop hook infinite loop**: Always check `stop_hook_active` and exit 0 if true
2. **Subprocess stdout leaks**: Child process output mixes with hook JSON. Use `subprocess.run()` with `capture_output=True`
3. **Hook not firing**: Matchers are case-sensitive. Check with `/hooks` menu
4. **Settings edits not taking effect**: Restart session or review via `/hooks` menu
5. **Async hooks can't block**: They run after the action proceeds
6. **Exit 2 + JSON = JSON ignored**: Choose one approach, not both
