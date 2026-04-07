Repository: ${GITHUB_REPOSITORY}
Workflow run: https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}

Create or refresh a small, high-signal implementation queue for this repository.

Requirements:
- Read the repository before opening issues. Start with README, docs, manifests, and obvious entrypoints.
- Review existing open issues so you do not create duplicates.
- Create at most ${QUEUE_MAX_ISSUES} new issues or issue updates.
- Prefer bounded work that fits in one pull request.
- If a `spec/` directory exists, read its `.md` files first. These are product specifications — create issues that implement what they describe.
- Beyond specs, good candidates include: missing tests, broken docs, clear bugs, consistency fixes, automation gaps, or small follow-up work.
- Avoid vague roadmap items, speculative rewrites, or work that depends on product decisions not present in the repo or its specs.
- If the repository already appears to use the label "${BACKLOG_LABEL}", you may include it in labels. If not, omit it.
- If there is no worthwhile work to enqueue, return an empty issues array.

Return only structured output matching the provided JSON schema.
