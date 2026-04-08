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
- Every issue must include `affected_files` listing the repository-relative paths that need modification, with a brief
  note on each explaining what changes there.
- Every issue must include at least one `not_in_scope` item that prevents the implementer from expanding beyond the
  intended work.
- Write `requirements` as verifiable outcomes. Prefer items checkable by a shell command where possible.
- Write `evidence` as specific `file:line` references or issue numbers, not prose descriptions.
- If `.github/ISSUE_TEMPLATE/` exists, read its templates. When a template is relevant to an issue, fill it in and
  return the completed markdown as the `body` field. For YAML issue forms (`.yml`), render the form's labeled sections
  as markdown. Omit `body` when no repository template applies.
- If there is no worthwhile work to enqueue, return an empty issues array.

Return only structured output matching the provided JSON schema.
