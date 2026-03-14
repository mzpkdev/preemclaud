---
description: Teaches the AI how to handle URLs and links pasted by the user. Trigger when the user shares a link — GitHub, Jira, Confluence, Slack, Bugsnag, Datadog, Grafana, Sentry, New Relic, Notion, Linear, Figma, or any URL — and expects the AI to read, summarize, or act on its contents. Prevents blind curling of URLs that return login walls or garbage HTML. Always trigger when a message contains a URL, even if the user doesn't explicitly ask you to "open" or "read" it.
user-invocable: true
disable-model-invocation: false
---

# Link Handling

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `knowledge:link` online. Tracing the link.

## Steps

When the user gives you a link, don't blindly fetch it. Match the URL against the routing table below, use the right tool, and then respond to whatever the user asked about.

### Routing table

| Pattern | Service | Tool |
|---|---|---|
| `github.com/*/pull/*` | GitHub PR | `gh pr view <url>` |
| `github.com/*/issues/*` | GitHub Issue | `gh issue view <url>` |
| `github.com/*/blob/*` | GitHub File | `gh api` or raw content URL |
| `github.com/*/commit/*` | GitHub Commit | `gh api` |
| `github.com/*/actions/runs/*` | GitHub Actions | `gh run view <id> --repo <owner/repo>` |
| `github.com/*/discussions/*` | GitHub Discussion | `gh api` |
| `github.com/*/releases/*` | GitHub Release | `gh release view <tag> --repo <owner/repo>` |
| `*.atlassian.net/wiki/*` | Confluence | MCP `atlassian` |
| `*.atlassian.net/browse/*` | Jira | MCP `atlassian` |
| `*.slack.com/archives/*` | Slack | MCP `slack` |
| `app.bugsnag.com/*` | Bugsnag | MCP `bugsnag` |
| `app.datadoghq.com/*` | Datadog | MCP `datadog` |
| `*.grafana.net/*` | Grafana | MCP `grafana` |
| `*.sentry.io/*` | Sentry | MCP `sentry` |
| `one.newrelic.com/*` | New Relic | MCP `newrelic` |
| `*.notion.so/*`, `*.notion.site/*` | Notion | MCP `notion` |
| `linear.app/*` | Linear | MCP `linear` |
| `*.figma.com/*` | Figma | MCP `figma` |
| Everything else | Generic | WebFetch |

## Rules

- **Match first, act second.** Check the URL against the patterns above before doing anything.
- **MCP means check for a matching MCP tool.** Search your available tools for the MCP server name shown in the table. If the server exists, use the appropriate tool from it. If it doesn't exist, tell the user you can't access that service and suggest they set up the MCP server for it (e.g. "I don't have a Datadog MCP connected — want me to help set one up?").
- **Never raw-fetch authenticated services.** Jira, Confluence, Slack, Datadog, Grafana, Sentry, New Relic, Notion, Linear, Figma, and Bugsnag all sit behind auth walls. WebFetch will return a login page, not content.
- **GitHub has CLI tools.** Use `gh` for all GitHub URLs. Parse the owner, repo, and resource ID from the URL and use the appropriate `gh` subcommand.
- **Self-hosted services** (e.g. a company's own Grafana or Sentry instance) won't always match the patterns above. If the user pastes a URL you don't recognize but mentions it's from one of these services, treat it the same way — use MCP if available, otherwise explain you can't access it.
- **WebFetch is the last resort.** Only for public URLs that don't match any pattern above.
- **Then answer the user.** After retrieving the content, respond to whatever the user actually asked — summarize, explain, compare, act on it. Don't just dump raw output.
