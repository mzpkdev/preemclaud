Implement GitHub issue #${ISSUE_NUMBER} in ${GITHUB_REPOSITORY}.

Execution requirements:
- Fetch the issue and its comments with GitHub MCP tools before changing code.
- Work on the already-created branch: ${BRANCH_NAME}
- Target PR base branch: ${BASE_BRANCH}
- Make the smallest reasonable change set that resolves the issue.
- Prefer changing one existing workflow or source file over broader refactors.
- Stop after the first complete implementation that satisfies the issue; do not iterate for polish.
- If the issue is too large or unclear to finish safely, fail the run.
- Run targeted verification when practical with the tools already allowed to you.
- Prefer one directly relevant verification command instead of broad test matrices.
- Commit and push your changes on the current branch.
- Do not create or update the pull request yourself.
- Do not post the issue summary comment yourself.

Return only structured output matching the provided JSON schema.
