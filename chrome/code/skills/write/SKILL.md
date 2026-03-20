---
description: "Write the code for a feature  //  Trigger whenever a user asks to implement, build, or add functionality that touches more than a single function: 'implement X', 'build X', 'add X feature', 'write the code for X'. Use for any non-trivial feature spanning multiple files, ambiguous scope, or larger functionality. Do NOT trigger for bug fixes, quick one-line changes, or config-only changes."
model: opus
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Agent, AskUserQuestion, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, Bash(git *)
argument-hint: "<feature description>"
---

# Write

Multi-agent feature implementation. The main agent researches the codebase and produces a briefing, then spawns a builder and critic in parallel — the builder writes the code while the critic preps. Both can pause to surface decisions. The critic applies its prep to the finished code.

## Announce

> Daemon `code:write` online. Starting pipeline.

## Progress tracking

Create a task at the start and update at each milestone:

1. "Researching..."
2. "Spawning team..."
3. "Implementing..."
4. "Reviewing..."
5. "Done"

## Agent Frontmatter

This skill bundles co-located agent definitions in two directories:
- **`${CLAUDE_SKILL_DIR}/team/`** — team agents spawned via TeamCreate with persistent identity (builder, critic)
- **`${CLAUDE_SKILL_DIR}/agents/`** — utility agents spawned as disposable subagents (recon)

Each `.md` file uses standard Claude Code agent frontmatter — the same schema as files in `.claude/agents/` — but since they live inside the skill directory, Claude Code does not auto-discover or enforce them. The skill must parse and honor the frontmatter explicitly.

When spawning a co-located agent:
1. **Read** the `.md` file from `team/` or `agents/`
2. **Parse** the YAML frontmatter (between `---` delimiters) and extract:
   - `model` → pass to the Agent tool's `model` parameter
   - `tools` → informational; enforced via `subagent_type` (see below)
   - `name` → use as the Agent tool's `name` parameter
   - `description` → use as the Agent tool's `description` parameter
3. **Extract** the markdown body (everything below the closing `---`) and use it as the agent's system prompt
4. **Spawn** with the appropriate `subagent_type`: `"general-purpose"` for team agents that need write access (builder, critic), `"Explore"` for read-only utility agents (recon)

| Field | Used | Purpose |
|-------|------|---------|
| `name` | Agent tool `name` | Identifies the agent in logs and UI |
| `description` | Agent tool `description` | Short summary of the agent's focus |
| `tools` | Informational | Documents intended tool access; enforced by subagent type |
| `model` | Agent tool `model` | Controls which model the agent runs on |

## Steps

### Step 1 — Research

If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask what to implement before proceeding.

Research the codebase inline before spawning anyone. This produces the briefing that both teammates will rely on — don't skip it.

**Understand the project:**
- Read CLAUDE.md, README, and the project manifest (package.json, pyproject.toml, Cargo.toml, etc.)
- Note the stack, conventions, any project-specific rules

**Discover project guidelines:**

Available guides:
!`ls .claude/guides/ 2>/dev/null || echo "(none)"`

If guides are listed above, read each one. Include any that are relevant to the implementation in the briefing — error handling conventions, API design rules, testing requirements, etc. Pass them to both the builder and critic as additional context.

**Find the relevant code:**
- Use Grep and Glob to locate files and modules the task will touch
- Read the files where new code will integrate — understand interfaces, data shapes, call patterns
- Look for existing utilities or abstractions the implementation should reuse rather than reinvent

**Discover the quality toolchain:**
- Find the test directory, read 2-3 test files for framework and style
- Record exact commands: test runner, linter, formatter, type checker
- Check CI config if present

**Produce a briefing** (you'll embed this in both teammate prompts):

```
Task: [one sentence]

Files to touch:
- path/to/file — [create/modify, why]

Patterns to follow:
- [pattern]: found in path/to/example.ts — [description]

Existing utilities to reuse:
- [utility]: path/to/util.ts exports [name] — use instead of writing new

Test conventions:
- Framework: [name], style: [description]
- Run: [exact command]

Quality toolchain:
- [exact command] — [what it checks]

Constraints:
- [constraint and source]

Ambiguities:
- [genuine gaps that could cause wrong implementation]

Guidelines:
- [relevant project guidelines from .claude/guides/, if any]
```

### Step 2 — Clarify

From the research, identify forks where two reasonable approaches lead to meaningfully different code. Only ask when the wrong choice means a significant rewrite — not style or naming.

For strong defaults supported by codebase evidence, adopt silently and note the decision. For genuine forks, use `AskUserQuestion` with concrete choices before spawning the team.

### Step 3 — Spawn the team

```
TeamCreate({ team_name: "write-<short-feature-name>", description: "Implementing <feature>" })
```

**Spawn both teammates in a single message** (per knowledge:teams — keystroke corruption risk if split across turns). Tell the user not to type until both confirm spawned.

Read `team/builder.md`, `team/critic.md`, and `agents/recon.md`, parse frontmatter, then spawn both:

**Builder** receives:
- The task
- The full briefing from Step 1
- Working directory
- The recon prompt and model (body and `model` from `agents/recon.md` frontmatter, embedded so the builder can spawn recon without reading the file itself)

**Critic** receives:
- The task
- The full briefing from Step 1
- Working directory
- The recon prompt and model (same as above)
- This instruction: *"You are in PREP phase. Do your prep work now — spec analysis, codebase research, spec-based tests. When I send you the implementation, switch to REVIEW phase."*

### Step 4 — Run the pipeline

Both teammates are now active. The builder is writing code; the critic is prepping. You are the coordinator.

#### Handling pause messages

Either teammate may send a PAUSE message. When one arrives:

1. Read it carefully — it includes what's done, the specific question, and a recommended default
2. If it's answerable from the briefing or codebase context: answer directly and tell the agent to continue
3. If it requires a product or architectural decision: use `AskUserQuestion`, then relay the answer
4. If the pause seems unnecessary (style, something the codebase already answers): reply with `"Follow the existing pattern in <file>. Continue."`

Keep going until the builder sends COMPLETE.

#### When the builder sends COMPLETE

Relay the implementation to the critic:

```
SendMessage({
  to: "critic",
  message: "Implementation complete. Switching you to REVIEW phase.\n\nChanged files:\n<list from builder's report>\n\nBuilder notes:\n<notes from builder's report>\n\nApply your prep work to the actual code."
})
```

Continue handling any pause messages from the critic until it sends COMPLETE.

### Step 5 — Revise (max 2 rounds)

If the critic's report contains BLOCKING items, send them to the builder:

```
SendMessage({
  to: "builder",
  message: "Revision needed. BLOCKING issues:\n<list>\nFix these and report back."
})
```

When the builder sends COMPLETE again, spawn a **fresh critic** — read `team/critic.md` again and spawn a new teammate with the same briefing. A fresh critic applies genuinely fresh eyes to the revision.

After round 2, or when no BLOCKING issues remain, proceed.

### Step 6 — Cleanup and report

Shut down the team:
1. Send `shutdown_request` to all active teammates, wait for confirmations
2. `TeamDelete({ team_name: "..." })`
3. If TeamDelete fails, force-clean per `knowledge:teams` skill

Present a summary:

```
**Implemented:** <what was built — 1-2 sentences>
**Files changed:** <list>
**Decisions made:** <silent decisions from Step 2>
**SHOULD:** <critic's strong recommendations — user can action or defer>
**CONSIDER:** <critic's advisory notes>
```

## Edge cases

If the user asks to skip the review ("just implement it, no review needed"), spawn only the builder — no critic, no revision rounds. Still do the research and briefing.

If the user asks to skip tests ("don't worry about tests"), tell the builder to skip test writing but still run the quality toolchain. Note the skip in the final summary.

If the user provides additional context ("this is performance-critical" or "this needs to be backwards-compatible"), include it in the briefing as a constraint so both teammates see it.
