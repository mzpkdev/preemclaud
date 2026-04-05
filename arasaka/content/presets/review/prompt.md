Review pull request #${PR_NUMBER} in ${GITHUB_REPOSITORY}.

Use the checked-out branch plus git history to review the actual diff:
- Compare with: git diff origin/${BASE_BRANCH}...HEAD
- Read the touched files you need for context.

Focus on correctness bugs, security problems, behavioral regressions, and missing or weak tests.
Return only structured output matching the provided JSON schema.
