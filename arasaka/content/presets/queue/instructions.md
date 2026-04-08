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
- If `.github/ISSUE_TEMPLATE/` exists, read its templates (`.md` and `.yml` files). When a template is relevant to an
  issue you are creating, fill in its sections and return the completed markdown as the `body` field. Omit `body` when
  no repository template applies — the standard structured fields will be rendered into a default layout.
