---
description: "Turn a big feature into standalone work packages for a team. When a user describes a feature with multiple components \u2014 like 'auth + billing + data isolation' or 'websockets + notification UI + email digests' \u2014 and wants to divide, decompose, split, or break it into tasks so different developers, contractors, or agents can each own a piece, ALWAYS use this skill. Trigger phrases: 'break into tasks', 'decompose into units of work', 'split across people', 'assignable tasks', 'hand off to the team', 'too big for one person', 'turn this spec into tasks', 'parallelize across devs'. This is work division, not implementation planning \u2014 it answers 'who works on what' rather than 'how do I build this'. /task."
user-invocable: true
disable-model-invocation: false
---

# Write Task

Decompose a spec or feature idea into standalone tasks — each with enough context that any developer (human or AI) can pick one up and start working without reading the original spec or asking for background.

The spec skill closes scope. The plan skill fills in implementation detail. This skill sits between them: it takes a scoped idea and breaks it into independent work units, each carrying the full context needed to act on it.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `write:task` online. Breaking this into pieces.

## Output

Write the task document to the project's `.claude/tasks/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern (e.g., `rusty-compass.md`, `quiet-lantern.md`).

## Steps

### 1. Understand input

Read the spec if one is provided. If the input is a conversation or a vague idea instead of a spec, capture the goal, scope, and constraints from what's available. Note what's missing — the clarifying questions in Step 3 will fill those gaps.

If a spec exists, don't just reference it — internalize it. The tasks you produce must carry the spec's context forward so the spec itself becomes optional reading.

### 2. Research

Explore the codebase to understand what exists and where new work will land.

- Read CLAUDE.md, README, project manifest to understand the stack and conventions
- Find existing code related to the feature — patterns, abstractions, interfaces
- Check the testing setup
- Look for integration points where new work meets existing code

This research informs how you decompose — where the natural boundaries are, what already exists, what patterns the implementer should follow. Reference relevant modules and components by name in the tasks, but don't dump implementation details like line numbers, code snippets, or before/after diffs into them.

### 3. Ask clarifying questions

Ask questions that maximize the context in each task. One at a time.

These aren't questions about *what* to build (that's the spec's job) — they're about *how to break the work down* and *what context to include* so each task stands alone.

Focus on:
- What background would someone unfamiliar need to start working on a piece of this?
- Are there parts that are riskier or more uncertain and should be isolated?
- What can be worked on in parallel vs. what's sequential?
- Are there existing patterns or conventions the implementer should follow?
- What does "done" look like for each piece?

Prefer multiple choice when possible. Let the user's answers guide the next question.

### 4. Decompose

Identify natural boundaries for independent work units. Present the proposed breakdown — task names, one-line descriptions, dependencies, and which can be parallelized — for the user to approve before writing full details.

Good boundaries:
- Different subsystems or layers
- Independent features that don't share state
- Setup/infrastructure vs. business logic
- Data model vs. API vs. UI

Each task should produce a working, testable increment. If two tasks can't be verified independently, they should probably be one task.

### 5. Write tasks

Produce the task document using the template in `TEMPLATE.md`.

**Description is the most important section of each task.** It should read like a well-written Jira ticket — narrative context explaining why this task exists, what's being built, and how it fits into the bigger picture. End the description with a **Technical decisions** block listing key design choices and their reasoning (from the spec or conversation — include them, don't just point at the spec).

**Technical decisions** capture architectural choices — what approach was selected and why, not how to implement it. "Use SocialButton because it matches Google branding guidelines" is a good technical decision. "Use `SocialButton social='google' theme='brand'` which renders a white/gray background" is implementation detail that belongs in a plan, not a task.

**Acceptance criteria use Given/When/Then scenarios** — not checkbox lists. Each scenario covers a specific user or system behavior. This makes the done-state unambiguous and testable.

**Out of Scope** calls out what's explicitly not part of this task, preventing scope creep during implementation.

A developer reading only one task section should have enough to produce an implementation plan and start working — without referring back to the spec or asking for background.

**What does NOT belong in a task:** Fenced code blocks, exact line number references (e.g., "line 42"), before/after diffs, specific function signatures or API call examples, i18n key paths, CSS class names, or any content that prescribes *how* to implement rather than *what* to implement. If the implementer would need to verify your code snippet against the actual codebase anyway, it adds noise without value. Reference components and modules by name; let the implementer read the code.

### 6. Review

After writing the tasks, dispatch a reviewer subagent:

1. Spawn a general-purpose subagent with the reviewer prompt (see `agents/reviewer.md`)
   - Provide: the task file path and the spec path (if any)
2. If issues found: fix them, re-dispatch the reviewer, repeat until approved
3. If approved: proceed to next step

The reviewer's highest-priority check is self-containment — could someone pick up any single task and know what to do? If context is thin, that's a blocker.

If subagents aren't available, do a self-review pass. For each task, ask: "If I handed this to someone who's never seen the spec, would they know what to build, why, and how to verify it's done?"

If the review loop exceeds 3 iterations, surface it to the user for guidance rather than spinning.

### 7. Save

Write the task document to a file per the [output](#output) convention. After saving, tell the user where it landed and give a brief overview:

**"Tasks saved to `.claude/tasks/<codename>.md`."**

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

A task describes *what* to build and *why* — it's a work assignment, not a recipe. The implementer (human or AI) decides *how*. Think of it like a well-written Jira ticket: enough context to start working, clear boundaries and acceptance criteria, but no step-by-step implementation instructions.

**Include:** Business context, motivation, scope boundaries, acceptance criteria, architectural decisions, relevant module/component names, Figma links with short descriptions of each frame, data models, API contracts.

**Do not include:** Code snippets, before/after diffs, exact line numbers, i18n key paths, implementation recipes, specific function signatures to write, file contents to change. These belong in an implementation plan (the plan skill), not a task.

The test: if removing a sentence wouldn't change *what* gets built, only *how*, it probably doesn't belong in the task.
