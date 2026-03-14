---
name: code:review
description: "Multi-focus code review that spawns specialized subagents to review your local diff in parallel. Covers code quality, security, bugs, architecture, test coverage, and pattern adherence. Use this skill whenever the user asks for a code review, wants feedback on their changes, says 'review my diff', 'check my code', 'review this PR', 'what did I miss', or any variation of wanting a second opinion on code changes — even if they don't say the word 'review'. Also trigger when the user says 'look over these changes', 'anything wrong with this', 'sanity check my diff', or 'before I commit'."
user-invocable: true
disable-model-invocation: false
---

# Code Review

Multi-agent code review. Spawns specialized reviewers in parallel, each focused on a different dimension of quality. Merges findings into a single prioritized report.

## Announce

> `code:review` — Spawning review agents on your diff.

## Steps

### 1. Determine the diff scope

Figure out what to review. The right diff depends on where you are.

**Step 1: Detect the main branch and current branch.**

```bash
# Find the main branch — try local ref first (works offline), fall back to remote
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
if [ -z "$MAIN_BRANCH" ]; then
  MAIN_BRANCH=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | sed 's/.*: //')
fi
if [ -z "$MAIN_BRANCH" ]; then
  # Last resort: guess from local branches
  MAIN_BRANCH=$(git branch --list main master develop 2>/dev/null | head -1 | tr -d '* ')
fi

# What branch are we on?
git branch --show-current
```

**Step 2: Pick the diff strategy.**

If the user specified a branch, commit range, or PR — use that directly. Otherwise:

**On a feature branch** (HEAD is not the main branch):
```bash
# Committed branch changes — only what this branch introduced
# Use the MAIN_BRANCH detected in Step 1
git diff $(git merge-base "$MAIN_BRANCH" HEAD)..HEAD

# Plus any uncommitted work on top
git diff          # unstaged
git diff --cached # staged
```

The `merge-base` approach is important — it isolates just the branch's changes without pulling in unrelated commits from main. This means the review works correctly even when the branch isn't rebased, which is the common case (rebasing is not part of a review task).

**On the main branch**:
```bash
git diff          # unstaged
git diff --cached # staged
```

**Step 3: Combine and report scope.**

Merge all diff sources into one. If there are both committed branch changes and uncommitted work, note the distinction — the user may want to know which findings are in committed code vs work-in-progress.

If the total diff is large (>500 lines), mention it and ask if the user wants to narrow scope — but don't refuse to review.

### 2. Discover project guidelines

Before spawning reviewers, check if the project has guidelines the reviewers should know about:

```bash
ls .claude/guides/ 2>/dev/null
```

If guide files exist, read them. For each guide, decide which agents would benefit from it based on the guide's content — a guide about error handling conventions might be relevant to both the bugs and consistency agents, while API design guidelines might matter to architecture. Don't overthink the matching — skim the content, use your judgment, and pass each guide to whichever agents it makes sense for. Some guides might be relevant to all agents.

When passing guides to an agent, include them as additional context in the prompt:

```
The project has the following guidelines that are relevant to your review:

<guide name="[filename]">
[guide content]
</guide>
```

If no guides directory exists or it's empty, skip this step — the agents will review against general best practices.

### 3. Spawn specialized reviewers

Read each agent file from `agents/` relative to this skill directory and spawn them as subagents in parallel. Each agent gets:
- The full diff content
- The review focus area
- Any relevant project guidelines from the step above
- Access to read the surrounding codebase for context

Spawn all 6 in parallel using the Agent tool:

| Agent | File | Focus |
|-------|------|-------|
| Linting | `agents/linting.md` | Readability, naming, complexity, SRP |
| Security | `agents/security.md` | Injection, auth, secrets, OWASP |
| Bugs | `agents/bugs.md` | Logic errors, edge cases, race conditions |
| Architecture | `agents/architecture.md` | Coupling, abstractions, dependency direction |
| Coverage | `agents/coverage.md` | Critical path gaps, flaky tests |
| Consistency | `agents/consistency.md` | Convention adherence, duplication |

For each agent, read its `.md` file and use it as the agent's system instructions. Pass the diff as part of the prompt:

```
Review the following diff. Focus on: [agent's specialty]

<diff>
[the diff content]
</diff>

The code lives in: [working directory path]
You have full read access to the codebase for context.
```

**Not every agent applies every time.** Use judgment:
- Skip **coverage** if the project has no test files at all
- Skip **consistency** if the diff is only 1-2 lines (not enough to judge pattern adherence)
- Always run **lint**, **security**, and **bugs** — they apply universally

### 4. Merge findings

Once all agents report back, merge their findings into a single report. Each agent produces findings in this structure:

```
### Critical
### Warnings
### Suggestions
### Notes
```

Merge them by severity across all agents, not by agent. The user cares about "what's most important" not "what the security agent said vs what the bug hunter said." But tag each finding with its source so the user knows the lens.

### 5. Present the unified report

Use this template:

```markdown
### Output template

**Scope**: [files changed, line count, staged/unstaged]
**Verdict**: [PASS | CONCERNS | NEEDS WORK]

### Critical
- **[file:line]** [security] — Description. Why it matters. -> Fix suggestion
- **[file:line]** [bugs] — Description. Why it matters. -> Fix suggestion

### Warnings
- **[file:line]** [quality] — Description. -> Suggestion
- **[file:line]** [patterns] — Description. -> Suggestion

### Suggestions
- **[file:line]** [architecture] — Description
- **[file:line]** [tests] — Description

### Notes
- [Positive callouts, context, observations]

---
**Summary**: [1-2 sentence bottom line]
```

Rules:
- Omit empty sections
- Verdict: any Critical -> NEEDS WORK, only Warnings -> CONCERNS, else PASS
- Tag each finding with its source: `[security]`, `[bugs]`, `[quality]`, `[architecture]`, `[tests]`, `[patterns]`
- Deduplicate — if two agents flag the same thing, keep the more detailed one and note both perspectives
- Keep summary to a genuine bottom line

### Reviewing a PR

When the user passes a PR URL (e.g. `github.com/org/repo/pull/123`) or says "review PR #123":

1. **Get PR metadata** using `gh pr view`:
   ```bash
   gh pr view <url-or-number> --json headRefName,baseRefName,number,title,url
   ```

2. **Check out the branch into a git worktree** so the review happens in isolation without touching the user's working tree:
   ```bash
   # Fetch the PR branch
   gh pr checkout <number> --detach  # just to fetch — we'll use worktree instead
   git worktree add /tmp/review-pr-<number> <headRefName>
   ```

3. **Run the review from the worktree.** The diff scope for a PR is the merge-base between the PR's base branch and head branch:
   ```bash
   cd /tmp/review-pr-<number>
   git diff $(git merge-base "origin/<baseRefName>" HEAD)..HEAD
   ```

4. **Clean up the worktree** after the review is done:
   ```bash
   git worktree remove /tmp/review-pr-<number>
   ```

The rest of the workflow (spawn agents, merge findings, present report) is identical. The only difference is where the diff comes from.

## Edge cases

If the user asks for a focused review ("just check security" or "focus on test coverage"), only spawn the relevant agent(s) instead of all 6. Respect what they asked for.

If the user provides additional context ("this is a hot path" or "we're about to release"), pass that context to the agents so they can calibrate severity.
