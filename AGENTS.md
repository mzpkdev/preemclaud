# Authoring Reference

How skills, agents, and hooks are written in this repository.

```
ripperdoc/
  chrome/                         # high-level skills — write, code, create, knowledge, meta
  rig/                            # external integrations — git, IDE
  optics/                         # language servers — typescript, python, scala, java
  cortex/                         # system internals — update daemon
  <marketplace>/
    <plugin>/
      .claude-plugin/
        plugin.json               # { name, description, version }
      skills/
        <skill>/
          SKILL.md                # skill definition — frontmatter + instructions
          TEMPLATE.md             # output format (optional, loaded or embedded)
          scripts/                # helper scripts called at load or runtime
          agents/                 # co-located agents spawned by the skill
            worker.md             # agent definition — frontmatter + system prompt
```

Skills are invoked as `<plugin>:<skill>` — e.g. `git:commit`, `code:review`, `write:plan`.

Two variables are available inside `SKILL.md`:

| Variable | Resolves to |
|---|---|
| `${CLAUDE_SKILL_DIR}` | Absolute path to the skill's directory |
| `$ARGUMENTS` | What the user typed after the slash command |

---

# Patterns

## Trigger Description

Auto-triggerable skills (`disable-model-invocation: false`) append trigger rules after `//`:

```yaml
description: "Summary  //  Trigger when X. Do NOT trigger for Y."
```

The left side is for humans (slash command menu).  
The right side is Claude's dispatch logic — list concrete phrases to match and exclusions to prevent false positives.

## Announce

Every skill opens with an announce line — a blockquote printed on activation so the user knows which skill fired:

```markdown
> Daemon `code:write` online. Starting pipeline.
```

Format: `` > Daemon `plugin:skill` online. Action phrase. `` One line, states what the skill is about to do.

## Trampoline

A skill that exists only to spawn an agent. The main conversation sees the announce line and the agent's final output. Everything in between — gather scripts, diffs, JSON payloads, multi-turn planning — stays in the agent's isolated context.

Use when the skill processes heavy data or runs interactive multi-turn flows.
Don't use for lightweight lookups or reference injections.

Rules:
- `allowed-tools: Read, Agent` — that's all a trampoline needs
- No preloads — the agent gathers its own data at runtime
- No hooks — `PostToolUse` hooks on the trampoline won't fire inside the agent; build reporting into the agent's output instead
- Don't duplicate the agent's output after it returns

Existing trampolines: `git:status`, `git:commit`, `git:deconflict`.

## Co-located Agents

Agent `.md` files stored in `skills/<skill>/agents/`. Claude Code does not auto-discover these — the skill reads, parses, and spawns them manually using the Agent Frontmatter protocol:

1. **Read** `${CLAUDE_SKILL_DIR}/agents/worker.md`
2. **Parse** YAML frontmatter — extract `name`, `description`, `model`
3. **Extract** the markdown body as the system prompt
4. **Spawn** via Agent tool with the parsed fields and appropriate `subagent_type`

Pass `${CLAUDE_SKILL_DIR}` and `$ARGUMENTS` in the agent's prompt so it can find scripts and know what the user asked for.

Any `SKILL.md` that uses co-located agents must include an **Agent Frontmatter** section documenting these steps inline. It serves as both instruction to Claude and documentation for readers.

Subagent types — pick the most restrictive that works:

| `subagent_type` | Tools | Use when |
|---|---|---|
| `Explore` | Read, Grep, Glob, Bash (read-only) | Analysis, research, synthesis |
| `general-purpose` | All | File writes, git operations, task creation |

Multi-agent variant: `code:review` spawns several specialists in parallel from the same `agents/` directory and merges their findings. Same protocol, same frontmatter — see `ripperdoc/chrome/code/skills/review/SKILL.md`.

## Preload Command

`` !`command` `` executes a shell command at skill load time and inlines the stdout into the `SKILL.md` body. The output becomes available before the first step runs.

```markdown
## Preload

### Git state
!`python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py`
```

Preloads run regardless of `allowed-tools` restrictions. They are not Claude tool calls — they're executed by the plugin loader.

In a trampoline, don't preload. The agent gathers its own data at runtime to avoid injecting large payloads into the main context.

## Template

Prescribed output format for a skill. Stored in `TEMPLATE.md`, loaded in the skill body:

```markdown
## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure.
```

Always follow the load with an `[!IMPORTANT]` callout. Without it, Claude treats the format as a suggestion.

In a co-located agent, embed the template content directly in the agent body — agents don't have `${CLAUDE_SKILL_DIR}` resolved at load time. They receive it as runtime input and would need an extra tool call to read the file. Embedding avoids this.

## Skill-scoped Hooks

Hooks in `SKILL.md` frontmatter fire only during that skill's execution:

```yaml
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "git log -1 --format='%h %s' 2>/dev/null || true"
```

Supported events: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `Notification`.

`matcher` matches against tool names. `"Bash"` fires on any Bash call.

Caveat: skill-scoped hooks fire for tool calls in the main context only. They do not fire inside a spawned agent. If the agent needs post-action reporting, build it into the agent's own steps.

## Prompt Intercept

A slash command handled entirely by a `UserPromptSubmit` hook — Claude never receives the prompt, no API turn is consumed. The hook runs code as a side effect and returns `{"decision":"block","reason":"..."}`, where `reason` is what the user sees.

Use when the command is a pure side effect: clipboard copy, file write, toggle a setting, external API call.
Don't use when the command needs Claude to reason, generate output, or hold a conversation.

Three pieces:

1. **Stub command** (`commands/<name>.md`) — registers the slash command in `/help`. `disable-model-invocation: true` prevents programmatic invocation. The body is a fallback message shown only if the hook fails to intercept.
2. **Hook config** (`hooks/hooks.json`) — wires `UserPromptSubmit` to the shell script via `${CLAUDE_PLUGIN_ROOT}`.
3. **Hook script** — matches the command, does the work, outputs the block decision.

Rules:
- Always `case`-match your command first. Unmatched prompts must pass through with `echo '{}'` — never block commands that aren't yours.
- Strip the command prefix to parse arguments: `args="${prompt#/my-command}"; args="${args# }"`.
- `decision: "block"` is the only required output field. `reason` is the user-visible message.
- Write the stub body as a real error message — it surfaces if the hook environment breaks.

```bash
input="$(cat)"
prompt="$(echo "$input" | jq -r '.prompt // .user_prompt // ""')"

case "$prompt" in
  /my-command*) ;;
  *) echo '{}'; exit 0 ;;
esac

args="${prompt#/my-command}"
args="${args# }"

# do the work here

jq -n --arg reason "$message" '{"decision":"block","reason":$reason}'
```

---

# Structure

## Skill

```yaml
---
# --- Frontmatter ---
description: "Summary  //  trigger rules (omit // side if manual-only)"
user-invocable: true                      # appears as /plugin:skill slash command
disable-model-invocation: true            # true = manual only; false = Claude can auto-trigger
argument-hint: "[optional args]"          # shown in autocomplete
allowed-tools: Read, Grep, Glob          # restricts tool access during this skill
model: sonnet                             # sonnet | opus | haiku | full model ID
hooks:                                    # optional — skill-scoped lifecycle hooks
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "..."
---
```

```markdown
# Skill Name

## Announce

> `plugin:skill` — Short line shown on activation.

## Preload

!`python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py`

## Steps

### Step 1 — First thing

Instructions. Reference preloaded data, run tools, interact with user.

### Step 2 — Next thing

Continue.

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries.

## Safety

> [!IMPORTANT]
> Non-negotiable constraints. Forbidden operations, read-only rules, etc.

## Edge cases

- **Condition** → what to do
- **Other condition** → what to do
```

**Trampoline variant** — when the skill delegates to an agent:

```markdown
---
description: "..."
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Agent
---

# Skill Name

## Announce

> `plugin:skill` — Announce line.

## Agent Frontmatter

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/agents/`.

When spawning the agent:
1. **Read** `${CLAUDE_SKILL_DIR}/agents/worker.md`
2. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
3. **Extract** the markdown body (below closing `---`) as the agent's system prompt
4. **Spawn** with `subagent_type: "..."` and the prompt below

## Steps

### Step 1 — Spawn the agent

Read, parse, and spawn following the **Agent Frontmatter** section above.

Agent prompt:

\```
Skill directory: ${CLAUDE_SKILL_DIR}
Arguments: $ARGUMENTS
\```

Do not add output before or after. The agent handles everything.
```

## Agent

```yaml
---
# --- Frontmatter ---
name: worker                              # passed to Agent tool name parameter
description: What this agent does         # passed to Agent tool description parameter
tools: Read, Grep, Glob, Bash            # informational — enforced by subagent_type
model: sonnet                             # sonnet | opus | haiku | full model ID
---
```

```markdown
# Agent Name

You are [role]. [One-sentence framing of perspective and focus.]

## Input

You receive:
- **Skill directory** — absolute path to the skill directory; use for script calls
- **Arguments** — user-provided arguments forwarded from the skill

## Steps

### Step 1 — Gather data

Run:
\```bash
python3 <skill_dir>/scripts/gather.py
\```

Handle preconditions from the JSON output.

### Step 2 — Do the work

[Core logic. Reference the gathered data, interact with user if needed.]

### Step 3 — Present output

Format using the template below.

## Template

[TEMPLATE.md content embedded directly — not loaded at runtime.]

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion.

## Safety

> [!IMPORTANT]
> [Forbidden operations, read-only constraints, etc.]

## Edge cases

- **Condition** → what to do
```
