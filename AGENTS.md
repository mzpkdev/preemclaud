# Authoring Reference

How skills, agents, and hooks are written in this repository.

```
ripperdoc/
  chrome/                         # high-level skills — write, code, create, knowledge, meta
  deck/                           # external integrations — git, IDE
  optics/                         # language servers — typescript, python, scala, java
  cortex/                         # system internals — update daemon
  <marketplace>/
    <plugin>/
      .claude-plugin/
        plugin.json               # { name, description, version }
      scripts/                    # shared helper scripts — snake_case.py
      skills/
        <skill>/
          SKILL.md                # skill definition — frontmatter + instructions
          templates/              # output formats — see File Naming and Action Dispatch
            report.md             # main report format
            menu.md               # action menu bar (if skill has one)
            action.md             # optional: shared action response format
            action-<name>.md      # optional: per-action response format
          workers/                # co-located agents — kebab-case.md
            <agent-name>.md       # agent definition — frontmatter + system prompt
          references/             # optional: non-executable documentation
```

Skills are invoked as `<plugin>:<skill>` — e.g. `git:commit`, `code:review`, `write:plan`.

Variables available inside `SKILL.md` and co-located agent files:

| Variable | Resolves to |
|---|---|
| `${CLAUDE_SKILL_DIR}` | Absolute path to the skill's directory |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the plugin's install directory |
| `${CLAUDE_PLUGIN_DATA}` | Persistent per-plugin data directory — survives updates |
| `${CLAUDE_SESSION_ID}` | Current session ID — no current usage in repo |
| `$ARGUMENTS` | What the user typed after the slash command |
| `$ARGUMENTS[N]` / `$N` | Specific argument by zero-based index |

`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` are also exported as environment variables to hook
processes.

`CLAUDE.md` preloads have no special variables — use relative paths (resolved from the project root) or
standard shell environment variables.

---

# Principles

## Self-Containment

Plugins should wire themselves. If a behavior can be expressed inside the plugin — in `hooks.json`, `SKILL.md`
frontmatter, or `plugin.json` — do it there. Only fall back to `settings.json` for wiring that has no
in-plugin equivalent.

The canonical example is hooks: a `UserPromptSubmit` hook belongs in `hooks/hooks.json`, not in the global
`settings.json`. Skill-scoped lifecycle hooks belong in `SKILL.md` frontmatter. `settings.json` is for
user-level configuration that spans plugins or has no plugin home.

## Platform Compatibility

All scripts, hooks, and commands must work on macOS, Linux, and Windows. Avoid shell features or system
utilities that differ across platforms.

Python is a required preemclaud dependency — prefer it over shell for any script where portability is a
concern. Bash is fine for simple hooks on known environments, but if a script uses OS-specific utilities or
flag differences, rewrite it in Python.

Common traps to avoid:
- Hardcoded absolute paths (`/home/user/...`, `C:\Users\...`) — use `${CLAUDE_SKILL_DIR}`,
  `${CLAUDE_PLUGIN_ROOT}`, or relative paths instead
- macOS-only tools (`pbcopy`, `open`, `gstat`, `brew`)
- GNU vs BSD flag differences (`sed -i ''` vs `sed -i`)
- Hardcoded `/` path separators in Python (use `pathlib` or `os.path`)
- Assuming `bash` is available on Windows

## Naming Conventions

Protocol files — those the framework reads by a fixed, conventional name — use UPPERCASE:

`SKILL.md`, `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`

Everything else follows the convention of its file type:

- `.md` files (workers, templates, commands) → lowercase kebab-case: `security-
  reviewer.md`, `action-explain.md`
- `.py` files (scripts, hooks) → snake_case: `gather_data.py`, `post_bash.py`

### Cyberpunk File Naming

Skills that produce artifact files (specs, briefs, plans) write them to a project directory using a two-word
`<adjective>-<noun>.md` pattern drawn from Cyberpunk 2077 vocabulary — street slang, faction names, iconic
gear — e.g. `.claude/plans/voodoo-ripperdoc.md`, `chrome-caliburn.md`, `gonk-skippy.md`

Names are random and memorable — easy to reference in conversation and collision-resistant without timestamps
or UUIDs. Before writing, glob the target directory to ensure the chosen name doesn't already exist.

## References Directory

A skill can include a `references/` directory alongside `SKILL.md` for non-executable documentation that's too
large to inline but central to the skill's function — hook reference guides, schema definitions, agent
creation references.

```
skills/
  <skill>/
    SKILL.md
    references/
      hooks-reference.md
      schemas.md
```

Reference files are loaded on demand (via Read or `` !`cat` ``), not injected automatically. Keep them factual
and versioned with the skill — if the reference drifts from the skill's behavior, it becomes a liability.

Used by: `knowledge:teams`, `knowledge:mcp`, `create:agent`, `create:hook`, `create:superskill`.

## Agent Spawning

The only way to reliably spawn a subagent inside a skill or agent is to explicitly call the **Agent tool**.
Never instruct Claude to "spawn an agent" or "run this in a subagent" using natural language alone — that
works conversationally but is not reliable inside skill execution.

Any `SKILL.md` or agent body that spawns a subagent must write the call explicitly:

```
Call the Agent tool with:
- description: <value from frontmatter>
- subagent_type: "Explore" | "general-purpose"
- model: <value from frontmatter>
- name: <value from frontmatter>
- prompt: |
    CLAUDE_SKILL_DIR: ${CLAUDE_SKILL_DIR}
    CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
    ARGUMENTS: $ARGUMENTS
    <task-specific context>
```

**Required parameters:**

| Parameter | Source |
|---|---|
| `description` | Agent frontmatter `description` field |
| `subagent_type` | Skill decision — see subagent types table |
| `prompt` | Skill-assembled string — always include vars |

**Optional parameters:**

| Parameter | Values | Notes |
|---|---|---|
| `model` | `sonnet`, `opus`, `haiku` | Overrides frontmatter |
| `name` | string | Addressable via `SendMessage` |
| `mode` | `default`, `acceptEdits`, etc. | Permission mode |
| `run_in_background` | `true` / `false` | Non-blocking; notified on completion |
| `isolation` | `worktree` | Temporary git worktree |

Omitting explicit parameters causes the Agent tool to fall back to defaults that may not match the intended
behavior.

---

# Patterns

| Pattern | Agents | Coordination | Use when |
|---|---|---|---|
| Direct | 0 | — | Skill can do everything inline |
| Trampoline | 1 | — | Heavy data for isolated context |
| Parallel Agents | N | None (merge after) | Multiple independent viewpoints |
| Team | N | Live (SendMessage) | Agents must coordinate |
| Prompt Intercept | 0 | — | Pure side effect, no reasoning |
| Resumable Agent | — | User ↔ Agent | Multi-turn user input |

## Trigger Description

Auto-triggerable skills (`disable-model-invocation: false`) append trigger rules after `//`:

```yaml
description: "Summary  //  Trigger when X. Do NOT trigger for Y."
```

The left side is for humans (slash command menu). The right side is Claude's dispatch logic — list concrete
phrases to match and exclusions to prevent false positives.

## Announcer

Every skill opens with an announce line — a blockquote printed on activation so the user knows which skill
fired:

```markdown
> Daemon `code:write` online. Starting pipeline.
```

Format: `` > Daemon `plugin:skill` online. Action phrase. `` One line, states what the skill is about to do.

## Trampoline

A skill that exists only to spawn an agent. The main conversation sees the announce line and the agent's final
output. Everything in between — gather scripts, diffs, JSON payloads — stays in the agent's isolated context.

Use when the skill processes heavy data that shouldn't pollute the main context. Don't use for lightweight
lookups or reference injections. For multi-turn user interaction after the agent returns, compose with the
Resumable Agent pattern.

Rules:
- `allowed-tools: Read, Agent` — that's all a trampoline needs
- No preloads — the agent gathers its own data at runtime
- No hooks — `PostToolUse` hooks on the trampoline won't fire inside the agent; build
  reporting into the agent's output instead
- Don't duplicate the agent's output after it returns

Existing trampolines: `git:status`, `git:commit`, `git:deconflict`.

## Co-located Agents

Agent `.md` files stored in `skills/<skill>/workers/`. Claude Code does not auto-discover these — the skill
reads, parses, and spawns them manually using the Agent Frontmatter protocol:

1. **Read** the `.md` file from `${CLAUDE_SKILL_DIR}/workers/`
2. **Parse** YAML frontmatter — extract `name`, `description`, `model`
3. **Extract** the markdown body as the system prompt
4. **Call the Agent tool** — pass `name`, `description`, `subagent_type`, `model`, and the
   assembled prompt (see **Agent Spawning** principle for full parameter reference)

Pass `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, and `$ARGUMENTS` in the agent's prompt so it can find
scripts and know what the user asked for. Scripts live at the plugin level (`${CLAUDE_PLUGIN_ROOT}/scripts/`)
— always pass `${CLAUDE_PLUGIN_ROOT}` so agents can locate them.

Any `SKILL.md` that uses co-located agents must include an **Agent Frontmatter** section documenting these
steps inline. It serves as both instruction to Claude and documentation for readers.

Subagent types — pick the most restrictive that works:

| `subagent_type` | Tools | Use when |
|---|---|---|
| `Explore` | Read, Grep, Glob, Bash (read-only) | Analysis, research |
| `general-purpose` | All | File writes, git ops |

**Exception:** a particular agent may need tools only available in `general-purpose` even when the overall
pattern is read-only (e.g., `code:review`'s verifier needs LSP to trace symbols). Spawn that agent with
`general-purpose` and enforce read-only behavior through its system prompt instead.

## Parallel Agents

A skill that spawns multiple specialist agents in parallel, each analyzing the same input from a different
perspective, then merges their output into a unified report.

Use when the skill needs multiple independent viewpoints on the same artifact. Don't use when agents would
need to coordinate or share state during execution — use the Team pattern instead.

Flow:
1. **Scope** — Gather the input (diff, artifact, etc.)
2. **Fan out** — Spawn all agents in parallel in a single message. Each agent gets the
   same input but a different focus. Embed the input directly in the prompt — don't save to a temp file
   (agents may misread injected line numbers as source line numbers).
3. **Merge** — Collect findings and merge by severity across all agents, not by agent. Tag
   each finding with its source agent.
4. **Re-calibrate** — Specialist agents inflate severity within their domain. Apply a
   shared rubric across the full merged list and demote liberally.
5. **Verify** — Optionally spawn a verifier agent to validate merged findings against the
   actual source (see Error Handling — Verifier pass).
6. **Present** — Format using the skill's `templates/report.md`.

**Selective spawning:** Not every agent applies every time. Skip agents whose focus area is irrelevant to the
input (e.g., skip a tests agent if no test files exist).

**Agent output format:** Each agent uses an embedded output structure (e.g., `### Critical / ### Warnings /
### Suggestions`) — a contract between agents and the merge step, separate from `templates/report.md`. See
Sub-templates in the Template section.

Reference: `code:review` — 7 parallel specialists + verifier.

## Team

A skill that creates a persistent agent team with inter-agent communication. Agents communicate directly with
each other via `SendMessage`; the skill acts as lead and handles only escalations and disputes.

Use when agents must coordinate during execution — the defining characteristic is a communication protocol
with named message types. Don't use when agents can work independently — use Parallel Agents instead.

Required tools: `TeamCreate`, `SendMessage`, `TeamDelete`, `Agent`.

Flow:
1. **Research** — Lead gathers context and produces differentiated briefings per teammate
   (different agents may receive different subsets of information by design).
2. **Spawn** — `TeamCreate`, then spawn all teammates in a single message. Splitting
   across turns risks keystroke corruption during agent startup.
3. **Monitor** — Handle protocol messages only. Do not relay messages between teammates —
   they communicate directly. Ignore idle notifications.
4. **Arbitrate** — Handle `DISPUTE` and `ESCALATE` messages. For disputes, hear both sides
   before ruling. For escalations, answer from context or surface to the user.
5. **Cleanup** — `TeamDelete` when done. If it fails, force-clean per `knowledge:teams`.

**Communication protocol:** Define named message types (e.g., `CHECKPOINT`, `DISPUTE`, `ESCALATE`, `COMPLETE`)
so the lead can distinguish protocol signals from noise.

**Agent definitions:** Store in `team/` (not `workers/`) to signal the coordination model. Same frontmatter
protocol as Co-located Agents.

Reference: `code:write` (lead/builder/test-writer). See `knowledge:teams` for guardrails and cleanup
procedures.

## Resumable Agent

Composable pattern that adds multi-turn user interaction to any pattern that spawns agents. After the agent
returns its first output, the skill relays user input via `SendMessage` using the agent's ID. The agent
auto-resumes in the background; the skill waits for the task notification, then shows the response. This
repeats until the agent signals completion.

Use when the agent needs user approval, edit cycles, or iterative refinement before acting.

Composes with: Trampoline (most common), Parallel Agents (post-merge interaction), Team (post-cleanup
interaction).

Requirements:
- `SendMessage` in `allowed-tools`
- Agent defines a completion signal so the skill knows when to stop relaying

Flow: spawn agent → show output → wait for user input → `SendMessage(to: agentId)` → wait for background
notification → show response → check for completion signal → repeat or stop.

**Agent ID, not name:** The Agent tool returns an `agentId` in its result. Use that ID in `SendMessage`'s `to`
field. Name-based addressing is for `TeamCreate` teammates — it won't resume a bare subagent.

**Background resumption:** A stopped subagent that receives a `SendMessage` auto-resumes in the background.
The skill is notified when the agent finishes. The notification includes the agent's response, which the skill
shows to the user.

## Preload Command

`` !`command` `` executes a shell command at skill load time and inlines the stdout into the `SKILL.md` body.
The output becomes available before the first step runs.

```markdown
## Preload

### Git state
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/gather.py`
```

Preloads run regardless of `allowed-tools` restrictions. They are not Claude tool calls — they're executed by
the plugin loader.

In a trampoline, don't preload. The agent gathers its own data at runtime to avoid injecting large payloads
into the main context.

## Skill-scoped Hooks

Hooks in `SKILL.md` frontmatter fire only during that skill's execution:

```yaml
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "python3 ${CLAUDE_PLUGIN_ROOT}/scripts/post_bash.py"
```

Supported events: `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `Notification`.

`matcher` matches against tool names. `"Bash"` fires on any Bash call.

Caveat: skill-scoped hooks fire for tool calls in the main context only. They do not fire inside a spawned
agent. If the agent needs post-action reporting, build it into the agent's own steps.

## Prompt Intercept

A slash command handled entirely by a `UserPromptSubmit` hook — Claude never receives the prompt, no API turn
is consumed. The hook runs code as a side effect and returns `{"decision":"block","reason":"..."}`, where
`reason` is what the user sees.

Use when the command is a pure side effect: clipboard copy, file write, toggle a setting, external API call.
Don't use when the command needs Claude to reason, generate output, or hold a conversation.

Three pieces:

1. **Stub command** (`commands/<name>.md`) — registers the slash command in `/help`.
   `disable-model-invocation: true` prevents programmatic invocation. The body is a fallback message shown
   only if the hook fails to intercept.
2. **Hook config** (`hooks/hooks.json`) — wires `UserPromptSubmit` to the Python script
   via `${CLAUDE_PLUGIN_ROOT}`.
3. **Hook script** — matches the command, does the work, outputs the block decision.

Rules:
- Always check your command first and pass unmatched prompts through with `print("{}")` —
  never block commands that aren't yours.
- Strip the command prefix to parse arguments: `args = prompt.removeprefix("/my-
  command").lstrip()`.
- `decision: "block"` is the only required output field. `reason` is the user-visible
  message.
- Write the stub body as a real error message — it surfaces if the hook environment
  breaks.

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

## Skill-to-Skill Invocation

A skill can invoke another skill using the `Skill` tool. This is useful when one skill's output feeds into
another — e.g., fetching external context before planning.

```markdown
### Step 1 — Fetch external context

If `$ARGUMENTS` contains URLs, invoke `knowledge:links` via the
Skill tool before proceeding.
```

The invoked skill runs in the same conversation context. It inherits the current tool permissions, not the
calling skill's `allowed-tools`. The calling skill must list `Skill` in its own `allowed-tools` for this to
work.

Use sparingly — skill-to-skill calls add complexity. Prefer them only when the invoked skill handles
authentication, routing, or multi-step retrieval that would be wrong to duplicate.

Used by: `write:plan` (invokes `knowledge:links` for URL context).

## Extended Thinking

Place an HTML comment `<!-- ultrathink -->` immediately before any step that requires deep reasoning — complex
merges, severity re-calibration, multi-variable decisions:

```markdown
<!-- ultrathink -->
### Step 4 — Merge findings
```

The comment is invisible in rendered output but signals Claude to engage extended thinking for that step. Use
sparingly — one or two steps per skill at most. Don't annotate every step.

## Error Handling

Pick the appropriate strategy for each failure mode — not every skill needs all of these.

**Preload script fallback** — The script must always emit valid JSON — catch all exceptions and output
`{"error": "gather failed"}` on failure:

```python
# gather.py — always exits with valid JSON
try:
    # ... gather logic ...
    print(json.dumps(result))
except Exception:
    print(json.dumps({"error": "gather failed"}))
```

Then the preload needs no shell-level fallback:

```
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/gather.py`
```

Check for the `error` key before proceeding. Tell the user and stop. Used by: `code:review`.

**Precondition check** — Gather scripts return a `precondition_failures` array in their JSON output. Stop and
report which precondition failed. Don't attempt automatic recovery — precondition failures represent states
that require human intervention (detached HEAD, merge in progress, not a git repo). Used by: `git:commit`,
`git:deconflict`.

**Verifier pass** — After agents produce findings, spawn a separate verifier agent to validate claims against
the actual codebase. Drop invalid findings, flag uncertain ones with a manual-verify note, correct line
references. Used by: `code:review`.

**Review loop cap** — When a reviewer subagent iterates on an artifact, cap at 3 iterations. If still failing
after 3, surface to the user for guidance rather than spinning. Used by: `write:brief`, `write:spec`.

**Stall detection** — Track reviewer feedback across iterations. If two consecutive reviews flag the same core
issue: first stall, restructure, and try a fundamentally different approach. Second stall (third consecutive
same-issue), stop early and tell the user what was tried. Used by: `meta:improve`.

**Dispute cap** — In multi-agent teams, cap disputes at 3 per session. After 3, batch remaining disputes and
present to the user at once. Used by: `code:write`.

**Recovery guidance** — When a destructive operation fails, stop immediately. Explain what happened, show repo
state, and provide exact commands to recover. Don't attempt automatic recovery. Used by: `git:deconflict`.

## Action Dispatch

A skill with an action menu operates in two phases:

1. **Report phase** — generate and present using `templates/report.md` and
   `templates/menu.md`
2. **Action phase** — handle user-selected actions, optionally using
   `templates/action*.md`

**Input parsing rules (consistent across all skills):**

- Accept both short key and spelled-out word: `E 3` and `explain 3` are equivalent
- Match case-insensitively
- Accept multiple indices in one invocation: `E 1 3 7`

**Action template progression** — use the simplest that fits:

| Case | File | Use when |
|---|---|---|
| No structured output | none — inline | Dismiss, Pin, toggles |
| All actions share a format | `action.md` | Single output shape |
| Actions have distinct formats | `action-<name>.md` | Explain vs Verify |

**`## Actions` section in SKILL.md** — one named subsection per action, placed after `## Template`:

```markdown
## Actions

Wait for user input. Parse case-insensitively; accept both short key
and spelled-out word. Apply to all provided indices in one response.

### [E]xplain #N

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/action-explain.md').read(), end='')"`

> [!IMPORTANT]
> This template is MANDATORY. Apply to each requested N in sequence.

### [D]ismiss #N

Remove finding N from the active set. Reprint the findings header
with updated counts.
```

---

# Mechanics

How the runtime actually behaves — facts you need to reason about what your skill, hook, or agent will do.

## Hooks

**Exit codes**

| Code | Meaning |
|---|---|
| `0` | Success — stdout parsed as JSON |
| `2` | Blocking error — stdout ignored, stderr fed to Claude |
| other | Non-blocking — stderr visible in verbose mode only |

The `2` code is what makes `PreToolUse` block a tool call, `Stop` prevent stopping, `UserPromptSubmit` erase a
prompt, etc.

**Parallel execution**

Multiple hooks matching the same event run in parallel. Identical commands on the same event are deduplicated
and run once.

**Hook types**

| Type | Description |
|---|---|
| `command` | Shell script — receives JSON on stdin |
| `http` | POST to a URL |
| `prompt` | Single-turn LLM eval — returns `{"ok": bool, "reason": "..."}` |
| `agent` | Multi-turn subagent with tools — same format; 60s timeout |

**`async` flag**

Add `"async": true` to a hook object to run it without blocking. The hook fires and the triggering action
proceeds immediately — the hook's exit code and output are ignored. Use for side effects that don't need to
gate execution: IDE file opens, telemetry, background setup.

```json
{
  "type": "command",
  "command": "python3 \"${CLAUDE_PLUGIN_ROOT}/hooks/auto_open.py\"",
  "async": true
}
```

Used by: `jetbrains-ide` (SessionStart and PostToolUse hooks).

**`CLAUDE_ENV_FILE`**

`SessionStart` and `CwdChanged` hooks can append `export VAR=val` lines to this file. Those vars are applied
before every subsequent Bash command in the session — useful for direnv-style env loading on directory change.

## Agents

**Model naming standard**

Always use shorthands — `sonnet`, `opus`, or `haiku`. Never use full model IDs. Shorthands resolve to the
latest model in that family, so skills stay current without edits when models update.

**Model resolution order**

1. `CLAUDE_CODE_SUBAGENT_MODEL` env var
2. Per-invocation `model` parameter
3. Agent frontmatter `model` field
4. Parent session model

**`Stop` hook remapping**

`Stop` hooks defined in agent frontmatter are silently converted to `SubagentStop`. Write `SubagentStop`
directly to be explicit.

**Skill injection**

Skills listed in agent frontmatter are injected in full at startup. The agent does not inherit skills loaded
in the parent session.

## Skills

**`disable-model-invocation: true`**

Removes the description from Claude's context entirely — not just prevents auto- invocation. Claude won't know
the skill exists until the user invokes it directly.

**`context: fork`**

Runs the skill in an isolated subagent. Conversation history is not available. Skill content must be an
actionable task; guidelines-only content leaves the subagent with nothing to do.

---

# Constraints

Things that look like they should work but don't.

**Shell profile interference**

Hooks run in non-interactive shells. Any `echo` or output in `.zshrc`/`.bashrc` prepends to stdout and breaks
JSON parsing. Guard profile output (Unix only — `.zshrc`/`.bashrc` don't exist on Windows): `if [ -n "$PS1" ];
then echo "..."; fi`

**Stop hook loop**

A `Stop` hook that always returns `{"decision": "block"}` causes Claude to loop forever. Read
`stop_hook_active` from the hook input to detect re-entry and exit cleanly.

**Plugin agent restrictions**

Agents shipped inside a plugin cannot use `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. If
those are needed, the agent must live in `.claude/agents/` instead.

**`${CLAUDE_PLUGIN_ROOT}` changes on update**

`${CLAUDE_PLUGIN_ROOT}` points to the current install path, which changes when the plugin updates. Don't cache
it. Store persistent artifacts in `${CLAUDE_PLUGIN_DATA}` instead.

---

# Template

Output formats live in `templates/` co-located with `SKILL.md`. See **Action Dispatch** for the full layout
and the **File Naming** principle for naming rules.

Use the `python3 -c` form to load — it works on all platforms. Always follow a template load with an
`[!IMPORTANT]` callout. Without it, Claude treats the format as a suggestion.

## Report Structure

Every `templates/report.md` follows a three-part layout:

````markdown
# <Skill Name> — Output Template

<One-line goal — what the user should get at a glance.>

---

## Scenarios

### <Scenario name>

<One sentence: when this output appears.>

<output skeleton — the exact shape with placeholders>

### <Another scenario>  ← repeat for multi-state skills

---

## Format rules

**<Rule name>**
<Disambiguation, conditional logic, or edge case handling.>
````

| Section | Required | Purpose |
|---|---|---|
| Title + preamble | Yes | Boundary signal when injected into SKILL.md |
| `## Scenarios` | Yes | One `### <Name>` per distinct output state |
| `## Format rules` | No | Additive rules the skeleton can't express |

**Skeletal-first:** The skeleton under each scenario IS the output — Claude reproduces it with real data.
Format rules exist only when the skeleton is ambiguous or has conditional logic. Templates with a fixed output
shape and no conditionals omit `## Format rules` entirely.

**Single vs multi-state:** Skills with one output shape use a single named scenario (e.g. `### Commit plan`).
Skills with multiple output states use one scenario per state (e.g. `### Success`, `### Conflict`, `###
Abort`).

## Code Snippets

When referencing source code in output, use the Rust diagnostic style — line number gutter, pipe separator,
and caret annotation:

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

This keeps inline references scannable and visually consistent with compiler/linter output the user already
reads.

## Action Menu

A template can end with an interactive action menu — a fenced code block containing keyboard shortcuts the
user can invoke after the report:

````
```
────────────────────────────────────────────────────────────────── ▸ [E]xplain #N     ▸ [D]ismiss #N     ▸
[V]erify
```
````

The fenced code block ensures consistent rendering. Every action listed in the menu must have a corresponding
handler — structured using the **Action Dispatch** pattern (see Patterns).

## Sub-templates

When a skill spawns multiple agents and merges their results, two template levels exist:

1. **Agent output format** — embedded directly in each agent's body as an `## Output`
   section. This defines the structure the agent uses to report its findings (e.g. `### Critical / ###
   Warnings / ### Suggestions / ### Questions`). It is what the skill's merge step processes.

2. **Skill `templates/report.md`** — the final output format presented to the user after
   merging, de-duplication, severity re-calibration, and any verification pass.

The flow: agents produce findings using their embedded format → skill merge step re- categorizes,
de-duplicates, and re-calibrates severity → skill presents using `templates/report.md`.

Agent output formats don't need to match `templates/report.md`. They're a contract between agents and the
merge logic. Agents produce raw findings; the skill adds structure (sequential numbering, cross-agent
de-duplication, compact-first layout).

**Compact-first design:** A common `templates/report.md` pattern where the initial render is a scannable index
— each finding is a short two-line entry — and full detail is only shown on demand via the action menu
(Explain action). This keeps the report readable at a glance and lets the user drill into only what matters.

## Reading templates in co-located Agents

In a co-located agent, read the template at runtime — the agent receives `$CLAUDE_SKILL_DIR` as part of its
prompt input (passed by the skill). Add a Read step before the output step:

```
Read $CLAUDE_SKILL_DIR/templates/report.md
```

Don't embed `templates/` content directly in the agent body. If the template changes, embedded copies drift
silently.

**Exception:** agent output formats used for inter-agent communication (raw findings structures) stay embedded
— they're a contract between agents and the merge step, not files in `templates/`.

---

# Structure

## Skill

```yaml
---
# --- Frontmatter ---
description: "Summary  //  trigger rules (omit // side if manual-only)"
user-invocable: true                      # appears as /plugin:skill
disable-model-invocation: true            # true = manual only
argument-hint: "[optional args]"          # shown in autocomplete
allowed-tools: Read, Grep, Glob           # restricts tool access
model: sonnet                             # sonnet | opus | haiku
hooks:                                    # optional — skill-scoped
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "..."
---
```

**`allowed-tools` filtering:** `Bash` can be restricted to specific command patterns with `Bash(pattern *)`.
The skill can only run Bash commands matching the pattern — everything else is blocked.

```yaml
allowed-tools: Read, Grep, Glob, Bash(python3 *)  # only python3
allowed-tools: Read, Agent, Bash(git *)            # only git
```

Used by: `code:review` (`python3 *`), `code:write` (`git *`).

```markdown
# Skill Name

## Announce

> Daemon `plugin:skill` online. Action phrase.

## Preload

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/gather.py`

## Steps

### Step 1 — First thing

Instructions. Reference preloaded data, run tools, interact with
user.

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

Wait for user input. Parse case-insensitively; accept both short key
and spelled-out word. Apply to all provided indices in one response.

### [E]xplain #N

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/action-explain.md').read(), end='')"`

> [!IMPORTANT]
> This template is MANDATORY. Apply to each requested N in sequence.

### [D]ismiss #N

Inline instructions — no template file needed.

## Safety

> [!IMPORTANT]
> Non-negotiable constraints. Forbidden operations, read-only rules,
> etc.

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

> Daemon `plugin:skill` online. Action phrase.

## Agent Frontmatter

This skill delegates to a co-located agent in
`${CLAUDE_SKILL_DIR}/workers/`.

When spawning the agent:
1. **Read** the `.md` file from `${CLAUDE_SKILL_DIR}/workers/`
2. **Parse** YAML frontmatter between `---` delimiters — extract `name`, `description`, `model`
3. **Extract** the markdown body (below closing `---`) as the agent's system prompt
4. **Call the Agent tool** with `name`, `description`, `subagent_type`, `model`, and the prompt below

## Steps

### Step 1 — Spawn the agent

Read `${CLAUDE_SKILL_DIR}/workers/worker.md`, parse YAML
frontmatter, extract the markdown body, then:

Call the Agent tool with:
- name: \<from frontmatter\>
- description: \<from frontmatter\>
- subagent_type: "Explore" | "general-purpose"
- model: \<from frontmatter\>
- prompt: |
    CLAUDE_SKILL_DIR: ${CLAUDE_SKILL_DIR}
    ARGUMENTS: $ARGUMENTS

    \<agent body from the .md file\>

Print the announce line, then spawn the agent. Do not add output
after the agent returns — the agent's output is final.
```

## Agent

```yaml
---
# --- Frontmatter ---
name: worker                              # passed to Agent tool
description: What this agent does         # passed to Agent tool
model: sonnet                             # sonnet | opus | haiku
---
```

```markdown
# Agent Name

You are [role]. [One-sentence framing of perspective and focus.]

## Input

The skill passes these values in its prompt:

```
CLAUDE_SKILL_DIR: <absolute path> ARGUMENTS: <user args>
```

## Steps

### Step 1 — Gather data

Run:
\```bash
python3 $CLAUDE_PLUGIN_ROOT/scripts/gather.py
\```

Handle preconditions from the JSON output.

### Step 2 — Do the work

[Core logic. Reference the gathered data, interact with user if
needed.]

### Step 3 — Present output

Read `$CLAUDE_SKILL_DIR/templates/report.md` and format using that
template.

> [!IMPORTANT]
> The template is MANDATORY, not a suggestion.

## Safety

> [!IMPORTANT]
> [Forbidden operations, read-only constraints, etc.]

## Edge cases

- **Condition** → what to do
```
