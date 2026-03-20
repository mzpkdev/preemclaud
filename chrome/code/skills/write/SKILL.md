---
description: "Write the code for a feature  //  Trigger whenever a user asks to implement, build, or add functionality that touches more than a single function: 'implement X', 'build X', 'add X feature', 'write the code for X'. Use for any non-trivial feature spanning multiple files, ambiguous scope, or larger functionality. Do NOT trigger for bug fixes, quick one-line changes, or config-only changes."
model: opus
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Agent, AskUserQuestion, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, Bash(git *)
argument-hint: "<feature description>"
---

# Write

Multi-agent feature implementation with real-time peer verification. The lead researches and briefs, then spawns a builder and critic who work together directly — the builder writes code and sends checkpoints, the critic verifies each one and sends feedback. They communicate with each other, not through the lead. The lead only handles escalated decisions.

## Announce

> Daemon `code:write` online. Starting pipeline.

## Progress tracking

Create a parent task at the start:

```
TaskCreate({ description: "code:write — <feature summary>", status: "in_progress" })
```

Update at each pipeline milestone:

```
TaskUpdate({ task_id: "<id>", status: "in_progress", description: "code:write — Researching…" })
```

Pipeline milestones: "Researching…" → "Spawning team…" → "Implementing…" → "Done" (set `status: "completed"` on the last one).

### Plan-aware tracking

When `$ARGUMENTS` points to a plan file, also create a subtask for each numbered task in the plan's index:

```
TaskCreate({ description: "Plan task 1 — <name from index>", status: "pending", parent_task_id: "<parent id>" })
TaskCreate({ description: "Plan task 2 — <name from index>", status: "pending", parent_task_id: "<parent id>" })
...
```

Update subtasks as the builder reports `TASK <N> STARTED` / `TASK <N> DONE` messages (see Step 4).

## Agent definitions (injected at load time)

### team/builder.md
!`cat ${CLAUDE_SKILL_DIR}/team/builder.md`

### team/critic.md
!`cat ${CLAUDE_SKILL_DIR}/team/critic.md`

### agents/recon.md
!`cat ${CLAUDE_SKILL_DIR}/agents/recon.md`

When spawning an agent, extract its YAML frontmatter (`name`, `description`, `model`) for the Agent tool parameters and use the markdown body as the system prompt. Spawn `team/` agents as `general-purpose`; spawn `agents/` agents as `Explore`.

## Communication protocol

Builder and critic talk directly via `SendMessage`. The lead stays out unless someone escalates.

**Builder → Critic:**
- `CHECKPOINT` — finished a unit of work, verify it (includes changed files and summary)
- `DONE` — finished all building, do your final pass

**Critic → Builder:**
- `FIX NOW` — foundational issue that will compound; stop and fix before continuing
- `FIX LATER` — contained issue; queue for next natural break
- `LGTM` — checkpoint verified, keep going
- `VERIFIED` — final pass complete, code is good

**Either → Lead (escalation only):**
- `ESCALATE` — need a decision that requires human judgment or product context

**Builder → Lead:**
- `TASK <N> STARTED/DONE` — plan progress updates
- `COMPLETE` — all done, critic has verified

**Critic → Lead:**
- `VERIFIED` — final sign-off, code is clean
- `BLOCKING` — final pass found unresolved issues

## Steps

<!-- ultrathink -->

### Step 1 — Research

If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask what to implement before proceeding.

#### Detect plan input

If `$ARGUMENTS` is a path to a `.claude/plans/*.md` file (or the user says "implement plan X"), read the plan file. The plan already contains file paths, task breakdown, patterns, and verification commands — use it as a head start, not a replacement for research.

- Extract the **task index** (numbered tasks with names, dependencies, and file counts) — you'll use this for plan-aware progress tracking and for the builder's execution order.
- Extract file paths, patterns, and quality toolchain commands to seed the briefing below.
- Still do the research — the plan may be stale or missing runtime details (new files since the plan was written, updated dependencies). Verify that the plan's file paths and interfaces still match reality.

#### Codebase research

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

Use the injected agent definitions above — extract frontmatter for Agent tool parameters, use the markdown body as the system prompt.

**Builder** receives:
- The task description
- The full briefing from Step 1
- Working directory
- The recon file path: `${CLAUDE_SKILL_DIR}/agents/recon.md`
- The critic's teammate name (so it can `SendMessage` directly)
- If working from a plan: the plan's task index with execution order, and the instruction to report `TASK <N> STARTED` / `TASK <N> DONE` to the lead before and after each numbered task

**Critic** receives:
- The task description
- The full briefing from Step 1
- Working directory
- The recon file path (same as above)
- The builder's teammate name (so it can `SendMessage` directly)
- The quality toolchain commands extracted from the briefing
- This instruction: *"Start by studying the briefing and plan. Build your verification checklist — expected patterns, utilities that should be reused, interface contracts, spec requirements. The builder will send you CHECKPOINTs as it works. Verify each one."*

### Step 4 — Monitor

Both teammates are now working together. The builder sends checkpoints to the critic, the critic verifies and sends feedback to the builder. They handle their own loop.

**Your only job is to handle escalations and track progress.**

#### Handling ESCALATE messages

When either teammate sends an ESCALATE:

1. Read it — it includes context, the specific question, and impact analysis
2. If answerable from the briefing or codebase: answer directly and tell the agent to continue
3. If it requires a product or architectural decision: use `AskUserQuestion`, then relay the answer to the agent that asked

#### Handling plan task updates

When the builder sends `TASK <N> STARTED` or `TASK <N> DONE`, update the corresponding subtask:

```
TaskUpdate({ task_id: "<subtask id for task N>", status: "in_progress" })  // on STARTED
TaskUpdate({ task_id: "<subtask id for task N>", status: "completed" })    // on DONE
```

Also update the parent task description:

```
TaskUpdate({ task_id: "<parent id>", description: "code:write — Implementing task <N>: <name>" })
```

#### Do NOT relay

Do not pass messages between builder and critic — they talk directly. Do not interrupt their work unless they escalate. Do not send status checks unless an agent has been silent for an unusually long time.

### Step 5 — Collect completion

The pipeline ends when both signals arrive:
1. Builder sends `COMPLETE` — done building, all FIX NOWs resolved, quality toolchain passes
2. Critic sends `VERIFIED` — final pass confirms the code is clean

If the critic sends `BLOCKING` instead of `VERIFIED`:
- Read the issues carefully
- If they're clearly valid: send them to the builder with instructions to fix, then wait for another COMPLETE/VERIFIED cycle
- If ambiguous: use `AskUserQuestion` to let the user decide

Maximum 2 rounds of BLOCKING. After that, present remaining issues to the user and let them decide.

### Step 6 — Cleanup and report

Shut down the team:
1. Send `shutdown_request` to all active teammates, wait for confirmations
2. `TeamDelete({ team_name: "..." })`
3. If TeamDelete fails, force-clean per `knowledge:teams` skill

Present a summary:

```
**Implemented:** <what was built — 1-2 sentences>
**Files changed:** <list>
**Decisions made:** <silent decisions from Step 2 + any escalation resolutions>
**Deferred:** <FIX LATER items the critic flagged, if any — user can action or ignore>
```

## Edge cases

If the user asks to skip the review ("just implement it, no review needed"), spawn only the builder — no critic, no verification loop. Still do the research and briefing.

If the user asks to skip tests ("don't worry about tests"), tell the builder to skip test writing but still run the quality toolchain. Note the skip in the final summary.

If the user provides additional context ("this is performance-critical" or "this needs to be backwards-compatible"), include it in the briefing as a constraint so both teammates see it.
