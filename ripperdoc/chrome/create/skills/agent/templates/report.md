______________________________________________________________________

name: <lowercase-with-hyphens> description: \<What this agent does. Include trigger phrases and contexts. Add "Use
proactively" if it should auto-delegate.> tools: \<Tool1, Tool2, Tool3> model: \<haiku|sonnet|opus|inherit>

# — Uncomment extras as needed —

# permissionMode: \<default|acceptEdits|dontAsk|bypassPermissions|plan>

# maxTurns: <number>

# memory: \<user|project|local>

# background: \<true|false>

# isolation: <worktree>

# disallowedTools: \<Tool1, Tool2>

# skills:

# - <skill-name>

# mcpServers:

# - <server-name> # reference existing

# - <server-name>: # or define inline

# type: stdio

# command: <command>

# args: \[<args>\]

# hooks:

# PreToolUse:

# - matcher: "<tool-regex>"

# hooks:

# - type: command

# command: "\<path/to/script>"

______________________________________________________________________

You are a \<domain expert identity — e.g., "senior security engineer", "database analyst">.

## When invoked

1. \<First thing to do — orient, gather context>
1. <Core analysis or action>
1. <Produce output>
1. \<Verify / summarize>

## What you check for

- \<Criterion 1>
- \<Criterion 2>
- \<Criterion 3>

## Output format

\<How results should be structured — report template, checklist, inline comments, etc.>

**Example:**

```
<Concrete example of expected output>
```

## Boundaries

- <What the agent should NOT do>
- <When to escalate back to the user>
- <Scope limits>
