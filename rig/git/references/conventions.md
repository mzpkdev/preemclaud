# Commit Conventions

How to detect and follow a repo's commit style.

## Detect the convention

1. Run `git log --oneline -20` to sample recent commits
2. Look for patterns:
   - **Prefix style**: `feat:`, `fix:`, `[FEAT]`, or freeform
   - **Scope usage**: `feat(auth):` vs plain `feat:`
   - **Casing**: lowercase (`add login`) vs capitalized (`Add login`)
   - **Tense**: imperative (`add login`) vs past (`added login`)
   - **Ticket references**: prefix `PROJ-123:`, suffix `(#123)`, or none
   - **Body style**: single-line, bullets, paragraphs

3. If >60% of recent commits follow a clear pattern → match it
4. If mixed or no pattern → default to: `type(scope): message`, imperative tense, lowercase

## Infer the commit type

Always infer from the diff content, not the branch name. A `fix/` branch can contain refactors.

| Type | When to use |
|------|-------------|
| `feat` | New functionality, new files with business logic |
| `fix` | Bug fixes, error corrections |
| `refactor` | Restructuring without behavior change |
| `test` | Test additions or modifications |
| `docs` | Documentation, README, comments |
| `chore` | Config, tooling, dependencies |
| `ci` | CI/CD pipeline changes |
| `style` | Formatting, whitespace, linting |
| `perf` | Performance improvements |

## Infer the scope

1. Check the current branch name for a ticket pattern:
   - Jira-style: `[A-Z]+-\d+` (e.g., `PROJ-123`, `BUG-456`)
   - GitHub-style: `#\d+`
2. If ticket found → use it as scope: `feat(PROJ-123): ...`
3. If no ticket → infer from the primary area being changed: `auth`, `api`, `ui`, `deps`, `ci`, `docs`
4. If changes span many areas → omit scope or use a broad one

## Writing good messages

- Lead with what changed and why, not how
- Imperative mood: "add login validation" not "added login validation"
- Keep the first line under 72 characters
- For multi-line bodies: use bullet points summarizing key changes
