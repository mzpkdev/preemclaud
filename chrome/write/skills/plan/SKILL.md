---
description: Create a detailed implementation plan before writing code. Use this skill whenever the user has a spec, requirements, feature request, or multi-step task and wants to plan the approach before jumping into code. Trigger on phrases like 'plan this out', 'write a plan', 'implementation plan', 'break this down into tasks', 'how should we implement', 'let me think through the implementation', '/plan', or any time the user shares requirements/specs and the next step is clearly to figure out how to build it — not to start building it. Also trigger when the user says things like 'I have a spec' or 'here are the requirements' and hasn't asked to start coding yet.
user-invocable: true
disable-model-invocation: false
---

# Write Plan

Create a detailed, step-by-step implementation plan for the user's task. Plans should be thorough enough that each step is unambiguous, but not so rigid that they can't adapt to what the engineer discovers along the way.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `write:plan` online. Breaking down the work.

## Output

Write the plan to the project's `.claude/plans/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern (e.g., `sleepy-axolotl.md`, `cosmic-teapot.md`).

## Steps

### Step 1 — Research

Don't plan blind. Before writing any tasks, build a working understanding of the relevant parts of the codebase. This isn't optional — a plan written without research will miss conventions, duplicate existing abstractions, and create integration pain.

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
- Record the exact commands to run each check — these are referenced by every work unit's verification step.

#### Track gaps
Note any ambiguities, missing context, or assumptions you had to make. These feed into the next step (Clarify) and into the plan's caveats bullet list.

### Step 2 — Clarify

Dispatch a clarifier subagent to find implementation-strategy forks — places where two or more reasonable approaches exist and the choice would change the plan's structure.

1. Spawn a general-purpose subagent with the clarifier prompt (see `agents/clarifier.md`)
   - Provide: the spec/requirements and the project directory
2. Review the returned questions. Drop any that are purely stylistic or already resolved by codebase evidence.
3. Use `AskUserQuestion` to ask the user the remaining questions. Prefer multiple choice — present the options the clarifier identified.
   - Cap at ~3 questions. This is planning, not an interview.
4. If the clarifier returns "No ambiguities found," proceed to the next step.

### Step 3 — Scope check

If the spec covers multiple independent subsystems, suggest breaking it into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

### Step 4 — Write the plan

Use `EnterPlanMode` to present the plan for user approval before finalizing. Produce the plan following the **## Template** section below.

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

Each work unit's `Verify:` line should run **every relevant quality check**, not just the test suite. The principle: if the implementer follows your plan and opens a PR, what checks will CI run? The plan's verification steps should catch the same things locally so there are no surprises.

#### Key rules
- **Exact file paths** — always. No "in the appropriate directory."
- **Complete code** — if a step involves writing code, include the code. Not "add error handling" but the actual error handling code.
- **Exact commands with expected output** — so the engineer can verify without guessing.
- **File markers** — `C` for create, `M` for modify, `D` for delete, `R` for rename. Same convention as the git skills.
- **Indented `[ ]` checkboxes** on every step, aligned with the file list.
- **Verify line** on every work unit — the exact commands to confirm the unit is done.
- **DRY, YAGNI** — don't plan features that aren't in the spec. Don't duplicate logic across tasks.
- **Frequent commits** — each task ends with a commit. Working software at every checkpoint.

### Step 5 — Review

After completing each chunk of the plan, dispatch a reviewer subagent if subagents are available:

1. Spawn a general-purpose subagent with the reviewer prompt (see `agents/reviewer.md`)
   - Provide: the chunk content and the path to the spec/requirements
2. If issues found: fix them, re-dispatch the reviewer, repeat until approved
3. If approved: proceed to next chunk

**Chunking for review:** For large plans, review in chunks of work units (e.g., units 1-3, then 4-6). Each chunk should be logically self-contained and under 1000 lines. The plan document itself uses the template structure — chunks are only a review-process concept.

If subagents aren't available, do a self-review pass checking for: TODOs/placeholders, incomplete steps, missing verification, spec gaps, dependency ordering issues, and parallelization opportunities.

If the review loop exceeds 3 iterations on the same chunk, surface it to the user for guidance rather than spinning.

### Step 6 — Save

Once the user approves, use `ExitPlanMode` and write the plan to a file per the [output](#output) convention. After saving, tell the user where it landed and give a brief overview:

**"Plan saved to `.claude/plans/<codename>.md`."**

Then output a summary using this exact template:

```
**Approach:** <1-2 sentences on the high-level strategy>

**Decisions:**
- <decision and why — one line each, skip if none>

**Questions:**
- <ambiguity, missing context, or assumption that needs user input — one line each, or "None" if fully resolved>

**Scope:** <N tasks, ~M files touched>
```

This lets the user quickly assess the direction without opening the file. Keep each section punchy — details live in the plan.

Keep plans concise and actionable. Don't over-plan — just enough to say "yes, do that" or to dispatch work units to subagents.

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> structure: dashboard header, summary, index, and work units with
> file markers + indented checkboxes + Verify line. Do NOT improvise
> formats or collapse sections into prose. The only acceptable
> omission is the caveats bullet list when there are none.

## Safety

> [!IMPORTANT]
> This skill creates plan files only. Do not modify source code,
> tests, or configuration unless the user explicitly asks to start
> implementing.
