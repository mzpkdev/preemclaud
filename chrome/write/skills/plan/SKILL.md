---
description: "Plan the implementation before writing code  //  Trigger when the user wants a step-by-step implementation plan as a written deliverable before touching any code — explicit signals: 'plan this out', 'make an implementation plan', 'before we start coding', 'what order should we tackle this', 'scope this out', or the slash command `write:plan`. Also trigger for migrations, major refactors, and multi-file integrations where the user wants scope and sequence mapped upfront. Do NOT trigger for direct implementation requests ('add X', 'implement Y'), code explanations, debugging, or architecture/tradeoff questions."
argument-hint: "[spec, feature description, or requirements brief]"
model: claude-opus-4-6
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, Write, Skill
---

# Write Plan

Create a detailed, step-by-step implementation plan for the user's task. Plans should be thorough enough that each step is unambiguous, but not so rigid that they can't adapt to what the engineer discovers along the way.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `write:plan` online. Breaking down the work.

## Output

Write the plan to the project's `.claude/plans/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern (e.g., `sleepy-axolotl.md`, `cosmic-teapot.md`).

## Agent Frontmatter

This skill bundles co-located agent definitions in `${CLAUDE_SKILL_DIR}/agents/`.
Each `.md` file uses standard Claude Code agent frontmatter — the same schema as files in `.claude/agents/` — but since they live inside the skill directory, Claude Code does not auto-discover or enforce them. The skill must parse and honor the frontmatter explicitly.

When spawning a co-located agent:
1. **Read** the `.md` file from `${CLAUDE_SKILL_DIR}/agents/`
2. **Parse** the YAML frontmatter (between `---` delimiters) and extract:
   - `model` → pass to the Agent tool's `model` parameter
   - `tools` → informational; enforced via `subagent_type` (see below)
   - `name` → use as the Agent tool's `name` parameter
   - `description` → use as the Agent tool's `description` parameter
3. **Extract** the markdown body (everything below the closing `---`) and use it as the agent's system prompt
4. **Spawn** with `subagent_type: "Explore"` to restrict available tools to the read-only set (Read, Grep, Glob, Bash), matching the `tools` declared in frontmatter

| Field | Used | Purpose |
|-------|------|---------|
| `name` | Agent tool `name` | Identifies the agent in logs and UI |
| `description` | Agent tool `description` | Short summary of the agent's focus |
| `tools` | Informational | Documents intended tool access; enforced by `Explore` subagent type |
| `model` | Agent tool `model` | Controls which model the agent runs on |

## Steps

### Step 1 — Research

Don't plan blind. Before writing any tasks, build a working understanding of the relevant parts of the codebase. This isn't optional — a plan written without research will miss conventions, duplicate existing abstractions, and create integration pain.

If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask the user what they'd like to plan before proceeding.

#### Understand the requirements
Read the spec or requirements carefully. Identify every functional requirement, constraint, and acceptance criterion. If an upstream spec or brief exists, read it — you'll reference its codename in the plan's `From:` field.

#### Understand the project
- Read CLAUDE.md, README, and the project manifest (package.json, pyproject.toml, Cargo.toml, etc.) to understand the stack, conventions, and any project-specific rules.
- Scan the directory structure to understand how the codebase is organized — where things live, what the naming conventions are.

#### Explore the relevant code
- Use Explore agents or targeted Glob/Grep to find the files and modules related to the spec. Don't just guess where things are — look.
- Read the actual files where new code will integrate with existing code. Understand the interfaces, data flow, and patterns already in use.
- Look for existing abstractions that the new code should reuse rather than duplicate.

#### Discover the quality toolchain
- Find the test directory and read a few representative test files to learn the framework, style, and assertion patterns.
- Discover all quality checks beyond tests — linters, formatters, type checkers, static analysis. Check project manifests for scripts, config files, pre-commit hooks, and CI workflows.
- Record the exact commands to run each check — these are referenced by every task's verification step.

#### Track gaps
Note any ambiguities, missing context, or assumptions you had to make. These feed into the next step (Clarify) and into the plan's caveats bullet list.

### Step 2 — Clarify

Read `${CLAUDE_SKILL_DIR}/agents/clarifier.md` and spawn following the **Agent Frontmatter** protocol above to find implementation-strategy forks — places where two or more reasonable approaches exist and the choice would change the plan's structure.

1. Spawn with `subagent_type: "Explore"` — the clarifier is read-only
   - Provide: the spec/requirements, the project directory, and your Step 1 research findings (discovered patterns, conventions, quality toolchain, gaps)
2. Review the returned questions. Drop any that are purely stylistic or already resolved by codebase evidence.
3. **Handle strong defaults**: if a question's `Default:` is well-supported by codebase evidence, adopt it silently and record the decision in the plan's Decisions field — don't ask the user about choices that are already obvious.
4. Use `AskUserQuestion` to ask the user the remaining questions. Prefer multiple choice — present the options the clarifier identified:
   ```
   AskUserQuestion(
     question: "Where should the cache live?",
     choices: ["A) In-process memory (simpler, already used in auth module)", "B) Redis (needed if we add worker processes later)"]
   )
   ```
5. If the clarifier returns "No ambiguities found," proceed to the next step.

### Step 3 — Scope check

If the spec covers multiple independent subsystems, suggest breaking it into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

<!-- ultrathink -->
### Step 4 — Write the plan

Produce the plan following the **## Template** section below.

#### Task granularity

Each step should be a single, concrete action — something that takes a few minutes and has a clear "done" state.

Good steps:
- "Write the failing test for X"
- "Run the test suite to confirm it fails"
- "Implement the minimal code to make the test pass"
- "Run tests and confirm they pass"
- "Commit"

Bad steps:
- "Add validation" (vague — what validation? where? what are the rules?)
- "Set up the module" (too broad — what files? what interfaces?)

The right granularity depends on the task's complexity. Simple CRUD operations don't need the same level of hand-holding as a tricky algorithmic change. Use your judgment, but err toward more detail when in doubt.

#### Testing strategy

Adapt the testing approach to what makes sense for the task and the project:

**Test-first (TDD)** — Use when:
- The behavior is well-defined upfront (clear inputs → expected outputs)
- You're building business logic, data transformations, or algorithms
- The project already practices TDD

**Test-after** — Use when:
- The task is exploratory or the interface isn't settled yet
- You're doing UI work, integrations, or prototyping
- Writing the test first would require mocking everything and test nothing real

**No automated tests** — Use when:
- The task is pure configuration, documentation, or static assets
- The project has no test infrastructure and adding it isn't in scope

Whatever the approach, always include a verification step — even if it's "run the app and confirm X works manually." Every task should have a way to know it's done correctly.

#### Verification beyond tests

Each task's `Verify:` line should run **every relevant quality check**, not just the test suite. The principle: if the implementer follows your plan and opens a PR, what checks will CI run? The plan's verification steps should catch the same things locally so there are no surprises.

#### Key rules
- **Exact file paths** — always. No "in the appropriate directory."
- **Complete code** — if a step involves writing code, include the code. Not "add error handling" but the actual error handling code.
- **Exact commands with expected output** — so the engineer can verify without guessing.
- **File markers** — `C` for create, `M` for modify, `D` for delete, `R` for rename. Same convention as the git skills.
- **Indented `[ ]` checkboxes** on every step, aligned with the file list.
- **Verify line** on every task — the exact commands to confirm the task is done.
- **DRY, YAGNI** — don't plan features that aren't in the spec. Don't duplicate logic across tasks.
- **Frequent commits** — each task ends with a commit. Working software at every checkpoint.

### Step 5 — Review

Before saving, do a quick self-review pass:
- No TODOs, placeholders, or incomplete steps
- Every task has a Verify line with exact commands
- Steps include actual code, not vague descriptions
- Dependency ordering is correct — no circular or implicit dependencies
- Spec requirements are fully covered, no scope creep

### Step 6 — Save and present

#### 6a. Save draft

Use `Glob` to list `.claude/plans/*.md` and check that the chosen codename doesn't already exist — pick a different one if it does. Write the plan file to disk per the [output](#output) convention. This happens **before** Plan Mode so the file exists on disk regardless of what happens next.

#### 6b. Present for approval

Use `EnterPlanMode` to present the plan for user review. If the user requests changes, compose revisions and re-present within Plan Mode.

When the user approves, print the implementation command before exiting:

> **To implement:** `/code:write .claude/plans/<codename>.md`

Then use `ExitPlanMode`.

#### 6c. Finalize

If revisions were made during Plan Mode, update the file on disk with the final version.

Tell the user where the plan landed and give a brief overview:

**"Plan saved to `.claude/plans/<codename>.md`."**

```
**Approach:** <1-2 sentences on the high-level strategy>

**Decisions:**
- <decision and why — one line each, skip if none>

**Questions:**
- <ambiguity, missing context, or assumption that needs user input — one line each, or "None" if fully resolved>

**Scope:** <N tasks, ~M files touched>
```

This lets the user quickly assess the direction without opening the file. Keep each section punchy — details live in the plan.

#### 6d. Handoff

```
AskUserQuestion({
  question: "Implement now?",
  choices: ["Yes — run code:write with this plan", "No — I'll review first"]
})
```

If yes:

```
Skill({ name: "code:write", arguments: ".claude/plans/<codename>.md" })
```

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> structure: dashboard header, summary, index, and tasks with
> file markers + indented checkboxes + Verify line. Do NOT improvise
> formats or collapse sections into prose. The only acceptable
> omission is the caveats bullet list when there are none.

## Safety

> [!IMPORTANT]
> This skill creates plan files only. Do not modify source code,
> tests, or configuration unless the user explicitly asks to start
> implementing.
