---
description: "Root-cause analysis of what went wrong  //  Trigger on 'what went wrong', 'what happened', 'let's reflect', 'let's debrief', 'retrospective', or user frustration like 'that was a mess', 'you kept doing the same thing'. Do NOT use for incident reports, team retrospectives, code review, or debugging."
user-invocable: true
disable-model-invocation: false
---

# Reflect

## Announce

> Daemon `meta:reflect` online. Reviewing the tape.

## Why this skill exists

When something goes sideways, the natural instinct is to apologize and move on. That's
not helpful — the user already knows something went wrong. What they need is an honest
breakdown of what happened and concrete ideas for next time. This skill forces a
structured retrospective instead of a hollow "sorry about that."

The goal: every reflection should leave the user with a clear understanding of what
happened and a short list of things to do differently. If the reflection doesn't change
future behavior, it failed.

## Steps

### 1. Reconstruct the timeline

Go back through the conversation like a detective reviewing evidence. Identify:

- What was the goal?
- What approach was chosen and why?
- Where did things start to go off track?
- Were there warning signs that got missed?

Focus on the turning points, not every single tool call.

### 2. Identify root causes

For each thing that went wrong, dig into *why*. Common patterns:

| Pattern | Example |
|---------|---------|
| **Wrong assumption** | Assumed one config file existed, didn't check for others |
| **Missed context** | Didn't read the README that explained the convention |
| **Wrong tool** | Brute-forced with regex when an AST parser was available |
| **Scope drift** | Was asked to fix a button, ended up refactoring the component |
| **Overcomplicated** | Built an abstraction for a one-time operation |
| **Didn't verify** | Made the change but never ran the tests |
| **Retry loop** | Kept trying the same failing approach instead of stepping back |

Be specific. "I should have been more careful" is not a root cause — that's an apology
wearing a trenchcoat. "I edited `config.ts` because I assumed it was the only config,
without running a search for other config files" is a root cause.

### 3. Credit what worked

Reflection isn't only about failures. If parts of the process went well, name them.
This helps distinguish between "everything was bad" and "the approach was sound but
one specific step went wrong."

### 4. Write actionable improvements

For each root cause, propose a concrete action. Good improvements are:

- **Specific** — "Search for all config files before editing any" not "be more thorough"
- **Actionable** — something that can actually be done next time
- **Proportional** — the fix matches the size of the problem

### 5. Produce the reflection

Format the output following the **## Template** section below. Keep the whole reflection
concise enough to fit comfortably on one screen.

### 6. Review

After writing the reflection, dispatch a reviewer subagent if available:

1. Spawn a general-purpose subagent with the prompt from `agents/reviewer.md`
   - Provide: the reflection content and the conversation context
2. If issues found: revise the reflection and re-dispatch, up to 2 iterations
3. If approved: present to the user

If subagents aren't available, do a quick self-check: scan for vague language, apology
patterns, or non-actionable improvements. Revise anything that reads more like "sorry"
than analysis.

### 7. Recommend enforcement

After presenting the reflection, look at each improvement and recommend the best
mechanism to make it stick. Present recommendations:

> **How to make these stick:**
>
> | Improvement | Mechanism | Why |
> |-------------|-----------|-----|
> | [improvement] | [mechanism] | [one-line reason] |
>
> Want me to set any of these up?

#### Choosing the right mechanism

- **Memory** — Behavioral lessons Claude should recall in future conversations.
  Best for judgment calls and heuristics ("widen search after one failed fix").
  Save directly as a feedback-type memory.

- **CLAUDE.md** — Project rules that should always be in context. Best for
  codebase-specific rules that every conversation must follow ("always run
  `npm run lint` before presenting code"). Append directly to the project's
  CLAUDE.md.

- **Hook** — Automated actions that run without human intervention. Best for
  mechanical checks that should never be skipped ("auto-format on file edit").
  Hand off to `create:hook` — say: "Want me to invoke `/create:hook` to wire
  this up?"

- **Skill** — Reusable multi-step workflow. Best for complex processes that
  need their own instructions ("pre-commit checklist"). Hand off to
  `create:skill` — say: "Want me to invoke `/create:skill` to build this?"

For memory and CLAUDE.md, execute directly if the user agrees.
For hooks and skills, suggest the appropriate slash command and let the user
decide — those have their own interactive workflows.

## Rules

Analytical tone, like a post-incident review. Not defensive, not self-flagellating.
Think "here's what happened and here's what we'll do differently."

The user's time is valuable — every sentence should carry information.

## Edge cases

- **Nothing went wrong**: Focus on what worked well and any efficiency improvements.
  Not every reflection needs to find problems.
- **User is frustrated**: Acknowledge it in one sentence and move straight into
  analysis. Don't match their frustration or over-apologize.
- **Multiple issues**: Prioritize the biggest 2-3 root causes rather than exhaustively
  listing every misstep.
- **Vague conversation history**: If there isn't enough context to do a meaningful
  reflection, say so and ask the user what specifically they'd like to reflect on.

## Template

Read `TEMPLATE.md` for the reflection format.

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have entries. The only acceptable omission is a
> section with zero entries. ALWAYS end with the follow-up question.
