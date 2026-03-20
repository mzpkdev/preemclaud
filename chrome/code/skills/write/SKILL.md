---
description: "Write the code for a feature  //  Trigger whenever a user asks to implement, build, or add functionality that touches more than a single function: 'implement X', 'build X', 'add X feature', 'write the code for X'. Use for any non-trivial feature spanning multiple files, ambiguous scope, or larger functionality. Do NOT trigger for bug fixes, quick one-line changes, or config-only changes."
model: opus
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Agent, AskUserQuestion, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, Bash(git *)
argument-hint: "<feature description>"
---

# Write

Multi-agent feature implementation with adversarial test-driven verification. The lead researches and briefs, then spawns a builder and test-writer with differentiated briefs — the builder gets the full plan and code guidance, the test-writer gets only the spec and approach summary. The information asymmetry forces independent spec interpretation. The test-writer writes adversarial behavioral tests, the builder implements code to pass them. They communicate directly; the lead handles dispute arbitration only.

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

### team/test-writer.md
!`cat ${CLAUDE_SKILL_DIR}/team/test-writer.md`

When spawning an agent, extract its YAML frontmatter (`name`, `description`, `model`) for the Agent tool parameters and use the markdown body as the system prompt.

## Communication protocol

Builder and test-writer talk directly via `SendMessage`. The lead stays out unless someone escalates or disputes.

**Test-writer → Builder:**
- `TESTS READY` — initial adversarial tests written from spec (test file paths, requirement mapping, edge cases)
- `NEW TESTS` — additional tests written after a checkpoint (new test files, what triggered them)
- `TESTS FINAL` — final pass complete (all test files, spec coverage, new tests if any, run command)

**Builder → Test-writer:**
- `CHECKPOINT` — finished a unit of work (files changed, public API exposed, test results)
- `DONE` — finished all building (all files, full public API, test results, quality checks)

**Builder → Lead:**
- `TASK <N> STARTED/DONE` — plan progress updates
- `COMPLETE` — all done, all tests pass, quality toolchain passes
- `DISPUTE` — believes a test encodes an implementation assumption, not a spec requirement

**Test-writer → Lead:**
- `DISPUTE RESPONSE` — rationale for a disputed test (when asked by lead)

**Either → Lead (escalation only):**
- `ESCALATE` — need a decision that requires human judgment or product context

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

Research the codebase inline before spawning anyone. This produces the briefing that the builder will rely on — don't skip it.

**Understand the project:**
- Read CLAUDE.md, README, and the project manifest (package.json, pyproject.toml, Cargo.toml, etc.)
- Note the stack, conventions, any project-specific rules

**Discover project guidelines:**

Available guides:
!`ls .claude/guides/ 2>/dev/null || echo "(none)"`

If guides are listed above, read each one. Include any that are relevant to the implementation in the briefing — error handling conventions, API design rules, testing requirements, etc. Pass them to the builder as additional context.

**Find the relevant code:**
- Use Grep and Glob to locate files and modules the task will touch
- Read the files where new code will integrate — understand interfaces, data shapes, call patterns
- Look for existing utilities or abstractions the implementation should reuse rather than reinvent

**Discover the quality toolchain:**
- Find the test directory, read 2-3 test files for framework and style
- Record exact commands: test runner, linter, formatter, type checker
- Check CI config if present

**Produce a briefing** (this goes to the builder):

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

#### Extract spec requirements for test-writer

From the spec/requirements and your research, produce a separate brief for the test-writer. This is the WHAT and WHY — no HOW.

```
Spec requirements (numbered):
- R1: [discrete behavioral requirement from the spec]
- R2: [discrete behavioral requirement]
- R3: [discrete behavioral requirement]
...

Approach summary (boundary only):
- [high-level boundary description, e.g. "new SearchView component in shared/views/"]
- [public API surface it will expose, e.g. "exported function processQuery(...)"]
- [integration point, e.g. "consumed by existing Router in app/routes.ts"]

Acceptance criteria:
- [observable behavior that must be true when done]
- [observable behavior that must be true when done]
```

**The test-writer must NOT receive:** plan task breakdown, code guidance, patterns to follow, file-level implementation details, specific internal architecture decisions. The information asymmetry is the mechanism — if the test-writer knows the plan, their tests validate plan compliance instead of spec compliance.

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
- The full briefing from Step 1 (patterns, utilities, code guidance)
- Working directory
- The test-writer's teammate name (so it can `SendMessage` directly)
- If working from a plan: the plan's task index with execution order, and the instruction to report `TASK <N> STARTED` / `TASK <N> DONE` to the lead before and after each numbered task
- Instruction: implement the feature and make the test-writer's adversarial tests pass

**Test-writer** receives:
- The spec requirements (numbered R1, R2, R3, ...)
- The approach summary (boundary-level only)
- Test framework, conventions, directory structure, existing test patterns from the briefing
- Quality toolchain commands from the briefing
- The builder's teammate name (so it can `SendMessage` directly)
- Working directory
- Instruction: write adversarial behavioral contract tests from the spec, then verify via checkpoints

**Test-writer must NOT receive:**
- Plan task breakdown or execution order
- Code guidance or patterns to follow
- File-level implementation details
- Specific internal architecture decisions from the plan

### Step 4 — Monitor

Both teammates are now working together. The test-writer writes adversarial tests from the spec, the builder implements code to pass them. They handle their own loop.

**Your only job is to handle disputes, escalations, and track progress.**

#### Handling DISPUTE messages

When the builder sends a DISPUTE:

1. Ask the test-writer for a DISPUTE RESPONSE:

```
SendMessage({
  to: "<test-writer-name>",
  message: "DISPUTE from builder.\n\nTest: <test name>\nBuilder's claim: <summary of builder's argument>\n\nPlease send your DISPUTE RESPONSE with the spec basis for this test."
})
```

2. Read both arguments
3. Arbitrate based on the spec:
   - **Spec requires the behavior** → builder must fix code
   - **Test encodes an implementation assumption** → test-writer must update test
   - **Spec is genuinely ambiguous** → escalate to user with `AskUserQuestion`

Cap: 3 disputes per session. After 3, batch remaining disputes and present them all to the user at once.

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

Do not pass messages between builder and test-writer — they talk directly. Do not interrupt their work unless they escalate or dispute. Do not send status checks unless an agent has been silent for an unusually long time.

### Step 5 — Collect completion

The pipeline ends when the builder sends `COMPLETE` — all tests pass, quality toolchain passes, no pending disputes.

If there are unresolved disputes at COMPLETE: arbitrate them (using the dispute protocol above), then wait for another COMPLETE from the builder after fixes.

Maximum 2 post-COMPLETE rounds. After that, present remaining issues to the user and let them decide.

### Step 6 — Cleanup and report

Shut down the team:
1. Send `shutdown_request` to all active teammates, wait for confirmations
2. `TeamDelete({ team_name: "..." })`
3. If TeamDelete fails, force-clean per `knowledge:teams` skill

Present a summary:

```
**Implemented:** <what was built — 1-2 sentences>
**Files changed:** <list>
**Test coverage:** <N contract tests for R1-R<M>>
**Test files:** <list of test files>
**Decisions made:** <silent decisions from Step 2 + any escalation resolutions>
**Disputes resolved:** <dispute rulings, if any>
```

## Edge cases

If the user asks to skip review/tests ("just implement it, no review needed"), spawn only the builder — no test-writer, no verification loop. Still do the research and briefing.

If the user asks to skip tests ("don't worry about tests"), tell the builder to skip test writing but still run the quality toolchain. Note the skip in the final summary.

If the task is a pure refactoring with no new behavior, the test-writer focuses on regression tests — verifying that existing behavior is preserved, not testing new features.

If the task has no testable public API (e.g., config changes, internal refactoring with no observable boundary), skip the test-writer and spawn only the builder.

If the user provides additional context ("this is performance-critical" or "this needs to be backwards-compatible"), include it in the briefing as a constraint so the builder sees it, and in the spec requirements so the test-writer tests for it.
