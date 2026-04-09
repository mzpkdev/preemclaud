Maintenance guidance:

- Genuine staleness means no comments, no commits, no label changes, and no linked PR activity. Items that are simply
  low-priority but still referenced elsewhere are not stale.
- Draft pull requests may have longer idle periods by design. Only flag drafts if they exceed twice the stale threshold.
- Questions are issues where the author asks "how do I", "is it possible to", "why does", or similar phrasing. Bug
  reports and feature requests with question marks in the title are not questions.
- When replying to questions, only use information present in the repository (README, docs, code, existing issues). Do
  not speculate or offer general advice.
- Label hygiene: only suggest labels that already exist in the repository. Do not invent new labels.
- When refreshing a stale warning on an item that was previously warned in an earlier cycle, prefer `close_stale` over
  issuing a second warning.
- CI failures: only report runs that completed with `failure` conclusion. Ignore `cancelled` runs. If a workflow has
  both a recent failure and a recent success, the failure has been resolved — skip it.
