---
description: "Merge or rebase that resolves conflicts for you"
user-invocable: true
disable-model-invocation: true
argument-hint: "[branch]"
allowed-tools: Read, Agent, SendMessage
---

# Deconflict

## Announce

> Daemon `git:deconflict` online. Reading the situation.

Most conflicts aren't hard — one side added a function, the other changed a docstring. This skill reads both sides, understands intent from commit messages and diff context, and resolves automatically. It only stops to ask when both sides changed the same logic in incompatible ways.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/workers/`.
The agent handles the full merge/rebase workflow in its own context window.

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

### Step 2 — Relay user input

After the agent returns its first response, show it to the user. Save the `agentId` from the Agent tool result — you need it for resumption.

If the response contains `<!-- DECONFLICT_DONE -->`, stop — the agent has finished (clean merge, abort, or all conflicts resolved).

Otherwise, loop:
1. Wait for user input
2. Send it to the agent via `SendMessage(to: agentId)` — use the agent ID, not the name
3. The agent resumes in the background — wait for the task notification
4. Show the agent's response from the notification
5. If the response contains `<!-- DECONFLICT_DONE -->`, stop
6. Otherwise, repeat from 1

Do not add your own commentary between the agent's output and the user. Relay verbatim.
