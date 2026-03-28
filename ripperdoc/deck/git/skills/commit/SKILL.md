---
description: "Auto-group changes into logical commits"
user-invocable: true
disable-model-invocation: true
argument-hint: "[optional message — omit for auto-grouping]"
allowed-tools: Read, Agent, SendMessage
---

# Commit

## Announce

> Daemon `git:commit` online. Grouping your changes.

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

Read `${CLAUDE_SKILL_DIR}/workers/worker.md`, parse YAML frontmatter, extract the markdown body, then print the announce line and call the Agent tool with:
- name: \<from frontmatter\>
- description: \<from frontmatter\>
- subagent_type: "general-purpose"
- model: \<from frontmatter\>
- prompt: |
    CLAUDE_SKILL_DIR: ${CLAUDE_SKILL_DIR}
    CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
    ARGUMENTS: $ARGUMENTS

    \<agent body from the .md file\>

### Step 2 — Relay user input

After the agent returns its first response, show it to the user. Save the `agentId` from the Agent tool result — you need it for resumption.

If the response contains `<!-- COMMIT_DONE -->`, stop — the agent has finished (precondition failure, clean tree, or commits executed).

Otherwise, loop:
1. Wait for user input
2. Send it to the agent via `SendMessage(to: agentId)` — use the agent ID, not the name
3. The agent resumes in the background — wait for the task notification
4. Show the agent's response from the notification
5. If the response contains `<!-- COMMIT_DONE -->`, stop
6. Otherwise, repeat from 1

Do not add your own commentary between the agent's output and the user. Relay verbatim.
