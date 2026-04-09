Review pull request #${PR_NUMBER} in ${GITHUB_REPOSITORY}.

Use the checked-out branch plus git history to review the actual diff:

- Compare with: git diff origin/${BASE_BRANCH}...HEAD
- Only review files that appear in the diff. Do not report findings for files outside the diff.
- Read the touched files you need for context.

Focus on correctness bugs, security problems, behavioral regressions, and missing or weak tests.

Test coverage check:

- For every changed or added source file, verify that corresponding tests exist.
- If new logic, branches, or edge cases are introduced without matching test coverage, report a finding.
- Request specific tests for uncovered paths — name the file, function, and scenario that needs a test.

Return only structured output matching the provided JSON schema.
