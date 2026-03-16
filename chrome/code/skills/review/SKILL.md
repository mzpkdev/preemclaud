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

Run the scope script to compute the diff and metadata deterministically:

```bash
python3 <path-to-this-skill>/scripts/scope.py
```

For a PR: `python3 <path>/scripts/scope.py --pr <url-or-number>`
For a specific ref: `python3 <path>/scripts/scope.py --ref develop`

The script outputs JSON with:
- `mode`: `"branch"`, `"main"`, `"pr"`, or `"ref"`
- `main_branch`, `current_branch`, `merge_base`: git context
- `files_changed`, `lines_changed`, `large_diff`: scope metrics for the report
- `sources`: which diff sections have content (`"branch"`, `"staged"`, `"unstaged"`)
- `diff.branch`, `diff.staged`, `diff.unstaged`: the actual diff content
- `pr.*`: PR metadata (only in PR mode — `number`, `title`, `url`, `base`, `head`)

Combine `diff.branch` + `diff.staged` + `diff.unstaged` as the full diff for agents. Report `sources` in the Scope line of the template. If `large_diff` is true, mention it and ask if the user wants to narrow scope — but don't refuse to review.

### 2. Discover project guidelines

Before spawning reviewers, check if the project has guidelines the reviewers should know about. Use Glob to check for guide files matching `.claude/guides/*`.

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
| Bugs | `agents/bugs.md` | Logic errors, edge cases, race conditions |
| Security | `agents/security.md` | Injection, auth, secrets, OWASP |
| Architecture | `agents/architecture.md` | Coupling, abstractions, dependency direction |
| Consistency | `agents/consistency.md` | Convention adherence, duplication |
| Quality | `agents/quality.md` | Readability, naming, complexity, SRP |
| Tests | `agents/tests.md` | Critical path gaps, flaky tests |

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
- Skip **tests** if the project has no test files at all
- Skip **consistency** if the diff is only 1-2 lines (not enough to judge pattern adherence)
- Always run **quality**, **security**, and **bugs** — they apply universally

### 4. Merge findings

Once all agents report back, merge their findings into a single report. Each agent produces findings in this structure:

```
### Critical
### Warnings
### Suggestions
### Notes
```

Merge them by severity across all agents, not by agent. The user cares about "what's most important" not "what the security agent said vs what the bug hunter said." But tag each finding with its source so the user knows the lens.

### 5. Verify claims

Reviewers sometimes hallucinate issues — misread a variable name, flag a bug that's actually handled elsewhere, or reference a line that doesn't exist. Before presenting the report, spawn a verification subagent that checks every finding against the actual code.

Read `agents/verifier.md` and spawn it with:
- The compiled report (all merged findings)
- The full diff
- Access to read the codebase

The verifier checks each finding: does the referenced file and line exist? Does the code snippet match what's actually there? Is the claimed issue real? Was the code actually changed in this diff? It returns a verdict for each finding — **confirmed**, **invalid**, or **uncertain** — plus a **pre-existing** flag for issues in code the changeset didn't touch.

- **confirmed** — keep as-is
- **invalid** — drop from the report entirely
- **uncertain** — keep but add a note that this should be manually verified
- **pre-existing** — move to the dedicated Pre-existing section as a one-liner, not a full finding

### 6. Present the unified report

Present the report following the **## Template** section below.

Rules:
- Omit empty sections
- Verdict: any Critical -> NEEDS WORK, only Warnings -> CONCERNS, else PASS
- Tag each finding with its source agent: `[Bugs]`, `[Security]`, `[Architecture]`, `[Consistency]`, `[Quality]`, `[Tests]`
- Deduplicate — if two agents flag the same thing, keep the more detailed one and note both perspectives
- Keep summary to a genuine bottom line

## Template

Read `TEMPLATE.md` for the report format.

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have findings. The only acceptable omission is a
> section with zero findings. ALWAYS end with the action menu AND
> follow-up question.

## Edge cases

If the user asks for a focused review ("just check security" or "focus on test coverage"), only spawn the relevant agent(s) instead of all 6. Respect what they asked for.

If the user provides additional context ("this is a hot path" or "we're about to release"), pass that context to the agents so they can calibrate severity.
