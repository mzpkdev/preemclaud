# Agents Reference

Quick-reference for all agent configuration options, frontmatter fields, tool access, model selection, and patterns.

## Table of Contents
1. [Frontmatter Fields](#frontmatter-fields)
2. [Available Tools](#available-tools)
3. [Model Options](#model-options)
4. [Permission Modes](#permission-modes)
5. [MCP Server Configuration](#mcp-server-configuration)
6. [Hooks in Agents](#hooks-in-agents)
7. [Persistent Memory](#persistent-memory)
8. [Agent Scopes and Locations](#agent-scopes-and-locations)
9. [CLI-Defined Agents](#cli-defined-agents)
10. [Agent Restrictions](#agent-restrictions)
11. [Naming Conventions](#naming-conventions)
12. [Example Configurations](#example-configurations)

---

## Frontmatter Fields

| Field             | Required | Type            | Description                                                                |
|:------------------|:---------|:----------------|:---------------------------------------------------------------------------|
| `name`            | Yes      | string          | Unique identifier, lowercase letters and hyphens only                      |
| `description`     | Yes      | string          | When Claude should delegate to this agent — the primary trigger mechanism  |
| `tools`           | No       | comma-separated | Tools the agent can use. Inherits all if omitted                           |
| `disallowedTools` | No       | comma-separated | Tools to deny, removed from inherited or specified list                    |
| `model`           | No       | string          | `sonnet`, `opus`, `haiku`, full model ID, or `inherit` (default)           |
| `permissionMode`  | No       | string          | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`           |
| `maxTurns`        | No       | integer         | Maximum agentic turns before the agent stops                               |
| `skills`          | No       | list            | Skills to preload into the agent's context at startup                      |
| `mcpServers`      | No       | list            | MCP servers available to this agent (names or inline definitions)          |
| `hooks`           | No       | object          | Lifecycle hooks scoped to this agent                                       |
| `memory`          | No       | string          | Persistent memory scope: `user`, `project`, or `local`                     |
| `background`      | No       | boolean         | Always run as background task. Default: `false`                            |
| `isolation`       | No       | string          | Set to `worktree` for isolated git worktree                                |

---

## Available Tools

Agents can use any of Claude Code's internal tools. Common tools:

| Tool        | Purpose                                    |
|:------------|:-------------------------------------------|
| `Read`      | Read file contents                         |
| `Edit`      | Modify existing files                      |
| `Write`     | Create or overwrite files                  |
| `Bash`      | Execute shell commands                     |
| `Grep`      | Search file contents with regex            |
| `Glob`      | Find files by pattern                      |
| `WebFetch`  | Fetch and process web content              |
| `WebSearch` | Search the web                             |
| `Agent`     | Spawn sub-agents (main thread only)        |

### Tool restriction patterns

**Allowlist** — only these tools:
```yaml
tools: Read, Grep, Glob
```

**Denylist** — everything except these:
```yaml
disallowedTools: Write, Edit
```

**Restrict agent spawning** (main thread `--agent` only):
```yaml
tools: Agent(worker, researcher), Read, Bash
```

Bare `Agent` (no parentheses) allows spawning any agent type. Omitting `Agent` entirely prevents spawning any agents.

### Common tool sets

| Use case           | Tools                                   |
|:-------------------|:----------------------------------------|
| Read-only analysis | `Read, Grep, Glob, Bash`               |
| Code modification  | `Read, Edit, Write, Bash, Grep, Glob`  |
| Research only      | `Read, Grep, Glob, WebFetch, WebSearch` |
| Full access        | *(omit tools field)*                    |

---

## Model Options

| Value            | Behavior                                     |
|:-----------------|:---------------------------------------------|
| `haiku`          | Fast, low-cost — simple tasks, exploration   |
| `sonnet`         | Balanced — most agents                       |
| `opus`           | Most capable — complex reasoning             |
| `inherit`        | Same model as main conversation (default)    |
| Full model ID    | e.g., `claude-opus-4-6`, `claude-sonnet-4-6` |

---

## Permission Modes

| Mode                | Behavior                                                          |
|:--------------------|:------------------------------------------------------------------|
| `default`           | Standard permission checking with prompts                         |
| `acceptEdits`       | Auto-accept file edits (Edit, Write)                              |
| `dontAsk`           | Auto-deny permission prompts (explicitly allowed tools still work)|
| `bypassPermissions` | Skip all permission checks — use with caution                     |
| `plan`              | Plan mode — read-only exploration                                 |

If parent uses `bypassPermissions`, it takes precedence and cannot be overridden.

---

## MCP Server Configuration

MCP servers give agents access to external services. Two forms:

### Reference by name (already configured in session)
```yaml
mcpServers:
  - github
  - slack
```

### Inline definition (scoped to this agent only)
```yaml
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
```

Inline servers connect when the agent starts and disconnect when it finishes. They don't appear in the main conversation's tool list, which keeps context clean.

Supports `stdio`, `http`, `sse`, `ws` transport types — same schema as `.mcp.json` server entries.

---

## Hooks in Agents

Agents can define hooks in their frontmatter that run only while the agent is active.

### Supported events in agent frontmatter

| Event         | Matcher input | When it fires                              |
|:--------------|:--------------|:-------------------------------------------|
| `PreToolUse`  | Tool name     | Before the agent uses a tool               |
| `PostToolUse` | Tool name     | After the agent uses a tool                |
| `Stop`        | (none)        | When the agent finishes (→ SubagentStop)   |

All standard hook events are supported. `Stop` hooks in frontmatter are automatically converted to `SubagentStop` at runtime.

### Example: validate bash commands
```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
```

### Project-level hooks for agent lifecycle

In `settings.json`, use `SubagentStart` / `SubagentStop` to hook into agent lifecycle events:

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "my-agent",
        "hooks": [{ "type": "command", "command": "./scripts/setup.sh" }]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [{ "type": "command", "command": "./scripts/cleanup.sh" }]
      }
    ]
  }
}
```

---

## Persistent Memory

The `memory` field gives agents a persistent directory that survives across conversations.

| Scope     | Location                                      | Use when                                      |
|:----------|:----------------------------------------------|:----------------------------------------------|
| `user`    | `~/.claude/agent-memory/<name>/`              | Learnings should apply across all projects    |
| `project` | `.claude/agent-memory/<name>/`                | Knowledge is project-specific and shareable   |
| `local`   | `.claude/agent-memory-local/<name>/`          | Project-specific but not checked in           |

When memory is enabled:
- The agent's system prompt includes instructions for reading and writing to the memory directory
- The first 200 lines of `MEMORY.md` in the memory directory are loaded automatically
- Read, Write, Edit tools are auto-enabled so the agent can manage its memory files

### Memory instructions for the system prompt

Include something like this in agents that should learn:
```markdown
Update your agent memory as you discover codepaths, patterns, library
locations, and key architectural decisions. This builds up institutional
knowledge across conversations. Write concise notes about what you found
and where.
```

**Tip**: `user` scope is the recommended default. Use `project` or `local` when the agent's knowledge only matters for a specific codebase.

---

## Agent Scopes and Locations

| Location                     | Scope                   | Priority    |
|:-----------------------------|:------------------------|:------------|
| `--agents` CLI flag          | Current session only    | 1 (highest) |
| `.claude/agents/`            | Current project         | 2           |
| `~/.claude/agents/`          | All your projects       | 3           |
| Plugin's `agents/` directory | Where plugin is enabled | 4 (lowest)  |

When multiple agents share the same name, the higher-priority location wins.

---

## CLI-Defined Agents

Pass agents as JSON when launching Claude Code. These exist only for the current session — useful for quick testing or automation:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer. Focus on code quality, security, and best practices.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger. Analyze errors, identify root causes, and provide fixes."
  }
}'
```

Accepts all frontmatter fields: `description`, `prompt`, `tools`, `disallowedTools`, `model`, `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `memory`.

Use `prompt` for the system prompt (equivalent to the markdown body in file-based agents).

---

## Agent Restrictions

- Subagents **cannot spawn other subagents** — only the main thread can use the Agent tool
- `Agent(name)` tool restrictions only apply to agents running as the main thread via `--agent` mode
- Background agents auto-deny any permissions not pre-approved at launch
- If a background agent fails due to missing permissions, you can resume it in the foreground

### Disabling specific agents

In settings:
```json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

Or via CLI flag:
```bash
claude --disallowedTools "Agent(Explore)"
```

---

## Naming Conventions

- Lowercase letters and hyphens only
- 2-4 words typical: `code-reviewer`, `db-reader`, `test-runner`
- Descriptive and memorable
- Must be unique within its scope

---

## Example Configurations

### Read-only code reviewer
```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### Debugger with edit access
```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```

### Learning agent with persistent memory
```markdown
---
name: project-expert
description: Codebase specialist that learns project patterns, conventions, and architecture over time. Consult when you need deep project context.
tools: Read, Grep, Glob
memory: project
---

You are a project knowledge specialist. Your role is to build and maintain deep understanding of this codebase.

When invoked:
1. Read your agent memory for prior learnings
2. Research the question using your tools
3. Answer with specific file paths and code references
4. Update your memory with any new discoveries

Update your agent memory as you discover codepaths, patterns, library locations, and key architectural decisions. Write concise notes about what you found and where.
```

### Agent with scoped MCP server
```markdown
---
name: browser-tester
description: Tests features in a real browser using Playwright. Use for end-to-end testing, visual verification, and browser automation.
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
---

Use the Playwright tools to navigate, screenshot, and interact with web pages.

When invoked:
1. Navigate to the relevant page
2. Interact with the feature being tested
3. Take screenshots to verify visual output
4. Report pass/fail with evidence
```

### Read-only DB agent with validation hook
```markdown
---
name: db-reader
description: Execute read-only database queries. Use when analyzing data or generating reports.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access. Execute SELECT queries to answer questions about the data.

When asked to analyze data:
1. Identify which tables contain the relevant data
2. Write efficient SELECT queries with appropriate filters
3. Present results clearly with context

You cannot modify data. If asked to INSERT, UPDATE, DELETE, or modify schema, explain that you have read-only access.
```
