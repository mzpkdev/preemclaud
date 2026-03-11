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

## Core principles

1. **Always use CLI commands** (`claude mcp add`), never edit JSON config files directly
2. **Recommend CLI tools over MCP** when the CLI is mature and covers the use case — MCP adds overhead and complexity that isn't always worth it
3. **Ask before acting** — confirm the user's intent (which service, what scope, what auth) before running commands

## Quick reference: `claude mcp` commands

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

Some tools require tokens that only an admin or org owner can create. When recommending these tools, warn the user if they might need to involve their admin.

**Hard blocks (dev cannot self-serve at all):**

| Tool | Who can create tokens | What to tell the user |
|------|----------------------|----------------------|
| **HubSpot** | Super Admin only | Only a HubSpot Super Admin can create private apps and generate API tokens. You'll need to ask your HubSpot admin. |
| **Notion** | Workspace Owner only | Only Notion Workspace Owners can create integrations and generate API tokens. Ask your workspace admin. |
| **Grafana** | Org Admin only | Only Grafana Org Admins can create service account tokens. Ask your Grafana admin. |
| **Slack** | Workspace Owner/Admin (if app approval is enabled, which is default on Enterprise) | Your Slack workspace likely requires admin approval to install apps. Ask a Workspace Owner to approve or install the Slack app first. |

**Partial blocks (basic usage works, elevated access needs admin):**

| Tool | Self-serve | Needs admin |
|------|-----------|-------------|
| **Atlassian (Jira/Confluence)** | Personal API tokens (any user via `id.atlassian.com`) | OAuth-based integrations (like MCP servers) require Site Admin authorization |
| **Datadog** | N/A — key creation is permission-gated | API + App key creation requires `api_keys_write`/`app_keys_write` RBAC permissions (Admin role by default) |
| **Sentry** | Personal auth tokens (any user) | Org-level tokens and custom-scoped integrations require Manager or Admin role |
| **PagerDuty** | Personal user tokens (inherits user's role) | General Access API keys require Admin or Account Owner |
| **Stripe** | N/A | Developer or Administrator role in Stripe Dashboard needed to access API keys |
| **GitHub** | Classic PATs (any user) | Fine-grained PATs targeting an org may require org owner approval (depends on org policy) |
| **Databricks** | Personal access tokens (any user with CAN USE permission), OAuth U2M (interactive login) | PAT generation must be enabled by workspace admin; service principal creation requires admin |

**No admin needed:**
Jira CLI (personal API token), New Relic, Vercel, Supabase, Linear, Bugsnag — any user can create their own tokens.

### Environment & tuning

```bash
MCP_TIMEOUT=10000 claude             # 10s startup timeout (default is lower)
MAX_MCP_OUTPUT_TOKENS=50000 claude   # Increase output limit (default 25k, warns at 10k)
ENABLE_TOOL_SEARCH=auto claude       # Auto-enable tool search when many MCP tools loaded
```

---

## Decision guide: MCP vs CLI

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

#### Strongly recommend CLI over MCP

| Tool | CLI | Install | Why CLI wins |
|------|-----|---------|-------------|
| **GitHub** | `gh` | `brew install gh` | Gold standard. `gh pr`, `gh issue`, `gh api` cover everything. Already recommended in Claude Code. |
| **Git** | `git` | Built-in | Claude Code has native git support via Bash. |
| **Docker** | `docker` | `brew install docker` | Industry standard. No MCP could match it. |
| **Kubernetes** | `kubectl` | `brew install kubectl` | Industry standard. `kubectl get/describe/logs/apply` covers all workflows. |
| **Terraform** | `terraform` | `brew install terraform` | Inherently a CLI tool. `plan`, `apply`, `state`. |
| **AWS** | `aws` | `brew install awscli` | 200+ services. Nothing else comes close. |
| **GCP** | `gcloud` | `brew install --cask google-cloud-sdk` | Comprehensive official tool for all GCP services. |
| **PostgreSQL** | `psql` | `brew install postgresql` | Direct SQL via Bash. Decades-old standard. |
| **SQLite** | `sqlite3` | Pre-installed on macOS | `sqlite3 db.sqlite "SELECT ..."` — trivial. |
| **Vercel** | `vercel` | `npm i -g vercel` | Best-in-class dev CLI: deploy, logs, env, domains. |
| **Supabase** | `supabase` | `brew install supabase/tap/supabase` | Local dev, migrations, edge functions, type gen. |
| **Stripe** | `stripe` | `brew install stripe/stripe-cli/stripe` | Direct API access (`stripe get/post`), webhook forwarding, log tailing. |
| **Playwright** | `npx playwright` | `npm i -D @playwright/test` | Test runner is inherently CLI. `npx playwright test`. |

#### Strongly recommend MCP over CLI

| Tool | MCP command | Why MCP wins |
|------|-------------|-------------|
| **Notion** | `claude mcp add --transport http notion https://mcp.notion.com/mcp` | No official CLI. MCP has OAuth + full page/database CRUD. |
| **Slack** | `claude mcp add --transport http slack https://mcp.slack.com/mcp` | No CLI for messaging/searching. MCP handles send, search, read threads, create canvases. |
| **Confluence** | `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp` | No mature CLI. MCP has pages, comments, CQL search, create/update. |
| **Figma** | `claude mcp add --transport http figma https://mcp.figma.com/mcp` | No CLI. MCP is the only way to pull design context and generate code. |
| **Intercom** | `claude mcp add --transport http intercom https://mcp.intercom.com/mcp` | No CLI. MCP provides conversation/contact search. |

#### MCP is better but CLI works for basics

| Tool | MCP command | CLI alternative | Notes |
|------|-------------|-----------------|-------|
| **Jira** | `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp` | `brew install ankitpokhrel/jira-cli/jira-cli` | CLI handles basic CRUD. MCP is richer: JQL, transitions, metadata, remote links. |
| **Sentry** | `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` | `brew install sentry-cli` | `sentry-cli` is great for releases/sourcemaps but **cannot query issues**. MCP handles issue search, stack traces, analysis. Use both: CLI for builds, MCP for debugging. |
| **Linear** | `claude mcp add --transport http linear https://mcp.linear.app/mcp` | `brew install czottmann/tap/linearis` | Linearis CLI was built for LLM agents (JSON output). MCP is more complete. |
| **HubSpot** | `claude mcp add --transport http hubspot https://mcp.hubspot.com/anthropic` | No CLI | MCP only option for CRM queries. |
| **Databricks** | `claude mcp add --transport stdio databricks -- uvx databricks-mcp` | `brew tap databricks/tap && brew install databricks` | CLI covers clusters, jobs, workspace, DBFS, Unity Catalog. MCP adds structured access to Unity Catalog data, Genie spaces, and vector search. Use both: CLI for deploy/admin, MCP for data exploration. |

#### CLI is adequate, MCP optional

| Tool | CLI | MCP alternative | Notes |
|------|-----|-----------------|-------|
| **Datadog** | `pup` CLI (Go binary from datadog-labs) or `pip install datadog` (dogshell) | No official MCP | `pup` has 200+ commands: monitors, logs, metrics, incidents. `dog monitor show`, `dog metric query`. |
| **New Relic** | `brew install newrelic-cli` | No official MCP | NRQL queries everything: `newrelic nrql query --query 'SELECT * FROM Transaction'` |
| **PagerDuty** | `npm i -g pagerduty-cli` | No official MCP | `pd incident list/ack/resolve`, `pd service list`. Full CRUD + JSON output. |
| **Grafana** | `curl` against HTTP API | No official MCP | Well-documented REST API. `GET /api/dashboards/uid/:uid`, `GET /api/alerts`. API key in header. |
| **Bugsnag** | `curl` against REST API | No official MCP | Official CLI is upload-only. Query errors via: `curl -H "Authorization: token XXX" https://api.bugsnag.com/...` |

---

## MCP server catalog

Quick-install commands for all verified MCP servers. After adding HTTP servers that need OAuth, run `/mcp` inside Claude Code to authenticate.

### Productivity & project management

```bash
# Notion — pages, databases, search, comments
claude mcp add --transport http notion https://mcp.notion.com/mcp

# Slack — messages, search, canvases, threads
claude mcp add --transport http slack https://mcp.slack.com/mcp

# Atlassian (Jira + Confluence) — issues, pages, JQL, CQL
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp

# Linear — issues, projects, team workflows
claude mcp add --transport http linear https://mcp.linear.app/mcp

# Asana — tasks, projects, goals
claude mcp add --transport streamable-http asana https://mcp.asana.com/v2/mcp

# monday.com — boards, items, updates
claude mcp add --transport http monday https://mcp.monday.com/mcp

# ClickUp — tasks, docs, time tracking, chat
claude mcp add --transport http clickup https://mcp.clickup.com/mcp
```

### Design & content

```bash
# Figma — design context, screenshots, code generation
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Canva — search, generate, export designs
claude mcp add --transport http canva https://mcp.canva.com/mcp

# Miro — board content, diagrams
claude mcp add --transport http miro https://mcp.miro.com/

# Gamma — presentations, documents, websites
claude mcp add --transport http gamma https://mcp.gamma.app/mcp

# Excalidraw — hand-drawn diagrams (no auth needed)
claude mcp add --transport http excalidraw https://mcp.excalidraw.com/mcp
```

### Developer tools & infrastructure

```bash
# GitHub — PRs, issues, repos, actions
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Sentry — error tracking, issue search, stack traces
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# Vercel — projects, deployments, logs
claude mcp add --transport http vercel https://mcp.vercel.com

# Supabase — databases, auth, storage, edge functions
claude mcp add --transport http supabase https://mcp.supabase.com/mcp

# Stripe — payments, customers, invoices, subscriptions
claude mcp add --transport http stripe https://mcp.stripe.com

# Context7 — up-to-date docs and code examples (no hallucinated APIs)
claude mcp add --transport http context7 https://mcp.context7.com/mcp

# Hugging Face — models, datasets, papers, spaces
claude mcp add --transport http hugging-face https://huggingface.co/mcp

# Databricks — Unity Catalog, Genie spaces, vector search
claude mcp add --transport stdio databricks -- uvx databricks-mcp
```

### Data & databases (stdio)

```bash
# PostgreSQL via dbhub
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://user:pass@host:5432/dbname"

# Airtable
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server
```

### Customer & sales

```bash
# HubSpot — CRM data, contacts, deals, companies
claude mcp add --transport http hubspot https://mcp.hubspot.com/anthropic

# Intercom — conversations, tickets, contacts
claude mcp add --transport http intercom https://mcp.intercom.com/mcp
```

### Automation & meetings

```bash
# Zapier — workflow automation (requires user-specific URL from zapier.com)
# Get your URL at https://mcp.zapier.com/mcp/servers
claude mcp add --transport http zapier <YOUR_ZAPIER_MCP_URL>

# n8n — workflow execution (requires your n8n instance URL)
claude mcp add --transport http n8n <YOUR_N8N_INSTANCE_URL>/mcp-server/http

# Granola — meeting history, transcripts
claude mcp add --transport http granola https://mcp.granola.ai/mcp

# Fireflies — meeting transcripts and insights
claude mcp add --transport http fireflies https://api.fireflies.ai/mcp
```

### Research

```bash
# PubMed — biomedical literature search (no auth needed)
claude mcp add --transport http pubmed https://pubmed.mcp.claude.com/mcp
```

---

## Troubleshooting

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
