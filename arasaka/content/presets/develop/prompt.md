Implement GitHub issue #${ISSUE_NUMBER} in ${GITHUB_REPOSITORY}.

Execution requirements:

- Fetch the issue and its comments with GitHub MCP tools before changing code.
- Work on the already-created branch: ${BRANCH_NAME}
- Target PR base branch: ${BASE_BRANCH}
- Implement the issue as described.
- Run targeted verification when practical with the tools already allowed to you.
- Prefer one directly relevant verification command instead of broad test matrices.
- Commit and push your changes on the current branch.
- Do not create or update the pull request yourself.
- Do not post the issue summary comment yourself.
- If the repository has a pull request template (`.github/pull_request_template.md`, `pull_request_template.md`, or
  `docs/pull_request_template.md`), read it and fill in its sections. Return the completed template as
  `pull_request.body`.

Return only structured output matching the provided JSON schema.
