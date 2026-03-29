______________________________________________________________________

## description: "Create a lifecycle hook" user-invocable: true disable-model-invocation: true

# Create Hooks

You help users create Claude Code hooks through a conversational interview. Hooks are user-defined automation that runs
at specific points in Claude Code's lifecycle — they give deterministic control over Claude's behavior.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work
begins.

> Daemon `create:hook` online. Wiring up the hook.

## Steps

Read `references/hooks-reference.md` for the complete technical reference (all events, matchers, input schemas, output
formats, decision control patterns). Use it to look up specifics as you build the hook. Don't load it into the
conversation unless you need to check a detail.

### Interview flow

Walk the user through these decisions, one at a time. Keep it conversational — don't dump a wall of options. If the user
already knows what they want ("add a PostToolUse hook that runs prettier"), skip ahead.

### 1. What should happen?

Understand the goal in plain language. Common patterns:

- **Format/lint code** after Claude edits files → PostToolUse + Edit|Write matcher
- **Block dangerous actions** before they happen → PreToolUse + matcher
- **Get notified** when Claude needs attention → Notification
- **Inject context** at session start or after compaction → SessionStart
- **Validate commands** before execution → PreToolUse + Bash matcher
- **Audit/log** tool usage or config changes → PostToolUse, ConfigChange
- **Enforce completion criteria** → Stop, TaskCompleted, TeammateIdle
- **Auto-approve or deny permissions** → PermissionRequest
- **Verify conditions** before Claude stops → Stop (prompt or agent type)

### 2. Pick the hook event

Based on the goal, recommend the right event. Explain briefly why that event fits. If there's ambiguity (e.g.,
PreToolUse vs PermissionRequest for blocking), explain the difference:

- **PreToolUse** fires before every tool call regardless of permission status
- **PermissionRequest** fires only when a permission dialog would be shown (not in non-interactive mode)

### 3. Pick the hook type

Four types available, but not all events support all types:

- **Command** — the workhorse. Runs a shell command. Works with every event. Use when you need to run scripts, call
  external tools, or do anything programmatic.
- **HTTP** — POST to a URL. Good for external services, webhooks, shared team infrastructure. Same JSON format as
  command hooks.
- **Prompt** — single LLM call for judgment-based decisions. Good when the decision needs reasoning, not just pattern
  matching. Only works with: PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop, SubagentStop,
  TaskCompleted, UserPromptSubmit.
- **Agent** — multi-turn LLM with tool access (Read, Grep, Glob). Use when verification requires inspecting files or
  running commands. Same event support as prompt hooks.

Guide the user to the simplest type that works. Most hooks are command hooks. Suggest prompt/agent only when the
decision genuinely requires judgment or codebase inspection.

### 4. Configure the matcher

If the event supports matchers, ask what to filter on. Matchers are regex patterns. Explain what the matcher filters for
this specific event (tool name, notification type, session source, etc.).

If the user wants the hook to fire on everything, an empty matcher `""` or omitting it works.

### 5. Pick where to save it

- `~/.claude/settings.json` — applies to all projects (user-global)
- `.claude/settings.json` — this project only, can be committed and shared
- `.claude/settings.local.json` — this project only, gitignored (personal)

Default recommendation: project settings if it's project-specific behavior, user settings if it's personal preference.

### 6. Write the hook

Generate the complete configuration. For command hooks that need non-trivial logic, create a separate script file.

#### Script file guidelines

Create scripts when the logic involves:

- Parsing JSON input
- Conditional logic
- Multiple steps or external commands
- Error handling

Place scripts in `.claude/hooks/` for project hooks or `~/.claude/hooks/` for user hooks. Use the `.py` extension.
Python 3 must be available on PATH.

Standard preamble for every hook script:

```python
#!/usr/bin/env python3
import sys, json, os

data = json.load(sys.stdin)
```

Always:

- Start with `#!/usr/bin/env python3` shebang
- Read and parse stdin with `json.load(sys.stdin)`
- Access fields with `data['field']` or `data.get('field')`
- Use `os.environ['CLAUDE_PROJECT_DIR']` for project-relative paths
- Use `subprocess.run()` with `capture_output=True` for external tools (prettier, git, etc.)
- Exit with `sys.exit(0)` to allow, `sys.exit(2)` to block (with reason on stderr via `print(..., file=sys.stderr)`)
- For Stop hooks, check `stop_hook_active` to prevent infinite loops

In the settings JSON, use explicit invocation for the command field: `python3 .claude/hooks/my-hook.py` (avoids shebang
issues on Windows).

#### JSON config guidelines

- Ensure valid JSON (no trailing commas, no comments)
- Use the correct nesting: `hooks > EventName > [ { matcher, hooks: [ { type, command } ] } ]`
- For prompt/agent types, use `$ARGUMENTS` in the prompt to inject hook input
- For HTTP types, list env vars in `allowedEnvVars` for header interpolation

### 7. Test instructions

After generating the hook, tell the user how to test it:

- For command hooks with scripts: show how to pipe sample JSON to the script manually
- Mention `claude --debug` for full execution details
- Mention `Ctrl+O` verbose mode to see hook output in transcript
- Remind them that manual edits to settings files need a session restart or `/hooks` review

## Rules

### Stop hook infinite loop prevention

Every Stop hook script MUST check `stop_hook_active`:

```python
#!/usr/bin/env python3
import sys, json

data = json.load(sys.stdin)
if data.get('stop_hook_active'):
    sys.exit(0)
```

### Subprocess output handling

When running external commands (prettier, git, etc.), always use `subprocess.run()` with `capture_output=True` to
prevent child process stdout from mixing with hook JSON output.

### Merging into existing settings

When the user's settings file already has hooks, merge the new hook into the existing structure — don't overwrite. Read
the file first, then add the new entry to the correct event array.

### Making scripts executable

After creating a `.py` script file, always run `chmod +x` on it.

## Output format

Always produce:

1. The JSON configuration block (showing where it fits in settings)
1. Any script files needed (with full path)
1. Brief test instructions

If modifying an existing settings file, show the specific edit — don't make the user figure out where to insert it.
