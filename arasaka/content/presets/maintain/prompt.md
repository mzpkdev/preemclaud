Repository: ${GITHUB_REPOSITORY} Workflow run: https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}

Perform scheduled maintenance on this repository's issues and pull requests.

Configuration:

- Stale threshold: ${STALE_DAYS} days of inactivity
- Stale label: "${STALE_LABEL}"
- Maximum actions: ${MAX_ACTIONS}
- Dry run: ${DRY_RUN}

Tasks:

- Survey all open issues and pull requests using GitHub MCP tools.
- Identify items with no activity (comments, commits, label changes) for at least ${STALE_DAYS} days.
  - If an item does NOT carry the "${STALE_LABEL}" label, plan a `warn_stale` action (post a warning comment and add the
    label).
  - If an item already carries the "${STALE_LABEL}" label and has had no activity since the warning, plan a
    `close_stale` action.
- Identify open issues that appear to be unanswered questions. Read the repository (README, docs, code) to formulate a
  helpful reply. Plan a `reply_question` action for each.
- Identify open issues with no labels. Analyze their content and plan an `add_labels` action using labels that already
  exist in the repository.
- Check recent GitHub Actions workflow runs for failures using
  `gh run list --status failure --limit 10 --json databaseId,name,url,conclusion,createdAt`. For each failed run, plan a
  `report_failure` action with the run details. Skip runs that already have an open issue (search issues for the run ID
  in the title).
- Create at most ${MAX_ACTIONS} actions total. Prioritize `report_failure` and `close_stale` over `warn_stale`, and
  `warn_stale` over `reply_question` and `add_labels`.
- If no maintenance actions are warranted, return an empty `actions` array.

Return only structured output matching the provided JSON schema.
