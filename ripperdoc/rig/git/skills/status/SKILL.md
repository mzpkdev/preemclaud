---
description: "What you were doing, not which files changed"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Agent
model: claude-sonnet-4-6
---

# Status

## Announce

> `git:status` — Scanning your changes.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/agents/`.
The agent runs in its own context window — git diffs and gather output never appear here.

When spawning the agent:
1. **Read** `${CLAUDE_SKILL_DIR}/agents/worker.md`
2. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
3. **Extract** the markdown body (below closing `---`) as the agent's system prompt
4. **Spawn** with `subagent_type: "Explore"` and the prompt below

## Steps

### Step 1 — Spawn the agent

Read, parse, and spawn following the **Agent Frontmatter** section above.

Agent prompt:

```
Skill directory: ${CLAUDE_SKILL_DIR}
Arguments: $ARGUMENTS
```

Do not add output before or after. The agent handles everything.
