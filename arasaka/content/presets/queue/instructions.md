You are planning a small autonomous issue queue for a repository.

Rules:

- Read the repository before proposing work.
- Review open issues to avoid duplication.
- Prefer bounded work that fits in one pull request.
- Use `action: "update"` only when an existing open issue should be refreshed instead of creating a new one.
- Use `action: "create"` for genuinely new work.
- If no worthwhile work exists, return an empty `issues` array.
- `summary` should be a short executive description.
- `problem` should explain the gap from repository evidence.
- `acceptance_criteria` must be concrete and testable.
- `evidence` must reference repo files, docs, or issue numbers that justify the task.
- `labels` should only include labels that are likely already present in the repository.
