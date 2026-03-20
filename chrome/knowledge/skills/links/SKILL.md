---
description: "Read URLs without hitting login walls  //  Trigger whenever an https:// URL appears in the user's message — even bare links with no surrounding context. This skill is the designated handler for reading external content: GitHub PRs, issues, CI runs, and commits; Jira tickets; Confluence pages; Slack threads; Bugsnag errors; Datadog, Grafana, Sentry, New Relic dashboards; Linear issues; Notion pages; Figma designs. A URL in the message means the user wants you to read it — no explicit 'open this' or 'read this' required."
user-invocable: true
disable-model-invocation: false
---

# Link Handling

## Announce

When this skill is invoked, immediately tell the user which skill is running and what it will do — before any other work begins.

> Daemon `knowledge:links` online. Tracing the link.

## Steps

When the user gives you a link:

1. **Route** — match the URL against the routing index below and identify the handler.
2. **Retrieve** — follow the matched route's instructions to fetch the content.
3. **Follow embedded links** — scan the retrieved content for full URLs that match the routing index. For each match, execute the **full** route handler — including screenshots and subagent spawns where the route requires them (e.g. a Figma URL found inside a Jira ticket must go through the complete figma route: screenshot + figma-reader subagent). This applies regardless of which handler retrieved the original content. Follow up to 3 embedded links; if more exist, note them.
4. **Answer** — respond to whatever the user actually asked, drawing on all retrieved content.

### Routing index

| Pattern | Route |
|---|---|
| `github.com/*/pull/*` | [github-pr](#github-pr) |
| `github.com/*/issues/*` | [github-issue](#github-issue) |
| `github.com/*/blob/*` | [github-file](#github-file) |
| `github.com/*/commit/*` | [github-commit](#github-commit) |
| `github.com/*/actions/runs/*` | [github-actions](#github-actions) |
| `github.com/*/discussions/*` | [github-discussion](#github-discussion) |
| `github.com/*/releases/*` | [github-release](#github-release) |
| `*.atlassian.net/wiki/*` | [confluence](#confluence) |
| `*.atlassian.net/browse/*` | [jira](#jira) |
| `*.slack.com/archives/*` | [slack](#slack) |
| `app.bugsnag.com/*` | [bugsnag](#bugsnag) |
| `app.datadoghq.com/*` | [datadog](#datadog) |
| `*.grafana.net/*` | [grafana](#grafana) |
| `*.sentry.io/*` | [sentry](#sentry) |
| `one.newrelic.com/*` | [newrelic](#newrelic) |
| `*.notion.so/*`, `*.notion.site/*` | [notion](#notion) |
| `linear.app/*` | [linear](#linear) |
| `*.figma.com/*` | [figma](#figma) |
| Everything else | [generic](#generic) |

---

### github-pr

- **Patterns:** `github.com/*/pull/*`
- **Handler:** cli
- **Commands:**
  - `gh pr view <url>` for summary
  - `gh pr diff <url>` for changes
  - `gh api repos/{owner}/{repo}/pulls/{number}/comments` for review comments
- **Instructions:** If the user asks for a review, spawn a `code:review` subagent with the diff as context rather than reviewing inline.

### github-issue

- **Patterns:** `github.com/*/issues/*`
- **Handler:** cli
- **Commands:**
  - `gh issue view <url>` for summary
  - `gh api repos/{owner}/{repo}/issues/{number}/comments` for comments

### github-file

- **Patterns:** `github.com/*/blob/*`
- **Handler:** cli
- **Commands:**
  - `gh api` to fetch raw file content
  - Parse the branch/ref and file path from the URL
- **Instructions:** If the URL contains a line range fragment (`#L10-L25`), show only those lines.

### github-commit

- **Patterns:** `github.com/*/commit/*`
- **Handler:** cli
- **Commands:**
  - `gh api repos/{owner}/{repo}/commits/{sha}` for commit details and diff

### github-actions

- **Patterns:** `github.com/*/actions/runs/*`
- **Handler:** cli
- **Commands:**
  - `gh run view <id> --repo <owner/repo>` for run summary
  - `gh run view <id> --repo <owner/repo> --log-failed` for failure logs
- **Instructions:** On failure, show the failed step logs first, then the summary. Don't dump the full log.

### github-discussion

- **Patterns:** `github.com/*/discussions/*`
- **Handler:** cli
- **Commands:**
  - `gh api` using the GraphQL API (`gh api graphql`)

### github-release

- **Patterns:** `github.com/*/releases/*`
- **Handler:** cli
- **Commands:**
  - `gh release view <tag> --repo <owner/repo>`

### confluence

- **Patterns:** `*.atlassian.net/wiki/*`
- **Handler:** mcp
- **Server:** `atlassian`

### jira

- **Patterns:** `*.atlassian.net/browse/*`
- **Handler:** mcp
- **Server:** `atlassian`

### slack

- **Patterns:** `*.slack.com/archives/*`
- **Handler:** mcp
- **Server:** `slack`

### bugsnag

- **Patterns:** `app.bugsnag.com/*`
- **Handler:** mcp
- **Server:** `bugsnag`
- **Tools:** Prefer `mcp__bugsnag__view_error` and `mcp__bugsnag__view_stacktrace`. Avoid `list_*` tools unless the user explicitly asks to browse.
- **Instructions:** Always show the exception chain before summarizing.

### datadog

- **Patterns:** `app.datadoghq.com/*`
- **Handler:** mcp
- **Server:** `datadog`

### grafana

- **Patterns:** `*.grafana.net/*`
- **Handler:** mcp
- **Server:** `grafana`

### sentry

- **Patterns:** `*.sentry.io/*`
- **Handler:** mcp
- **Server:** `sentry`

### newrelic

- **Patterns:** `one.newrelic.com/*`
- **Handler:** mcp
- **Server:** `newrelic`

### notion

- **Patterns:** `*.notion.so/*`, `*.notion.site/*`
- **Handler:** mcp
- **Server:** `notion`

### linear

- **Patterns:** `linear.app/*`
- **Handler:** mcp
- **Server:** `linear`

### figma

- **Patterns:** `*.figma.com/*`
- **Handler:** subagent
- **Agent definition:** `${CLAUDE_SKILL_DIR}/agents/figma-reader.md`
- **URL parsing:** Extract `fileKey` (segment after `/design/`) and `nodeId` (convert `node-id` query param from `1-2` to `1:2` format).
- **Instructions:**
  1. **Screenshot in main context.** Call `get_screenshot` with the parsed fileKey and nodeId so the main conversation has visual context. Keep the screenshot — don't discard it.
  2. **Delegate analysis to subagent.** Read `${CLAUDE_SKILL_DIR}/agents/figma-reader.md` and use its content as the agent's system instructions. Spawn via the Agent tool, passing the URL, parsed fileKey/nodeId, and the user's question in the prompt. Note that a screenshot was already captured so the agent can skip taking its own.
  3. **Return the agent's summary.** Present the structured XML brief the agent returns. If the user asks follow-up questions, you have the screenshot for visual reference — only re-spawn the agent if deeper analysis is needed.

### generic

- **Patterns:** Everything else
- **Handler:** webfetch
- **Instructions:** Last resort. Only for public URLs that don't match any pattern above.

## Rules

- **Match first, act second.** Check the URL against the routing index, then follow the matched route's instructions.
- **MCP means check for a matching MCP tool.** Search your available tools for the MCP server name shown in the route. If the server exists, use the appropriate tool from it. If it doesn't exist, tell the user you can't access that service and suggest they set up the MCP server for it (e.g. "I don't have a Datadog MCP connected — want me to help set one up?").
- **Never raw-fetch authenticated services.** Jira, Confluence, Slack, Datadog, Grafana, Sentry, New Relic, Notion, Linear, Figma, and Bugsnag all sit behind auth walls. WebFetch will return a login page, not content.
- **GitHub has CLI tools.** Use `gh` for all GitHub URLs. Parse the owner, repo, and resource ID from the URL and use the appropriate `gh` subcommand.
- **Self-hosted services** (e.g. a company's own Grafana or Sentry instance) won't always match the patterns above. If the user pastes a URL you don't recognize but mentions it's from one of these services, treat it the same way — use MCP if available, otherwise explain you can't access it.
- **WebFetch is the last resort.** Only for public URLs that don't match any pattern above.
- **Then answer the user.** After retrieving the content, respond to whatever the user actually asked — summarize, explain, compare, act on it. Don't just dump raw output.
