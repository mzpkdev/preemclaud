______________________________________________________________________

## description: "Split a feature into assignable work packages" user-invocable: true disable-model-invocation: false

# Write Brief

Decompose a spec or feature idea into standalone tasks — each with enough context that any developer (human or AI) can
pick one up and start working without reading the original spec or asking for background.

The spec skill closes scope. The plan skill fills in implementation detail. This skill sits between them: it takes a
scoped idea and breaks it into independent work units, each carrying the full context needed to act on it.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work
begins.

> Daemon `write:brief` online. Breaking this into pieces.

## Output

Write the brief to the project's `.claude/briefs/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern
(e.g., `rusty-compass.md`, `quiet-lantern.md`).

## Steps

### Step 1 — Understand input

Read the spec if one is provided. If the input is a conversation or a vague idea instead of a spec, capture the goal,
scope, and constraints from what's available. Note what's missing — the clarifying questions in Step 3 will fill those
gaps.

If a spec exists, don't just reference it — internalize it. The tasks you produce must carry the spec's context forward
so the spec itself becomes optional reading.

### Step 2 — Research

Explore the codebase to understand what exists and where new work will land.

- Read CLAUDE.md, README, project manifest to understand the stack and conventions
- Find existing code related to the feature — patterns, abstractions, interfaces
- Check the testing setup
- Look for integration points where new work meets existing code

This research informs how you decompose — where the natural boundaries are, what already exists, what patterns the
implementer should follow. Reference relevant modules and components by name in the tasks, but don't dump implementation
details like line numbers, code snippets, or before/after diffs into them.

### Step 3 — Ask clarifying questions

Use `AskUserQuestion` to ask questions that maximize the context in each task. One at a time.

These aren't questions about *what* to build (that's the spec's job) — they're about *how to break the work down* and
*what context to include* so each task stands alone.

Focus on:

- What background would someone unfamiliar need to start working on a piece of this?
- Are there parts that are riskier or more uncertain and should be isolated?
- What can be worked on in parallel vs. what's sequential?
- Are there existing patterns or conventions the implementer should follow?
- What does "done" look like for each piece?

Prefer multiple choice when possible. Let the user's answers guide the next question.

### Step 4 — Decompose

Use `EnterPlanMode` to present the proposed breakdown for user approval. Identify natural boundaries for independent
work units — task names, one-line descriptions, dependencies, and which can be parallelized.

Good boundaries:

- Different subsystems or layers
- Independent features that don't share state
- Setup/infrastructure vs. business logic
- Data model vs. API vs. UI

Each task should produce a working, testable increment. If two tasks can't be verified independently, they should
probably be one task.

### Step 5 — Write tasks

Once the user approves the breakdown, use `ExitPlanMode` and produce the brief following the **## Template** section
below.

**Description is the most important part of each task.** It's the plain text immediately after the numbered entry line —
narrative context explaining why this task exists, what's being built, and how it fits into the bigger picture. Follow
with technical decision dashes listing key design choices and their reasoning (from the spec or conversation — include
them, don't just point at the spec).

**Technical decisions** are dashes within the description — they capture architectural choices, not implementation
detail. "Use SocialButton because it matches Google branding guidelines" is a good decision. "Use
`SocialButton social='google' theme='brand'` which renders a white/gray background" belongs in a plan, not a task.

**Acceptance criteria use bold `Scenario:` labels with Given/When/Then** — not checkbox lists. Each scenario covers a
specific user or system behavior. This makes the done-state unambiguous and testable.

**Out of scope** uses `✗` markers to call out what's explicitly not part of this task, preventing scope creep during
implementation.

**References** close each task — relevant modules/components by name, links, contracts. One line, no heading.

A developer reading only one task should have enough to produce an implementation plan and start working — without
referring back to the spec or asking for background.

**What does NOT belong in a task:** Fenced code blocks, exact line number references (e.g., "line 42"), before/after
diffs, specific function signatures or API call examples, i18n key paths, CSS class names, or any content that
prescribes *how* to implement rather than *what* to implement. If the implementer would need to verify your code snippet
against the actual codebase anyway, it adds noise without value. Reference components and modules by name; let the
implementer read the code.

### Step 6 — Review

After writing the brief, dispatch a reviewer subagent:

1. Spawn a general-purpose subagent with the reviewer prompt (see `workers/reviewer.md`)
   - Provide: the brief file path and the spec path (if any)
1. If issues found: fix them, re-dispatch the reviewer, repeat until approved
1. If approved: proceed to next step

The reviewer's highest-priority check is self-containment — could someone pick up any single task and know what to do?
If context is thin, that's a blocker.

If subagents aren't available, do a self-review pass. For each task, ask: "If I handed this to someone who's never seen
the spec, would they know what to build, why, and how to verify it's done?"

If the review loop exceeds 3 iterations, surface it to the user for guidance rather than spinning.

### Step 7 — Save

Write the brief to a file per the [output](#output) convention. After saving, tell the user where it landed and give a
brief overview:

**"Brief saved to `.claude/briefs/<codename>.md`."**

Then output a summary:

```
**Decomposition:** <N tasks, M parallelizable>

**Task sequence:**
- <brief dependency chain or parallel groups>

**Flags:**
- <risks, uncertainties, or assumptions that might affect task boundaries — or "None">
```

## Rules

### Task vs. implementation plan

A task describes *what* to build and *why* — it's a work assignment, not a recipe. The implementer (human or AI) decides
*how*. Think of it like a well-written Jira ticket: enough context to start working, clear boundaries and acceptance
criteria, but no step-by-step implementation instructions.

**Include:** Business context, motivation, scope boundaries, acceptance criteria, architectural decisions, relevant
module/component names, Figma links with short descriptions of each frame, data models, API contracts.

**Do not include:** Code snippets, before/after diffs, exact line numbers, i18n key paths, implementation recipes,
specific function signatures to write, file contents to change. These belong in an implementation plan (the plan skill),
not a task.

The test: if removing a sentence wouldn't change *what* gets built, only *how*, it probably doesn't belong in the task.

## Template

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/report.md').read(), end='')"`

> [!IMPORTANT] This template is MANDATORY, not a suggestion. Reproduce the exact structure: dashboard header, summary,
> compact index, and numbered tasks with description, technical decisions, Given/When/Then scenarios, ✗ scope, and
> references. Do NOT improvise formats or use heading-heavy layouts. The only acceptable omission is a section with zero
> entries.

## Safety

> [!IMPORTANT] This skill creates brief files only. Do not modify source code, tests, or configuration unless the user
> explicitly asks to start implementing.
