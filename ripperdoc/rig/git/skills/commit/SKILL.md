---
description: "Auto-group changes into logical commits"
user-invocable: true
disable-model-invocation: true
argument-hint: "[optional message — omit for auto-grouping]"
allowed-tools: Read, Agent
---

# Commit

## Announce

> Daemon `git:commit` online. Reading changes on `!`git branch --show-current``.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/workers/`.
The agent runs git operations in its own context window — diffs, planning, and execution never appear here.

When spawning the agent:
1. **Read** `${CLAUDE_SKILL_DIR}/workers/worker.md`
2. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
3. **Extract** the markdown body (below closing `---`) as the agent's system prompt
4. **Spawn** with `subagent_type: "general-purpose"` and the prompt below

## Steps

### Step 1 — Spawn the agent

Read, parse, and spawn following the **Agent Frontmatter** section above.

Agent prompt:

```
Skill directory: ${CLAUDE_SKILL_DIR}
Arguments: $ARGUMENTS
```

Do not add output before or after. The agent handles everything including user interaction.
