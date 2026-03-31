---
description: Merge or rebase that resolves conflicts for you
user-invocable: true
disable-model-invocation: true
argument-hint: '[branch]'
allowed-tools: Read, Agent, SendMessage
---

# Deconflict

## Announce

> Daemon `git:deconflict` online. Reading the situation.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/workers/`. The agent handles the full merge/rebase
workflow in its own context window.

When spawning the agent:

1. **Read** `${CLAUDE_SKILL_DIR}/workers/worker.md`
1. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
1. **Extract** the markdown body (below closing `---`) as the agent's system prompt
1. **Spawn** with `subagent_type: "general-purpose"` and the prompt below

## Steps

### Step 1 — Spawn the agent

Read `${CLAUDE_SKILL_DIR}/workers/worker.md`, parse YAML frontmatter, extract the markdown body, then:

Call the Agent tool with:

- name: \<from frontmatter>

- description: \<from frontmatter>

- subagent_type: "general-purpose"

- model: \<from frontmatter>

- prompt: | CLAUDE_SKILL_DIR: ${CLAUDE_SKILL_DIR} CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT} ARGUMENTS: $ARGUMENTS

  \<agent body from the .md file>

Print the announce line, then spawn the agent.

### Step 2 — Relay user input

After the agent returns its first response, show it to the user. Save the `agentId` from the Agent tool result — you
need it for resumption.

If the response contains `<!-- DECONFLICT_DONE -->`, stop — the agent has finished (clean merge, abort, or all conflicts
resolved).

Otherwise, loop:

1. Wait for user input
1. Send it to the agent via `SendMessage(to: agentId)` — use the agent ID, not the name
1. The agent resumes in the background — wait for the task notification
1. Show the agent's response from the notification
1. If the response contains `<!-- DECONFLICT_DONE -->`, stop
1. Otherwise, repeat from 1

Do not add your own commentary between the agent's output and the user. Relay verbatim.
