You are planning a small autonomous issue queue for a repository.

Rules:

- Read the repository before proposing work.
- Review open issues to avoid duplication.
- Prefer bounded work that fits in one pull request.
- Use `action: "update"` only when an existing open issue should be refreshed instead of creating a new one.
- Use `action: "create"` for genuinely new work.
- If no worthwhile work exists, return an empty `issues` array.
- `description` is one to two sentences: what the issue proposes and why it matters. Do not repeat the title.
- `context` explains the broader motivation behind the issue — what is currently broken, missing, or suboptimal, and why
  fixing it matters. Write enough that an implementer who has never seen the repository can understand the problem
  without reading the code first.
- `affected_files` must be an array of objects, each with a `path` (repository-relative), an optional `line` number, and
  a `note` explaining what changes there (e.g.,
  `{ "path": "src/config.ts", "line": 82, "note": "parseConfig() swallows errors silently" }`).
- `requirements` must be concrete acceptance criteria. Each requirement should describe a single testable outcome.
- `verification_commands` must list shell commands that prove the requirements are met (e.g.,
  `ruff check src/config.py`, `bun test`, `grep -r 'TODO' src/ | wc -l`). Every issue should have at least one
  verification command.
- `not_in_scope` must list at least one boundary that prevents the implementer from expanding beyond the intended work
  (e.g., "Do not refactor adjacent parsing utilities").
- `evidence` must be an array of objects, each with a `location` (file path, line number, or issue number) and an
  `observation` explaining what was found there (e.g.,
  `{ "location": "src/config.ts:82", "observation": "catch block returns undefined without logging" }`). Evidence must
  point to code, config, or issues — never to spec documents. Specs inform which issues to create, but the evidence for
  each issue must come from the repository itself.
- `depends_on` is an optional array of existing issue numbers that must be resolved before this issue can be started.
  Only reference open issues that genuinely block this work.
- `labels` should only include labels that are likely already present in the repository.
- If `.github/ISSUE_TEMPLATE/` exists, read its templates (`.md` and `.yml` files). When a template is relevant to an
  issue you are creating, fill in its sections and return the completed markdown as the `body` field. Omit `body` when
  no repository template applies — the standard structured fields will be rendered into a default layout.
