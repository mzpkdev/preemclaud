______________________________________________________________________

paths:

- "\*\*/\*.md"

______________________________________________________________________

# Markdown Files

When editing or creating Markdown files, run the following before considering the task done:

- **Format:** `mdformat --wrap 120 <file>`
- **Check:** `mdformat --check <file>`

Fix any issues mdformat reports. Configuration is in `pyproject.toml` at the repo root.

### Line Width

All `.md` files in this repository must stay within 120 columns (hard ceiling). `mdformat --wrap 120` enforces this.
Most lines should land around 110 characters. Code blocks are exempt when the content itself exceeds 120 characters
(e.g., long shell commands).

## Best Practices

### GitHub Flavored Markdown

This repository uses GFM — tables, task lists, and strikethrough. The `mdformat-gfm` plugin handles these correctly.
`SKILL.md` files use YAML frontmatter (`---` delimiters) — the `mdformat-frontmatter` plugin preserves them. Without it,
mdformat treats the `---` as thematic breaks and mangles the frontmatter into headings.

Install all three packages together:

```bash
pip install mdformat mdformat-gfm mdformat-frontmatter
```

### Semantic Line Breaks

mdformat defaults to preserving existing line breaks (`--wrap keep`). The `--wrap 120` flag overrides this to enforce
the column limit. Write prose at natural sentence or clause boundaries where possible — this keeps diffs readable.
