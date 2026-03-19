---
description: "Multi-agent review of your local diff"
user-invocable: true
disable-model-invocation: false
argument-hint: "[--pr <url-or-number> | --ref <branch>]"
allowed-tools: Read, Grep, Glob, Bash(python3 *), Agent
model: opus
---

# Code Review

Multi-agent code review. Spawns specialized reviewers in parallel, each focused on a different dimension of quality. 
Merges findings into a single prioritized report.

## Announce

> `code:review` — Spawning review agents on your diff.

## Progress tracking

Create a task at the start of the review and update it at each major milestone to give the user visibility into progress:

1. "Scoping diff..."
2. "Discovering guidelines..."
3. "Spawning N reviewers..."
4. "Merging findings..."
5. "Verifying claims..."
6. "Done"

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

### Step 1 — Determine the diff scope

The scope data is injected automatically below. Parse the JSON and use it for the rest of the review.

<scope>
!`python3 ${CLAUDE_SKILL_DIR}/scripts/scope.py $ARGUMENTS 2>/dev/null || echo '{"error": "scope script failed"}'`
</scope>

The JSON contains:
- `mode`: `"branch"`, `"main"`, `"pr"`, or `"ref"`
- `main_branch`, `current_branch`, `merge_base`: git context
- `files_changed`, `lines_changed`, `large_diff`: scope metrics for the report
- `sources`: which diff sections have content (`"branch"`, `"staged"`, `"unstaged"`)
- `diff.branch`, `diff.staged`, `diff.unstaged`: the actual diff content
- `pr.*`: PR metadata (only in PR mode — `number`, `title`, `url`, `base`, `head`)

If the JSON contains an `"error"` key, tell the user the scope script failed and stop.

If `files_changed` is 0 and all diff sections are empty, tell the user there's nothing to review and stop.

Combine `diff.branch` + `diff.staged` + `diff.unstaged` as the full diff for agents. Report `sources` in the Scope line of the template. If `large_diff` is true, mention it and ask if the user wants to narrow scope — but don't refuse to review.

### Step 2 — Discover project guidelines

Available guides:
!`ls .claude/guides/ 2>/dev/null || echo "(none)"`

If guides are listed above, read each one. For each guide, decide which agents would benefit from it based on the guide's content — a guide about error handling conventions might be relevant to both the bugs and consistency agents, while API design guidelines might matter to architecture. Don't overthink the matching — skim the content, use your judgment, and pass each guide to whichever agents it makes sense for. Some guides might be relevant to all agents.

When passing guides to an agent, include them as additional context in the prompt:

```
The project has the following guidelines that are relevant to your review:

<guide name="[filename]">
[guide content]
</guide>
```

If `(none)` is shown above, skip this step — the agents will review against general best practices.

### Step 3 — Spawn specialized reviewers

Read each agent file from `agents/` relative to this skill directory and spawn them as subagents in parallel. Each agent gets:
- The full diff content
- The review focus area
- Any relevant project guidelines from the step above
- Access to read the surrounding codebase for context

Spawn all 7 in parallel following the **Agent Frontmatter** section above to parse each `.md` file and invoke the Agent tool.

| Agent | File | Focus |
|-------|------|-------|
| Bugs | `agents/bugs.md` | Logic errors, edge cases, race conditions |
| Security | `agents/security.md` | Injection, auth, secrets, OWASP |
| Architecture | `agents/architecture.md` | Coupling, abstractions, dependency direction |
| Consistency | `agents/consistency.md` | Convention adherence, duplication |
| Quality | `agents/quality.md` | Readability, naming, complexity, SRP |
| Tests | `agents/tests.md` | Critical path gaps, flaky tests |
| Coherence | `agents/coherence.md` | Incomplete renames, orphaned types, stale names, structural debris |

Pass the diff as part of each agent's prompt:

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
- Skip **coherence** if the diff is only additive (new files/features, no renames or removals)
- Always run **quality**, **security**, and **bugs** — they apply universally

<!-- ultrathink -->
### Step 4 — Merge findings

Once all agents report back, merge their findings into a single report. Each agent produces findings in this structure:

```
### Critical
### Warnings
### Suggestions
### Questions
```

Merge them by severity across all agents, not by agent. The user cares about "what's most important" not "what the security agent said vs what the bug hunter said." But tag each finding with its source so the user knows the lens.

After merging, re-calibrate severity across the full list. Specialist agents inflate — an architecture agent may call something Critical because it violates a pattern, but if it doesn't introduce a real bug or block shipping, it belongs in Warnings. Apply the shared rubric: Critical = must fix before merging, Warning = meaningful risk but doesn't block, Suggestion = everything else. Demote liberally; a report with 2 real Criticals is more useful than one with 8 inflated ones.

### Step 5 — Verify claims

Reviewers sometimes hallucinate issues — misread a variable name, flag a bug that's actually handled elsewhere, or reference a line that doesn't exist. Before presenting the report, spawn a verification subagent that checks every finding against the actual code.

Spawn `agents/verifier.md` following the **Agent Frontmatter** section, with:
- The compiled report (all merged findings)
- The full diff
- Access to read the codebase

> **Exception:** Spawn the verifier with `subagent_type: "general-purpose"` instead of `Explore`. It needs LSP access to trace symbols and verify type information. Its prompt already contains strong read-only instructions.

The verifier checks each finding: does the referenced file and line exist? Does the code snippet match what's actually there? Is the claimed issue real? Was the code actually changed in this diff? It returns a verdict for each finding — **confirmed**, **invalid**, or **uncertain** — plus a **pre-existing** flag for issues in code the changeset didn't touch.

- **confirmed** — keep as-is
- **invalid** — drop from the report entirely
- **uncertain** — keep but add a note that this should be manually verified
- **pre-existing** — move to the dedicated Pre-existing section as a one-liner, not a full finding

### Step 6 — Present the unified report

The report uses a **compact-first** design. The initial output is a scannable index — the user sees every finding as a one-row table entry and drills into details on demand via the Explain action.

Present the report following the **Template** section below.

Rules:
- Omit empty sections entirely — if there are no Warnings, skip the heading
- Verdict: any Critical → NEEDS WORK, only Warnings → CONCERNS, else PASS
- The header is a code block dashboard showing verdict, scope, and counts on one line each
- The summary is plain text beneath the dashboard — 2 sentences with a hard line break between them (two trailing spaces): what the changes do, then whether they're ready to ship
- Findings use a two-line format per finding: line 1 is `N  \`file:line\`  Source`, line 2 is the title indented with spaces to align under the backtick. No descriptions or code in the initial report — just the short title
- Number findings sequentially across all sections (#1, #2, #3…) including Pre-existing, so every item is referenceable
- Tag each finding with its source agent: Bugs, Security, Architecture, Consistency, Quality, Tests
- Questions use blockquote format with bold `?` prefix, italic tag at end: `> **?** Question text. *[Tag]*`
  - Tags categorize the question: *[Intent]*, *[Scope]*, *[Coverage]*, *[Design]*, *[Risk]* — pick whichever fits
- Deduplicate — if two agents flag the same thing, keep the more detailed one and note both perspectives

### Step 7 — Handle user actions

The report ends with an action menu. When the user responds:

**Explain** — When the user asks to explain findings (e.g., "explain 1 4 7" or "e 1"), expand each requested finding with:

1. **The compact finding line** as the heading: `N  \`file:line\`  Source  Title`
2. **A description**: What's wrong, why it matters — 2 sentences with a hard line break between them (two trailing spaces)
3. **A Rust-style code block** showing the offending code with line numbers, caret pointers (`^^^^^`) highlighting the exact problem, and a fix:

```
  --> file:line-range
   |
42 |    some_code(vulnerable_input)
   |              ^^^^^^^^^^^^^^^^ explanation of what's wrong
   |
   = fix:
   |
42 |    some_code(sanitized_input)
   |
```

The carets should underline the specific characters or expression that cause the issue — not the whole line. Omit the fix section if there's no clear single fix (e.g., architectural concerns). Not every finding needs a code block — conceptual issues (e.g., "no authentication") just need a description.

**Example expansion:**

3  `src/auth.ts:42`  Security  User input passed to SQL query unsanitized

User input from `req.query.id` is interpolated directly into a SQL string,
enabling SQL injection on the `/users` endpoint.

```
  --> src/auth.ts:41-43
   |
42 |    const user = await db.query(`SELECT * FROM users WHERE id = ${req.query.id}`)
   |                                                                ^^^^^^^^^^^^^^^ unsanitized user input in SQL template literal
   |
   = fix:
   |
42 |    const user = await db.query(`SELECT * FROM users WHERE id = $1`, [req.query.id])
   |
```

**Dismiss** — When the user dismisses a finding (e.g., "dismiss 3" or "d 3"), acknowledge it and note it's dropped.

**Verify** — When the user asks to verify (e.g., "verify" or "v"), re-run the review on the current diff state.

## Template

!`cat ${CLAUDE_SKILL_DIR}/TEMPLATE.md`

> [!IMPORTANT]
> This template is MANDATORY, not a suggestion. Reproduce the exact
> heading hierarchy, field names, and structure. Do NOT improvise
> formats, collapse sections into prose, reorder fields, or omit
> sections that have findings. The only acceptable omission is a
> section with zero findings. ALWAYS end with the action menu.

## Safety

> [!IMPORTANT]
> This skill is read-only by default. Do not modify, stage, or commit
> code unless the user explicitly asks for fixes to be applied.

## Edge cases

If the user asks for a focused review ("just check security" or "focus on test coverage"), only spawn the relevant agent(s) instead of all 6. Respect what they asked for.

If the user provides additional context ("this is a hot path" or "we're about to release"), pass that context to the agents so they can calibrate severity.
