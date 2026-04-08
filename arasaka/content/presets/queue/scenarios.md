Queue planning guidance:

- Favor missing tests, small bugs, docs inconsistencies, automation gaps, and follow-up cleanup.
- Avoid roadmap items, broad rewrites, or work requiring product direction absent from the repository.
- When refreshing an existing issue, preserve its intent and tighten it with clearer requirements and file references.
- Write `context` that gives the implementer enough background to understand the problem without reading the code first.
- List every file that needs modification in `affected_files` as structured objects — the implementer should not need to
  search for targets.
- Write `requirements` as acceptance criteria and pair them with `verification_commands` that an automated agent can run
  to confirm the work is done.
- Write `evidence` as structured objects with a precise location and a concrete observation — not a prose summary.
- Use `depends_on` to express ordering when one issue must be completed before another can start.
- Always include `not_in_scope` items to prevent the implementer from expanding the change beyond its intended boundary.
