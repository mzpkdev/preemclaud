Repository: ${GITHUB_REPOSITORY} Workflow run: https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}

Create or refresh a small, high-signal implementation queue for this repository.

Requirements:

- Read the repository before opening issues. Start with README, docs, manifests, and obvious entrypoints.
- Review existing open issues so you do not create duplicates.
- Create at most ${QUEUE_MAX_ISSUES} new issues or issue updates.
- Prefer bounded work that fits in one pull request.
- If a `spec/` directory exists, read its `.md` files first. These are product specifications — create issues that
  implement what they describe.
- Beyond specs, good candidates include: missing tests, broken docs, clear bugs, consistency fixes, automation gaps, or
  small follow-up work.
- Actively look for technical debt that tightens the LLM feedback loop — the faster and more precisely an LLM can verify
  its own changes, the better. Examples: adding or improving tests (unit, integration, e2e), introducing or configuring
  linters and type checkers, writing custom assertions or test helpers, building small verification scripts or tooling,
  adding CI checks that catch regressions early. These issues are high-value even when the codebase has no obvious bugs.
- If an issue addresses technical debt (missing tests, linter gaps, stale abstractions, dead code, dependency hygiene,
  etc.), include `tech debt` in its labels.
- Avoid vague roadmap items, speculative rewrites, or work that depends on product decisions not present in the repo or
  its specs.
- Assign a priority to each issue: `P0` (broken functionality, security), `P1` (blocks other work, significant gap, or
  tightens the LLM feedback loop), `P2` (clear improvement, moderate impact), `P3` (nice-to-have, minor polish).
- If the repository already appears to use the label "${BACKLOG_LABEL}", you may include it in labels. If not, omit it.
- Every issue must include a `context` field that explains the broader motivation — what is currently broken, missing,
  or suboptimal, and why fixing it matters. Write enough that an implementer unfamiliar with the repository can
  understand the problem.
- Every issue must include `affected_files` as an array of objects with `path`, optional `line`, and `note` fields
  listing the repository-relative paths that need modification.
- Every issue must include at least one `not_in_scope` item that prevents the implementer from expanding beyond the
  intended work.
- Write `requirements` as acceptance criteria describing what must be true when the work is done.
- Write `verification_commands` as shell commands that prove the requirements are met. Every issue should have at least
  one verification command.
- Write `evidence` as an array of objects with `location` (specific `file:line` references or issue numbers) and
  `observation` (what was found there), not prose descriptions.
- If an issue depends on another open issue being resolved first, include those issue numbers in `depends_on`.
- If `.github/ISSUE_TEMPLATE/` exists, read its templates. When a template is relevant to an issue, fill it in and
  return the completed markdown as the `body` field. For YAML issue forms (`.yml`), render the form's labeled sections
  as markdown. Omit `body` when no repository template applies.
- If there is no worthwhile work to enqueue, return an empty issues array.

Return only structured output matching the provided JSON schema.
