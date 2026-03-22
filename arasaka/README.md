# Arasaka

A GitHub Action that wraps [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action) and exposes `system_prompt` as a first-class input — giving you full control over Claude's behavior without touching upstream code.

## Concept

Upstream's action hardcodes a 40KB behavioral preamble that tells Claude how to think, format responses, and structure its work. There's no official way to replace it — only `custom_instructions`, which appends text after the preamble rather than replacing it.

Arasaka solves this by keeping the entire GitHub infrastructure layer (GraphQL data fetching, MCP servers, branch management, comment tracking) while swapping out the one thing that matters: the prompt. Our custom prompt builder writes only structured context data — PR body, comments, changed files, branch names — and leaves all behavioral instructions to `system_prompt`.

```yaml
- uses: mzpkdev/preemclaud/arasaka@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
    system_prompt: |
      You are a terse code reviewer. Focus on correctness and security.
      Never suggest stylistic changes. Be blunt.
```

## Architecture

```
arasaka/
├── upstream/              ← git submodule (anthropics/claude-code-action)
│   └── src/
│       ├── github/        ← GraphQL fetching, branch ops, comment management
│       ├── mcp/           ← MCP servers (comment, file-ops, inline-comments, actions)
│       ├── modes/         ← tag mode / agent mode orchestration
│       └── entrypoints/   ← cleanup, post-inline-comments
├── src/
│   ├── entrypoints/
│   │   └── run.ts         ← custom entrypoint (replaces upstream's run.ts)
│   └── prompt/
│       └── index.ts       ← data-only prompt builder (replaces upstream's create-prompt)
├── scripts/
│   └── build.ts           ← bundles everything for the v1 orphan branch
└── action.yml             ← composite action definition
```

### The submodule

`upstream/` is a pinned checkout of `anthropics/claude-code-action`. It provides everything except the prompt and the top-level entrypoint, both of which Arasaka overrides:

| Upstream file | Status | Reason |
|---|---|---|
| `src/create-prompt/index.ts` | Replaced by `src/prompt/index.ts` | Contains the 40KB behavioral preamble |
| `src/entrypoints/run.ts` | Replaced by `src/entrypoints/run.ts` | Calls `createPrompt` — can't be imported around it |
| Everything else | Used as-is | GitHub API layer, MCP servers, SDK runner |

To update the upstream pin:

```bash
cd arasaka/upstream
git fetch origin
git checkout <new-tag-or-sha>
cd ../..
git add arasaka/upstream
git commit -m "chore(arasaka): bump upstream to <version>"
```

### The v1 branch

`uses: mzpkdev/preemclaud/arasaka@v1` resolves to the `v1` orphan branch, which holds pre-built bundles so consumers pay zero runtime overhead (no `bun install`, no TypeScript compilation).

The release workflow (`.github/workflows/release-arasaka.yml`) runs automatically on every push to `main` that touches `arasaka/`. It:

1. Bundles `src/entrypoints/run.ts` → `run.js`
2. Bundles each MCP server separately (they're spawned as child processes — must be separate files)
3. Patches `action.yml` to point at the bundled paths and strips the `bun install` step
4. Force-pushes an orphan commit to the `v1` branch under `arasaka/`

The v1 branch layout mirrors what GitHub expects for `uses: .../arasaka@v1`:

```
arasaka/
├── action.yml
├── run.js
├── src/
│   ├── mcp/           ← bundled MCP servers (.ts extension kept for path compat)
│   └── entrypoints/   ← cleanup + post-inline-comments
└── scripts/
    └── git-push.sh
```

## Usage

```yaml
- uses: mzpkdev/preemclaud/arasaka@v1
  with:
    # Required: one of these
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    claude_code_oauth_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}

    # The whole point
    system_prompt: |
      Your instructions here. This is the complete behavioral contract —
      no upstream preamble will be injected before or after it.

    # Optional: skip Claude Code reinstall (useful with preemclaud)
    path_to_claude_code_executable: ${{ env.CLAUDE_BIN }}
```

All other inputs (`trigger_phrase`, `base_branch`, `branch_prefix`, `use_commit_signing`, etc.) are pass-throughs to upstream — see `action.yml` for the full list.

### With preemclaud

If the calling repo has preemclaud installed on the runner, pass its binary directly to skip the default Claude Code install step:

```yaml
- name: Install preemclaud
  run: |
    npm install -g @anthropic-ai/claude-code
    curl -fsSL https://raw.githubusercontent.com/mzpkdev/preemclaud/main/install.sh | bash
    echo "CLAUDE_BIN=$(which claude)" >> $GITHUB_ENV

- uses: mzpkdev/preemclaud/arasaka@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
    path_to_claude_code_executable: ${{ env.CLAUDE_BIN }}
    system_prompt: ...
```

This is required when your settings use preemclaud-specific model names — the stock binary won't recognize them and will exit immediately.
