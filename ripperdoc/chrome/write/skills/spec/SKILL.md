---
description: Think through an idea before building it
user-invocable: true
disable-model-invocation: false
---

# Write Spec

Help turn ideas into fully formed specs through collaborative dialogue. The goal is to make sure the idea is solid, the
scope is clear, and the approach makes sense — before anyone writes code.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work
begins.

> Daemon `write:spec` online. Thinking this through.

## Output

Write the spec to the project's `.claude/specs/` directory using a whimsical two-word `<adjective>-<noun>.md` pattern
(e.g., `velvet-compass.md`, `neon-anchor.md`).

## Steps

### Step 1 — Scope check

Before anything else, assess the size of what the user is describing.

If the request covers multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and
analytics"), flag this immediately. Don't spend time refining details of something that needs to be decomposed first.

- Help the user break it into sub-projects: what are the independent pieces, how do they relate, what order should they
  be built?
- Each sub-project gets its own spec → plan → implementation cycle
- Then proceed with the first sub-project through the normal flow below

For appropriately-scoped projects, continue to Step 2.

### Step 2 — Research

Before asking questions, build context so your questions are informed rather than generic.

- Read CLAUDE.md, README, project manifest to understand the stack and conventions
- Explore the relevant parts of the codebase — find existing patterns, abstractions, and interfaces that relate to the
  idea
- Check recent commits and docs for context on what's been happening
- Look at the testing setup

This lets you ask questions like "I see you're using SQLAlchemy with Alembic — should the new feature follow that
migration pattern?" instead of generic "what database do you use?"

### Step 3 — Ask clarifying questions

Use `AskUserQuestion` to understand the idea through focused dialogue. One question at a time — don't overwhelm.

- Prefer multiple choice when possible (easier to answer, faster to converge)
- Open-ended is fine for exploratory questions
- Focus on: purpose, constraints, success criteria, edge cases
- Let the user's answers guide the next question — this is a conversation, not an interview

Good questions uncover assumptions the user hasn't thought about yet. "What happens when the webhook endpoint is down?"
is more valuable than "What HTTP method should the webhook use?"

### Step 4 — Explore approaches

Once you understand what's being built, propose 2-3 different approaches with tradeoffs. Lead with your recommendation
and explain why.

For simple tasks where there's an obvious path, you can propose one approach and explain why alternatives aren't worth
considering. Don't manufacture fake tradeoffs just to hit a number.

For complex tasks, genuine alternatives help the user make an informed choice. Present them conversationally:

- What each approach does differently
- Where each one shines and where it struggles
- Your recommendation and reasoning

### Step 5 — Present the design

Use `EnterPlanMode` to present the design for user approval. Present in sections, scaled to complexity. A few sentences
for straightforward parts, more detail for nuanced ones.

Cover as appropriate:

- Architecture and component breakdown
- Data model and flow
- Interfaces between components
- Error handling and edge cases
- Testing approach

**YAGNI ruthlessly** — remove unnecessary features from all designs. Don't build what isn't needed.

**Use diagrams when they clarify.** Mermaid diagrams or ASCII art for architecture, data flow, state machines, or
component relationships — but only when a visual genuinely helps. Don't diagram things that are clearer as text.

**Design for isolation and clarity:**

- Break the system into units with one clear purpose and well-defined interfaces
- For each unit, you should be able to answer: what does it do, how do you use it, what does it depend on?
- Smaller, well-bounded units are easier to reason about and implement reliably

**In existing codebases:**

- Follow established patterns. Don't propose a new architecture when the codebase already has one.
- Where existing code has problems that affect the work (e.g., a file that's grown unwieldy), include targeted
  improvements as part of the design — the way a good developer improves code they're working in. Don't propose
  unrelated refactoring.

### Step 6 — Write the spec

Once the user approves the design, use `ExitPlanMode` and write it up as a spec document following the **## Template**
section below.

The **numbered decisions** capture every meaningful design choice made during the conversation — what was chosen, over
what alternatives, and why. Each decision is a single numbered line: `N  Choice  over alternatives — reasoning`. This is
valuable context for anyone reading the spec later (including the agent that implements the plan).

### Step 7 — Review

After writing the spec, dispatch a reviewer subagent:

1. Spawn a general-purpose subagent with the reviewer prompt (see `workers/reviewer.md`)
   - Provide: the spec file path
1. If issues found: fix them, re-dispatch the reviewer, repeat until approved
1. If approved: proceed to next step

If the reviewer raises decision challenges, surface them to the user: "The reviewer flagged a potential issue — you
chose X, but given constraint Y, that might cause Z. What do you think?" The user makes the final call.

If subagents aren't available, do a self-review pass checking for: TODOs/placeholders, internal contradictions, missing
edge cases, scope creep, and unbalanced detail.

If the review loop exceeds 3 iterations, surface it to the user for guidance rather than spinning.

### Step 8 — Save

Write the spec to a file per the [output](#output) convention. After saving, tell the user where it landed:

**"Spec saved to `.claude/specs/<codename>.md`."**

## Template

!`python3 -c "print(open('${CLAUDE_SKILL_DIR}/templates/report.md').read(), end='')"`

> [!IMPORTANT] This template is MANDATORY, not a suggestion. Reproduce the exact structure: dashboard header, summary,
> numbered decisions, Design section, ✓/✗ scope, and tagged questions. Do NOT improvise formats or collapse sections
> into prose. The only acceptable omission is a section with zero entries.

## Safety

> [!IMPORTANT] This skill creates spec files only. Do not modify source code, tests, or configuration unless the user
> explicitly asks to start implementing.
