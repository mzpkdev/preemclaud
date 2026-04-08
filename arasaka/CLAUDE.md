# Arasaka — Codebase Index

Custom GitHub Action wrapping `anthropics/claude-code-action`. Exposes `system_prompt` as a first-class input, giving
full control over Claude's behavior without forking upstream. Operates in four automation modes (queue, develop, review,
maintain) with branded UI, structured JSON output, and template-driven publishing.

## Directory Map

```
arasaka/
  action.yml                       # composite action definition — all inputs/outputs live here
  upstream/                        # git submodule: anthropics/claude-code-action (pinned tag)
  src/                             # custom TypeScript implementation
    entrypoints/
      run.ts                       # main orchestrator — replaces upstream's run.ts
      update-comment-link.ts       # post-execution comment finalizer
    config/
      defaults.ts                  # hardcoded constants (persona, templates, prompts)
      prompt-registry.ts           # builds system_prompt by mode (currently: "comment")
      assets.ts                    # CDN base URL for SVG assets
    prompt/
      index.ts                     # data-only prompt builder (replaces upstream's create-prompt)
      tooling.ts                   # renders <tooling> block (git, PR, commit-signing instructions)
    github/
      comment-logic.ts             # comment body update logic (strip markers, add headers)
      comment-logic.test.ts        # tests
    publish/
      index.ts                     # dispatcher — routes to mode-specific publisher
      contracts.ts                 # Zod schemas for all four modes' structured output
      contracts.test.ts            # tests
      queue.ts                     # creates GitHub issues from structured output
      develop.ts                   # creates PR + issue comment from structured output
      develop.test.ts              # tests
      review.ts                    # posts review comment + check run from structured output
      review.test.ts               # tests
      maintain.ts                  # executes maintenance actions (warn, close, label)
    render/
      template.ts                  # generic template rendering utilities
      chrome.ts                    # artifact wrapper (banner + divider + content + footer)
      issue.ts                     # renders queue issue body
      pull-request.ts              # renders develop PR body
      issue-comment.ts             # renders develop issue comment
      review.ts                    # renders review comment
      maintain.ts                  # renders maintain action messages
      renderers.test.ts            # tests
    types/
      markdown.d.ts                # type declarations for .md imports
  content/                         # single source of truth for all text
    shared/
      persona.md                   # institutional tone and voice definition
    prompt/                        # tag-mode (comment-triggered) prompt pieces
      persona.md                   # persona for prompt context
      format.md                    # output structure rules
      scenarios.md                 # GitHub event pattern guidance
      instructions.md              # behavioral policy
      tooling/                     # technical instructions injected into <tooling> block
        common.md                  # shared tool rules
        git.md                     # branch/commit/push workflow
        pr.md                      # PR creation guidance
        commit-signing.md          # API-based commit signing
    presets/{queue,develop,review,maintain}/  # agent-mode prompt bundles (one per mode)
      prompt.md                    # user prompt template
      format.md                    # output structure for this mode
      scenarios.md                 # event patterns for this mode
      instructions.md              # behavioral policy for this mode
      schema.json                  # JSON Schema for structured output validation
      allowed-tools.txt            # tool whitelist for Claude
      max-turns.txt                # turn budget
    comments/                      # comment lifecycle templates
      states/initial.md            # spinner comment posted at start
      templates/
        comment.md                 # final comment wrapper
        header-success.md          # "STATUS: FULFILLED" header
        header-failure.md          # failure header
    artifacts/{issue,issue-comment,pull-request,review,maintain}/templates/
      body.md                      # body template for each artifact type
      (mode-specific variants)     # e.g. comment-clear.md, comment-findings.md, warn.md, close.md
  actions/{queue,develop,review,maintain}/
    action.yml                     # preset composite action — generates prompt + system_prompt + args
  workflows/
    queue.yml                      # reusable workflow: autonomous issue creation
    develop.yml                    # reusable workflow: issue implementation (issue -> PR)
    review.yml                     # reusable workflow: automatic PR review
    maintain.yml                   # reusable workflow: stale issue management
  scripts/
    build.ts                       # bundles src/ -> dist/ for v1 branch (esbuild)
    write_preset.py                # assembles preset from content/ markdown files -> GitHub Actions outputs
  assets/                          # SVG brand assets (banner, divider, footer, icons)
```

## Architecture

### Execution Modes

The action runs in two contexts:

- **Tag mode** (event-triggered): a user writes `@arasaka` in an issue/PR comment. `run.ts` detects the entity context,
  builds a data-only prompt with `buildPrompt()`, and uses the `"comment"` system prompt from `prompt-registry.ts`.
- **Agent mode** (automation): a scheduled or dispatched workflow calls a preset action (`actions/{mode}/action.yml`).
  `write_preset.py` assembles `system_prompt` + `prompt` + `args` from `content/presets/{mode}/` files. Claude returns
  structured JSON validated by Zod schemas in `contracts.ts`, then `publishStructuredOutput()` routes to the
  mode-specific publisher.

### Data Flow

```
GitHub Event
  |
  v
run.ts  -->  detectMode + setupGitHubToken + parseGitHubContext
  |
  +--[tag mode]--> buildPrompt() --> formatters (upstream) --> claude-prompt.txt
  |                                  buildToolingBlock() --> content/prompt/tooling/
  |
  +--[agent mode]--> write_preset.py --> system_prompt + prompt from content/presets/
  |
  v
runClaude() (upstream SDK)
  |
  v
publishStructuredOutput()  -->  Zod parse  -->  render/{mode}.ts  -->  GitHub API
  |
  v
updateCommentLink()  -->  finalize comment with status header + links
```

### Key Design Decisions

1. **Behavioral/contextual separation**: `system_prompt` carries all behavioral instructions (persona, format,
   scenarios, policy). The user prompt carries only data (entity context, comments, diff, trigger). This lets presets
   swap behavior without touching prompt construction.

1. **Upstream as submodule**: `run.ts` and `prompt/index.ts` replace their upstream counterparts. Everything else
   (GitHub API layer, MCP servers, branch ops, formatters) is imported directly from `upstream/`.

1. **Content as source of truth**: All prose lives in `content/*.md`. TypeScript imports these as strings via
   `markdown.d.ts` type declarations. No behavioral text is hardcoded in `.ts` files.

1. **Single comment lifecycle**: One comment per execution. Posted immediately with a spinner, updated in-progress, then
   finalized with status header (success/failure), duration, cost, and links.

### Upstream Relationship

`upstream/` is a git submodule pinned to a specific tag of `anthropics/claude-code-action`. Arasaka overrides:

- `run.ts` (entrypoint) — custom orchestration, system prompt injection
- `create-prompt/index.ts` (prompt builder) — data-only prompt, no behavioral preamble

All other upstream code is used as-is via direct imports from `../../upstream/src/`.

### Build & Distribution

- **Dev** (`main` branch): source in `src/` and `content/`, requires `bun install`
- **Release** (`v1` orphan branch): `scripts/build.ts` bundles everything into `dist/`, MCP servers inlined, no
  submodule needed. Triggered by pushes to `main` that touch `arasaka/`.

## Where to Find Things

| Looking for...                     | Go to                                 |
| ---------------------------------- | ------------------------------------- |
| Action inputs/outputs              | `action.yml`                          |
| Main execution logic               | `src/entrypoints/run.ts`              |
| System prompt assembly             | `src/config/prompt-registry.ts`       |
| User prompt construction           | `src/prompt/index.ts`                 |
| Git/PR/signing instructions        | `content/prompt/tooling/`             |
| Mode-specific behavior (presets)   | `content/presets/{mode}/`             |
| Structured output schemas          | `src/publish/contracts.ts`            |
| Publishing logic (JSON -> GitHub)  | `src/publish/{mode}.ts`               |
| Template rendering                 | `src/render/{target}.ts`              |
| Artifact body templates            | `content/artifacts/{type}/templates/` |
| Comment templates + headers        | `content/comments/`                   |
| Branded UI wrapper (banner/footer) | `src/render/chrome.ts`                |
| SVG assets                         | `assets/`                             |
| Reusable workflows for consumers   | `workflows/`                          |
| Preset composite actions           | `actions/{mode}/action.yml`           |
| Preset builder script              | `scripts/write_preset.py`             |
| Release bundler                    | `scripts/build.ts`                    |
| Persona / tone of voice            | `content/shared/persona.md`           |
| Tests                              | `*.test.ts` co-located with source    |
