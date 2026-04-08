Queue planning guidance:

- Favor missing tests, small bugs, docs inconsistencies, automation gaps, and follow-up cleanup.
- Avoid roadmap items, broad rewrites, or work requiring product direction absent from the repository.
- When refreshing an existing issue, preserve its intent and tighten it with clearer requirements and file references.
- List every file that needs modification in `affected_files` — the implementer should not need to search for targets.
- Write `requirements` that an automated agent can verify by running a command or inspecting output.
- Always include `not_in_scope` items to prevent the implementer from expanding the change beyond its intended boundary.
