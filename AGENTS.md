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
          templates/              # output formats — see File Naming and Action Dispatch
            report.md             # main report format
            menu.md               # action menu bar (if skill has one)
            action.md             # optional: shared action response format
            action-<name>.md      # optional: per-action response format
          scripts/                # helper scripts — snake_case.py
          workers/                # co-located agents — kebab-case.md
            <agent-name>.md       # agent definition — frontmatter + system prompt
```

Skills are invoked as `<plugin>:<skill>` — e.g. `git:commit`, `code:review`, `write:plan`.

Variables available inside `SKILL.md` and co-located agent files:

| Variable | Resolves to |
|---|---|
| `${CLAUDE_SKILL_DIR}` | Absolute path to the skill's directory |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the plugin's installation directory |
| `${CLAUDE_PLUGIN_DATA}` | Persistent per-plugin data directory — survives plugin updates |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `$ARGUMENTS` | What the user typed after the slash command |
| `$ARGUMENTS[N]` / `$N` | Specific argument by zero-based index |

`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are also exported as environment variables to hook processes.

`CLAUDE.md` preloads have no special variables — use relative paths (resolved from the project root) or standard shell environment variables.

---

# Principles

## Self-Containment

Plugins should wire themselves. If a behavior can be expressed inside the plugin — in `hooks.json`, `SKILL.md` frontmatter, or `plugin.json` — do it there. Only fall back to `settings.json` for wiring that has no in-plugin equivalent.

The canonical example is hooks: a `UserPromptSubmit` hook belongs in `hooks/hooks.json`, not in the global `settings.json`. Skill-scoped lifecycle hooks belong in `SKILL.md` frontmatter. `settings.json` is for user-level configuration that spans plugins or has no plugin home.

## Platform Compatibility

All scripts, hooks, and commands must work on macOS, Linux, and Windows. Avoid shell features or system utilities that differ across platforms.

Python is a required preemclaud dependency — prefer it over shell for any script where portability is a concern. Bash is fine for simple hooks on known environments, but if a script uses OS-specific utilities or flag differences, rewrite it in Python.

Common traps to avoid:
- Hardcoded absolute paths (`/home/user/...`, `C:\Users\...`) — use `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, or relative paths instead
- macOS-only tools (`pbcopy`, `open`, `gstat`, `brew`)
- GNU vs BSD flag differences (`sed -i ''` vs `sed -i`)
- Hardcoded `/` path separators in Python (use `pathlib` or `os.path`)
- Assuming `bash` is available on Windows

## Naming Conventions

Protocol files — those the framework reads by a fixed, conventional name — use UPPERCASE:

`SKILL.md`, `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`

Everything else follows the convention of its file type:

- `.md` files (workers, templates, commands) → lowercase kebab-case: `security-reviewer.md`, `action-explain.md`
- `.py` files (scripts, hooks) → snake_case: `gather_data.py`, `post_bash.py`

---

# Patterns

## Trigger Description

Auto-triggerable skills (`disable-model-invocation: false`) append trigger rules after `//`:

```yaml
description: "Summary  //  Trigger when X. Do NOT trigger for Y."
```

The left side is for humans (slash command menu).  
The right side is Claude's dispatch logic — list concrete phrases to match and exclusions to prevent false positives.

## Announcer

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

Agent `.md` files stored in `skills/<skill>/workers/`. Claude Code does not auto-discover these — the skill reads, parses, and spawns them manually using the Agent Frontmatter protocol:

1. **Read** the `.md` file from `${CLAUDE_SKILL_DIR}/workers/`
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

**Exception:** a particular agent may need tools only available in `general-purpose` even when the overall pattern is read-only (e.g., `code:review`'s verifier needs LSP to trace symbols). Spawn that agent with `general-purpose` and enforce read-only behavior through its system prompt instead.

Multi-agent variant: `code:review` spawns several specialists in parallel from the same `workers/` directory and merges their findings. Same protocol, same frontmatter — see `ripperdoc/chrome/code/skills/review/SKILL.md`.

## Preload Command

`` !`command` `` executes a shell command at skill load time and inlines the stdout into the `SKILL.md` body. The output becomes available before the first step runs.

```markdown
## Preload

### Git state
!`python3 ${CLAUDE_SKILL_DIR}/scripts/gather.py`
```

Preloads run regardless of `allowed-tools` restrictions. They are not Claude tool calls — they're executed by the plugin loader.

In a trampoline, don't preload. The agent gathers its own data at runtime to avoid injecting large payloads into the main context.

## Skill-scoped Hooks

Hooks in `SKILL.md` frontmatter fire only during that skill's execution:

```yaml
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "python3 ${CLAUDE_SKILL_DIR}/scripts/post_bash.py"
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
2. **Hook config** (`hooks/hooks.json`) — wires `UserPromptSubmit` to the Python script via `${CLAUDE_PLUGIN_ROOT}`.
3. **Hook script** — matches the command, does the work, outputs the block decision.

Rules:
- Always check your command first and pass unmatched prompts through with `print("{}")` — never block commands that aren't yours.
- Strip the command prefix to parse arguments: `args = prompt.removeprefix("/my-command").lstrip()`.
- `decision: "block"` is the only required output field. `reason` is the user-visible message.
- Write the stub body as a real error message — it surfaces if the hook environment breaks.

```python
#!/usr/bin/env python3
import json, sys

data = json.load(sys.stdin)
prompt = data.get("prompt") or data.get("user_prompt") or ""

if not prompt.startswith("/my-command"):
    print("{}")
    sys.exit(0)

args = prompt.removeprefix("/my-command").lstrip()

# do the work here

print(json.dumps({"decision": "block", "reason": message}))
```

## Extended Thinking

Place an HTML comment `<!-- ultrathink -->` immediately before any step that requires deep reasoning — complex merges, severity re-calibration, multi-variable decisions:

```markdown
<!-- ultrathink -->
### Step 4 — Merge findings
```

The comment is invisible in rendered output but signals Claude to engage extended thinking for that step. Use sparingly — one or two steps per skill at most. Don't annotate every step.

## Action Dispatch

A skill with an action menu operates in two phases:

1. **Report phase** — generate and present using `templates/report.md` and `templates/menu.md`
2. **Action phase** — handle user-selected actions, optionally using `templates/action*.md`

**Input parsing rules (consistent across all skills):**

- Accept both short key and spelled-out word: `E 3` and `explain 3` are equivalent
- Match case-insensitively
- Accept multiple indices in one invocation: `E 1 3 7`

**Action template progression** — use the simplest that fits:

| Case | File | Use when |
|---|---|---|
| No structured output | none — inline instructions | Dismiss, Pin, state toggles |
| All actions share a format | `templates/action.md` | Single output shape regardless of action |
| Actions have distinct formats | `templates/action-<name>.md` | Explain vs Verify produce different structures |

**`## Actions` section in SKILL.md** — one named subsection per action, placed after `## Template`:

```markdown
## Actions

Wait for user input. Parse case-insensitively; accept both short key and spelled-out word. Apply to all provided indices in one response.

### [E]xplain #N

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/action-explain.md').read(), end='')"`

> [!IMPORTANT]
> This template is MANDATORY. Apply to each requested N in sequence.

### [D]ismiss #N

Remove finding N from the active set. Reprint the findings header with updated counts.
```

---

# Mechanics

How the runtime actually behaves — facts you need to reason about what your skill, hook, or agent will do.

## Hooks

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | Success — stdout parsed as JSON for structured output |
| `2` | Blocking error — stdout ignored, stderr fed to Claude as feedback; blocks the triggering action |
| other | Non-blocking — stderr visible in verbose mode only |

The `2` code is what makes `PreToolUse` block a tool call, `Stop` prevent stopping, `UserPromptSubmit` erase a prompt, etc.

**Parallel execution**

Multiple hooks matching the same event run in parallel. Identical commands on the same event are deduplicated and run once.

**Hook types**

| Type | Description |
|---|---|
| `command` | Shell script — receives JSON on stdin |
| `http` | POST to a URL |
| `prompt` | Single-turn LLM eval — returns `{"ok": bool, "reason": "..."}` |
| `agent` | Multi-turn subagent with tools — same return format as `prompt`; 60s timeout, 50 tool turns max |

**`CLAUDE_ENV_FILE`**

`SessionStart` and `CwdChanged` hooks can append `export VAR=val` lines to this file. Those vars are applied before every subsequent Bash command in the session — useful for direnv-style env loading on directory change.

## Agents

**Model resolution order**

1. `CLAUDE_CODE_SUBAGENT_MODEL` env var
2. Per-invocation `model` parameter
3. Agent frontmatter `model` field
4. Parent session model

**`Stop` hook remapping**

`Stop` hooks defined in agent frontmatter are silently converted to `SubagentStop`. Write `SubagentStop` directly to be explicit.

**Skill injection**

Skills listed in agent frontmatter are injected in full at startup. The agent does not inherit skills loaded in the parent session.

## Skills

**`disable-model-invocation: true`**

Removes the description from Claude's context entirely — not just prevents auto-invocation. Claude won't know the skill exists until the user invokes it directly.

**`context: fork`**

Runs the skill in an isolated subagent. Conversation history is not available. Skill content must be an actionable task; guidelines-only content leaves the subagent with nothing to do.

---

# Constraints

Things that look like they should work but don't.

**Shell profile interference**

Hooks run in non-interactive shells. Any `echo` or output in `.zshrc`/`.bashrc` prepends to stdout and breaks JSON parsing. Guard profile output: `if [[ $- == *i* ]]; then echo "..."; fi`

**Stop hook loop**

A `Stop` hook that always returns `{"decision": "block"}` causes Claude to loop forever. Read `stop_hook_active` from the hook input to detect re-entry and exit cleanly.

**Plugin agent restrictions**

Agents shipped inside a plugin cannot use `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. If those are needed, the agent must live in `.claude/agents/` instead.

**`${CLAUDE_PLUGIN_ROOT}` changes on update**

`${CLAUDE_PLUGIN_ROOT}` points to the current install path, which changes when the plugin updates. Don't cache it. Store persistent artifacts in `${CLAUDE_PLUGIN_DATA}` instead.

---

# Template

Output formats live in `templates/` co-located with `SKILL.md`. See **Action Dispatch** for the full layout and the **File Naming** principle for naming rules.

Use the `python3 -c` form to load — it works on all platforms. Always follow a template load with an `[!IMPORTANT]` callout. Without it, Claude treats the format as a suggestion.

## Code Snippets

When referencing source code in output, use the Rust diagnostic style — line number gutter, pipe separator, and caret annotation:

````
```
  → path/to/file.rs:42
   |
42 |     let x = foo();
   |             ^^^^^ issue annotation here
```
````

Rules:
- Show 1–3 lines of context around the highlighted line
- Use `^` for single-token highlights, `~` for multi-token spans
- Wrap in a fenced code block so indentation renders consistently
- Omit entirely if the finding needs no code — don't pad with irrelevant lines

This keeps inline references scannable and visually consistent with compiler/linter output the user already reads.

## Action Menu

A template can end with an interactive action menu — a fenced code block containing keyboard shortcuts the user can invoke after the report:

````
```
  ──────────────────────────────────────────────────────────────────
  ▸ [E]xplain #N     ▸ [D]ismiss #N     ▸ [V]erify
```
````

The fenced code block ensures consistent rendering. Every action listed in the menu must have a corresponding handler — structured using the **Action Dispatch** pattern (see Patterns).

## Sub-templates

When a skill spawns multiple agents and merges their results, two template levels exist:

1. **Agent output format** — embedded directly in each agent's body as an `## Output` section. This defines the structure the agent uses to report its findings (e.g. `### Critical / ### Warnings / ### Suggestions / ### Questions`). It is what the skill's merge step processes.

2. **Skill `templates/report.md`** — the final output format presented to the user after merging, de-duplication, severity re-calibration, and any verification pass.

The flow: agents produce findings using their embedded format → skill merge step re-categorizes, de-duplicates, and re-calibrates severity → skill presents using `templates/report.md`.

Agent output formats don't need to match `templates/report.md`. They're a contract between agents and the merge logic. Agents produce raw findings; the skill adds structure (sequential numbering, cross-agent de-duplication, compact-first layout).

**Compact-first design:** A common `templates/report.md` pattern where the initial render is a scannable index — each finding is a short two-line entry — and full detail is only shown on demand via the action menu (Explain action). This keeps the report readable at a glance and lets the user drill into only what matters.

## Embedding in co-located Agents

In a co-located agent, embed the template content directly in the agent body — agents don't have `${CLAUDE_SKILL_DIR}` resolved at load time. They receive it as runtime input and would need an extra tool call to read the file. Embedding avoids this.

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

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/report.md').read(), end='')"`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries.

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/menu.md').read(), end='')"`

> [!IMPORTANT]
> Append this menu verbatim after the report body.

## Actions

Wait for user input. Parse case-insensitively; accept both short key and spelled-out word. Apply to all provided indices in one response.

### [E]xplain #N

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/action-explain.md').read(), end='')"`

> [!IMPORTANT]
> This template is MANDATORY. Apply to each requested N in sequence.

### [D]ismiss #N

Inline instructions — no template file needed.

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

This skill delegates to a co-located agent in `${CLAUDE_SKILL_DIR}/workers/`.

When spawning the agent:
1. **Read** the `.md` file from `${CLAUDE_SKILL_DIR}/workers/`
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
