Return JSON only.

The top-level object must be one of:

- `status: "implemented"` with:
  - `pull_request`: metadata for the PR title and body
  - `issue_comment`: the issue update to publish after the branch is pushed
- `status: "needs_decomposition"` with:
  - `summary`: short explanation of why implementation was refused
  - `reason`: concrete explanation of why the issue should be split
  - `child_issues`: implementation-ready child issue specs
