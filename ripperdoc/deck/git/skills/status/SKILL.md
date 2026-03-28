---
description: "What you were doing, not which files changed"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Agent
---

# Status

## Announce

> Daemon `git:status` online. Scanning your changes.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/workers/`.
The agent runs in its own context window — git diffs and gather output never appear here.

When spawning the agent:
1. **Read** `${CLAUDE_SKILL_DIR}/workers/worker.md`
2. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
3. **Extract** the markdown body (below closing `---`) as the agent's system prompt
4. **Spawn** with `subagent_type: "Explore"` and the prompt below

## Steps

### Step 1 — Spawn the agent

Read `${CLAUDE_SKILL_DIR}/workers/worker.md`, parse YAML frontmatter, extract the markdown body, then:

Call the Agent tool with:
- name: \<from frontmatter\>
- description: \<from frontmatter\>
- subagent_type: "Explore"
- model: \<from frontmatter\>
- prompt: |
    CLAUDE_SKILL_DIR: ${CLAUDE_SKILL_DIR}
    CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
    ARGUMENTS: $ARGUMENTS

    \<agent body from the .md file\>

Print the announce line, then spawn the agent. Do not add output after the agent returns — the agent's output is final.
