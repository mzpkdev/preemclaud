---
description: "Use this skill for connecting external services to Claude Code, managing MCP (Model Context Protocol) servers, or choosing between MCP and CLI tools. ALWAYS trigger when: the user says 'connect', 'hook up', or 'integrate' a service like Jira, Slack, Sentry, Grafana, Notion, Stripe, or any tool into Claude; any mention of 'MCP' including setup, troubleshooting, timeouts, or auth problems; questions like 'is there an MCP for X' or 'MCP vs CLI'; or /mcp references. NEVER trigger for writing application code, building bots, creating deployments, or setting up new coding projects — even if they mention services by name, those are programming tasks."
user-invocable: true
disable-model-invocation: false
---

# Connect MCP

Help users connect Claude Code to external tools via MCP servers, manage existing connections, and recommend CLI alternatives when they're the better choice.

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `setup:mcp` online. Establishing uplink.

## Steps

### Quick reference: `claude mcp` commands

```bash
# Add servers
claude mcp add --transport http <name> <url>              # HTTP (recommended for remote)
claude mcp add --transport sse <name> <url>               # SSE (deprecated, use HTTP)
claude mcp add [options] <name> -- <command> [args...]     # stdio (local processes)
claude mcp add-json <name> '<json>'                        # From JSON config
claude mcp add-from-claude-desktop                         # Import from Claude Desktop

# Manage servers
claude mcp list                          # List all configured servers
claude mcp get <name>                    # Details for a specific server
claude mcp remove <name>                 # Remove a server
claude mcp reset-project-choices         # Reset approval choices for project-scoped servers

# Inside Claude Code
/mcp                                     # Check status, authenticate OAuth servers
```

### Option ordering

All flags (`--transport`, `--env`, `--scope`, `--header`) go **before** the server name. Use `--` to separate the name from the command/args for stdio servers:

```bash
claude mcp add --transport stdio --env KEY=value myserver -- npx -y some-package
```

### Scopes

| Scope | Flag | Stored in | Shared? | Use when |
|-------|------|-----------|---------|----------|
| `local` | `--scope local` (default) | `~/.claude.json` | No | Personal dev servers, sensitive creds |
| `project` | `--scope project` | `.mcp.json` (repo root) | Yes (via git) | Team-shared servers |
| `user` | `--scope user` | `~/.claude.json` | No | Personal tools across all projects |

### Auth options

```bash
# Bearer token
claude mcp add --transport http my-api https://api.example.com/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"

# API key header
claude mcp add --transport http my-api https://api.example.com/mcp \
  --header "X-API-Key: YOUR_KEY"

# OAuth (interactive — authenticate after adding via /mcp)
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
# then run /mcp inside Claude Code to complete OAuth flow

# Pre-configured OAuth credentials
claude mcp add --transport http my-server https://mcp.example.com/mcp \
  --client-id YOUR_CLIENT_ID --client-secret --callback-port 8080

# Environment variables for stdio servers
claude mcp add --transport stdio --env API_KEY=xxx myserver -- npx -y some-package
```

### Admin access warnings

Some tools require tokens that only an admin or org owner can create. When recommending these tools, check `references/tool-catalog.md` § Admin Access Warnings for the full breakdown of hard blocks, partial blocks, and self-serve tools.

### Environment & tuning

```bash
MCP_TIMEOUT=10000 claude             # 10s startup timeout (default is lower)
MAX_MCP_OUTPUT_TOKENS=50000 claude   # Increase output limit (default 25k, warns at 10k)
ENABLE_TOOL_SEARCH=auto claude       # Auto-enable tool search when many MCP tools loaded
```

---

### Decision guide: MCP vs CLI

When a user asks to connect a tool, first check if a CLI alternative is better. The right choice depends on whether the CLI is mature, covers the needed operations, and is simpler to set up.

### Use MCP when

- No good CLI exists (Confluence, Notion, Slack messaging)
- The MCP provides richer structured access than the CLI (Atlassian Jira with JQL, transitions, metadata)
- OAuth-based auth is easier than managing API tokens (Sentry issue querying, GitHub for non-technical users)
- The user explicitly wants MCP

### Use CLI when

- The CLI is the industry standard tool (Docker, kubectl, terraform, git, aws, gcloud)
- The CLI is mature and official (gh, vercel, supabase, stripe)
- Claude Code can already do the job with built-in tools (file ops, git, web fetch)
- Setup is simpler with the CLI (no OAuth dance, just install + env var)

### Tool-by-tool recommendations

Read `references/tool-catalog.md` for the complete tool catalog — MCP vs CLI recommendations, install commands, and the full MCP server quick-install catalog. Use it to look up specifics when recommending a tool. Don't load it into the conversation unless you need to check a detail.

---

## Rules

1. **Always use CLI commands** (`claude mcp add`), never edit JSON config files directly
2. **Recommend CLI tools over MCP** when the CLI is mature and covers the use case — MCP adds overhead and complexity that isn't always worth it
3. **Ask before acting** — confirm the user's intent (which service, what scope, what auth) before running commands

## Edge cases

### Server won't start
```bash
# Check server status
claude mcp get <name>

# Inside Claude Code — see all servers and their status
/mcp

# Increase startup timeout
MCP_TIMEOUT=10000 claude

# Windows: wrap npx with cmd /c
claude mcp add --transport stdio my-server -- cmd /c npx -y @some/package
```

### Authentication issues
```bash
# Re-authenticate OAuth servers
/mcp  # then select the server and choose "Authenticate"

# Clear and re-authenticate
/mcp  # select "Clear authentication", then authenticate again

# If browser redirect fails after OAuth — paste the full callback URL from browser into Claude Code
```

### Output too large
```bash
# Increase token limit for large MCP outputs
MAX_MCP_OUTPUT_TOKENS=50000 claude
```

### Server conflicts
```bash
# List all to find duplicates
claude mcp list

# Remove and re-add
claude mcp remove <name>
claude mcp add ...

# Reset project-scoped server approvals
claude mcp reset-project-choices
```

### Tool search (too many MCP tools loaded)
```bash
# Auto-enable (default) — kicks in when tools exceed 10% of context
ENABLE_TOOL_SEARCH=auto claude

# Custom threshold
ENABLE_TOOL_SEARCH=auto:5 claude

# Force on/off
ENABLE_TOOL_SEARCH=true claude
ENABLE_TOOL_SEARCH=false claude
```
