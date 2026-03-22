---
description: "Refine an artifact in a loop until it passes  //  Trigger on 'improve X until Y', 'keep refining until', 'iterate on this until it's good', 'polish this', 'make this better and test it', or any improve/refine/iterate paired with quality criteria. Even a bare 'improve this' should trigger."
user-invocable: true
disable-model-invocation: false
---

# Improve

## Announce

> Daemon `meta:improve` online. Starting refinement loop.

## Why this skill exists

Improving something usually means: change it, check if it's better, repeat. But
without structure, this degrades into either one-shot attempts ("here's my best
guess") or endless unfocused tinkering. This skill enforces a disciplined loop:
improve, assess, get independent review, incorporate feedback, try again — with
a hard cap to prevent spinning.

The key design: the improver works inline with full context of what was tried and
why, while the reviewer subagent sees only the current artifact with fresh eyes.
This prevents the improver from rationalizing its own choices and ensures honest
assessment each iteration.

## Steps

### 1. Capture the target

Identify what's being improved:

- **The artifact (X):** What file, code, or content to improve. Read it.
- **The criteria (Y):** What "good enough" means. Can be:
  - Concrete: "tests pass", "under 50 lines", "response time < 200ms"
  - Qualitative: "reads naturally", "feels professional", "clear and concise"
  - A test command: "run `claude -p 'prompt'` and check the response"
  - A mix of the above
- **The iteration cap (Z):** Max attempts before stopping. Default: **5**.

If the user hasn't specified criteria, ask. Even a loose definition ("it should
feel more natural") is better than none — the criteria steer the loop.

If the user hasn't specified checks, figure out if there are obvious ones:
- Code → tests, linter
- Prompt / persona → `claude -p` with test prompts
- Skill → run it on a sample input
- Config → validate syntax, test behavior

Suggest checks when there's a natural fit, but don't force them. Some things
only need the reviewer's judgment.

### 2. The refinement loop

For each iteration (1 through Z):

#### a. Improve the artifact

Make changes to X based on:
- The original criteria Y
- Reviewer feedback from the previous iteration (if any)
- What you learned from earlier attempts

Think about *why* the reviewer flagged what they flagged. Don't just patch the
specific complaint — understand the underlying issue and address it properly.

If you're stuck (same feedback twice in a row), try a fundamentally different
approach rather than incremental tweaks. Change the structure, the strategy,
the framing. If word-level edits aren't working, maybe the whole section needs
rewriting from a different angle.

#### b. Run checks (if any)

Execute whatever automated assessment was defined:
- Run tests, linters, or other CLI commands
- Run `claude -p` with test prompts and capture output
- Check file size, line count, or other measurable criteria

Capture the results — the reviewer needs them.

#### c. Spawn the reviewer

Dispatch a **general-purpose subagent** to independently assess the artifact.

**The reviewer gets:**
- The current state of the artifact
- The quality criteria Y
- Check results from step (b) if any
- The iteration number (so they know context, but NOT what was tried before)

**The reviewer does NOT get:**
- Previous versions of the artifact
- Your reasoning for changes
- History of previous feedback

This separation is intentional. Fresh eyes catch things that familiarity misses.

**Reviewer prompt — adapt as needed:**

```
You are an independent quality reviewer. Assess whether this artifact meets
the given criteria. If not, provide specific, actionable feedback.

**Artifact:**
[CURRENT_STATE_OF_X]

**Quality criteria:**
[Y]

**Check results:**
[CHECK_OUTPUTS or "No automated checks"]

**Iteration [N] of [Z].**

### How to assess

1. Read the artifact carefully
2. Evaluate against each criterion
3. Factor in check results if present
4. Be specific about what's working and what isn't

## Output

**Verdict:** PASS | FAIL

**Score:** [1-10] — how close to meeting all criteria

**What's working:**
- [specific things that meet or exceed criteria]

**What needs improvement (if FAIL):**
- [specific issue] → [concrete suggestion]

Keep feedback actionable. "The tone is off" isn't useful. "The second paragraph
shifts from conversational to formal mid-sentence — pick one register" is.
```

#### d. Read the verdict

- **PASS** → Done. Move to step 3.
- **FAIL + iterations remaining** → Check for stall (see below), then loop
  back to (a) with the reviewer's feedback.
- **FAIL + iteration Z reached** → Stop. Report where you got to and what
  remains unresolved.

### 3. Present results

When the loop ends:

- **Iterations used:** e.g., "Passed on iteration 3 of 5"
- **What changed:** Brief summary of key improvements from the original
- **Final assessment:** The reviewer's last verdict
- **Check results:** If applicable

If stopped at the cap without passing, be honest:

> After [Z] iterations, the reviewer still flagged [specific issue]. Here's
> where I got to and what I couldn't resolve. Want to adjust the criteria,
> try a different approach, or extend the loop?

## Rules

Track reviewer feedback across iterations. If two consecutive reviews flag the
same core issue with substantially similar feedback:

1. **First stall:** Try a fundamentally different approach — not tweaking, but
   restructuring, rethinking, reframing from scratch.
2. **Second stall (third consecutive same-issue):** Stop early. Tell the user
   what you've tried and where you're stuck. This is more useful than burning
   remaining iterations on the same dead end.

## Edge cases

- **No criteria given:** Help define them before starting. Don't wing it.
- **Artifact doesn't exist yet:** Create it first, then enter the loop.
- **Checks pass but reviewer says FAIL:** Trust the reviewer. Automated checks
  are necessary but not sufficient.
- **PASS on first try:** Report it and move on. Don't iterate for its own sake.
- **User sets Z=1:** That's fine — improve once, review once, done.
