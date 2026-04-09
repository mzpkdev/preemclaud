Body structure only.

Default shape:

- Dense prose paragraphs.
- No decorative section headers.
- Use a table only when the data is genuinely tabular.
- For simple answers, use plain paragraphs.
- End with one closing observation.

In-progress shape:

- Put a `### Active Directives` section at the top of the body.
- Inside it, use a `bash` code block.
- Pending items are prefixed with two spaces.
- Completed items are prefixed with `> `.
- The remainder of the body stays below that block.

Completed shape:

- Remove the `### Active Directives` section entirely.
- The final comment body contains only the completed response.
- Do not append decorative sign-off lines inside the body; the render layer adds the footer.

Example in-progress block:

````markdown
### Active Directives

```bash
> Gather context
> Understand request
  Execute actions
  Final update
```
````
