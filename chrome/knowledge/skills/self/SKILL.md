---
name: knowledge:self
description: "Use when the user asks ABOUT Claude Code rather than asking Claude Code to DO something. Two modes: (1) General knowledge — how features work: hooks, MCP servers, slash commands, tools, keybindings, settings, IDE integrations, Agent SDK, Jupyter support, experimental flags, agent teams, any Claude Code concept. (2) Instance introspection — what's configured HERE: settings.json contents, installed skills, connected MCPs, active hooks, enabled plugins, memory, current model, effort level. Also covers identity questions ('tell me about yourself', 'what are you', 'what can you do'). Key distinction: 'how do hooks work?' → this skill. 'Create a hook for X' → create:hook. Always use this skill instead of answering from memory — Claude Code docs go stale fast."
user-invocable: true
disable-model-invocation: false
---

# Self-Knowledge

## Announce

> Daemon `knowledge:self` online. Checking the mirror.

## Why this skill exists

Claude's training data about Claude Code gets stale. When users ask "how do hooks work?" or "can you do X?", the model often answers from memory and gets it wrong. This skill exists to prevent that — route the question to a source of truth instead of guessing.

## Steps

Every question about Claude Code falls into one of two buckets. Figure out which one, then follow the corresponding playbook.

### Bucket 1: General Claude Code knowledge

Questions about how Claude Code works in general — features, settings, tools, hooks, slash commands, keybindings, IDE integrations, the Agent SDK, or the Claude API.

**Examples:** "How do hooks work?", "Can Claude Code edit Jupyter notebooks?", "How do I set up an MCP server?", "What's the Agent SDK?", "How do I use tool_use with the API?"

**Action:** Spawn the `claude-code-guide` subagent. It has WebSearch, WebFetch, Glob, Grep, and Read — it can look things up properly instead of guessing.

```
Use the Agent tool with subagent_type="claude-code-guide" and a clear prompt
that captures the user's question. Be specific about what they're asking.
```

Do NOT answer general Claude Code questions from your own knowledge. The whole point is to avoid hallucination. Let the subagent research it.

**Search tip:** Claude Code evolves fast. When researching, include the current year in search queries and prefer `site:code.claude.com` for official docs. A query like "claude code hooks" without a year can pull up outdated blog posts with wrong information.

### Bucket 2: Instance introspection

Questions about what's installed, configured, or active in THIS specific Claude Code instance.

**Examples:** "What skills do I have?", "What MCP servers are connected?", "Show me my hooks", "What's in my memory?", "What plugins are enabled?"

**Action:** Read the relevant config files directly. Here's where to look:

#### Installed skills
Read the chrome plugin structure to enumerate installed skills:
```
# Plugin registry
~/.claude/chrome/.claude-plugin/marketplace.json

# Each plugin has a skills/ directory with SKILL.md files
~/.claude/chrome/*/skills/*/SKILL.md
```
Read the SKILL.md frontmatter (name + description) for each skill. Present them grouped by plugin (create, write, setup, knowledge, code, etc.).

#### MCP Servers
MCP server configuration lives in:
```
~/.claude/settings.json          # global MCP config
.claude/settings.json            # project-level MCP config (in project root)
```
Look for the `mcpServers` key. List each server's name, command, and status.

#### Hooks
Hooks can be in multiple places:
```
~/.claude/settings.json                    # global hooks
.claude/settings.json                      # project-level hooks
~/.claude/chrome/*/hooks/hooks.json        # plugin hooks
```
Look for the `hooks` key. List each hook's event trigger, type, and command.

#### Memory
```
~/.claude/projects/*/memory/MEMORY.md      # memory index
~/.claude/projects/*/memory/*.md           # individual memories
```
Read MEMORY.md for the index, then summarize what's stored.

#### Settings & Configuration
```
~/.claude/settings.json                    # global settings
.claude/settings.json                      # project settings
CLAUDE.md                                  # project instructions (in project root)
~/.claude/CLAUDE.md                        # global instructions
```
Summarize the active configuration — model, effort level, enabled plugins, etc.

#### Enabled plugins
Check `enabledPlugins` in `~/.claude/settings.json`. Cross-reference with the marketplace registry to show which plugins are active.

## Rules

- **Never guess about Claude Code features.** If it's a general knowledge question, spawn the subagent. That's non-negotiable.
- **For introspection, read the actual files.** Don't assume what's installed — check.
- **Be specific in answers.** If the user asks "what can you do?", don't give a vague hand-wave. List actual capabilities based on what's configured.
- **If both buckets apply**, handle them both. "What MCP servers do I have and how do I add a new one?" is introspection (list current servers) + general knowledge (how to configure MCP). Do both.
- **Broad capability questions are always both buckets.** "What can you do?", "give me a rundown of your capabilities", "tell me about yourself" — these need introspection (list what's installed and configured) AND research (what can Claude Code do in general). Don't just list installed skills and call it a day. The user wants the full picture.
