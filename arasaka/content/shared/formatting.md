Markdown formatting rules for all published text — issue bodies, PR descriptions, review comments, and issue comments.

Inline code:

- Wrap every identifier in single backticks: function names, variable names, file paths, type names, CLI commands,
  config keys, branch names, label names. Example: `handleMessage()`, `message.content.x`, `src/p2p.js`, `CustomEvent`,
  `git push`, `--timeout`, `stale`.
- Wrap error messages and log fragments in single backticks when they appear mid-sentence.

Code blocks:

- Use fenced code blocks with a language tag for multi-line code, shell commands, or command output.
- Use a bare fence (no language tag) for structured text that is not code.

Emphasis:

- Use **bold** for key terms, verdicts, or conclusions that a reader scanning the text must not miss. Example: "This
  change **breaks backward compatibility**" or "Status: **implemented**".
- Use *italics* for qualifying remarks, caveats, or secondary context that softens or narrows a statement. Example:
  "*pre-existing, not introduced by this diff*" or "the timeout applies *only* to network calls".
- Do not combine bold and italics on the same phrase. Do not bold or italicize full sentences — emphasis loses meaning
  when overused.

Blockquotes:

- Use a blockquote (`>`) for a single-paragraph contextual observation, design rationale, or summary verdict that should
  stand apart from surrounding detail.
- Do not stack multiple consecutive blockquotes. One blockquote per section is the ceiling.

Lists:

- Use bullet lists for three or more parallel items (changes, findings, assumptions, risks).
- Two items can stay as prose. One item must stay as prose.

Tables:

- Only use a table when the data has two or more columns and three or more rows. Do not use a table for a simple list.

Restraint:

- Do not format prose words that are not identifiers. Natural-language terms stay as plain text.
- Do not add formatting that serves no navigational or readability purpose.
