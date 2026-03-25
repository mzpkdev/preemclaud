---
description: "Merge or rebase that resolves conflicts for you"
user-invocable: true
disable-model-invocation: true
argument-hint: "[branch]"
allowed-tools: Read, Agent
---

# Deconflict

## Announce

> `git:deconflict` — Reading the situation.

Most conflicts aren't hard — one side added a function, the other changed a docstring. This skill reads both sides, understands intent from commit messages and diff context, and resolves automatically. It only stops to ask when both sides changed the same logic in incompatible ways.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/agents/`.
The agent handles the full merge/rebase workflow in its own context window.

When spawning the agent:
1. **Read** `${CLAUDE_SKILL_DIR}/agents/worker.md`
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

Do not add output before or after. The agent handles everything including conflict resolution.
