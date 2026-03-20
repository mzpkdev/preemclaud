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
3. **Scan for embedded URLs and follow them** — this is the critical step that makes the difference between a partial answer and a complete one. Details below.
4. **Answer** — respond to whatever the user actually asked, drawing on **all** retrieved content (primary + embedded).

You are NOT ready to answer until step 3 is done. The most common failure is: retrieve the primary content, see that it contains enough to say something useful, and skip straight to answering. That produces an incomplete response every time. The user pasted one link, but the content behind that link connects to other services — a Jira ticket links to a Figma mockup, a Confluence page references a GitHub PR, a Slack thread mentions a Bugsnag error. Those linked resources are part of the user's question.

---

## Step 3: Scan for embedded URLs and follow them

After every retrieval (step 2), before answering, do this:

### Extract URLs from the retrieved content

Scan the full response for `https://` URLs. They appear differently depending on the source:

- **Jira/Confluence** (MCP responses): URLs appear in the description body, comments, custom fields, and linked-issue fields. Atlassian content mixes raw URLs (`https://figma.com/...`) with markdown links (`[mockup](https://figma.com/...)`). Check ALL text fields — descriptions are the most common location, but comments and custom fields (like "Design link" or "Specification") also carry URLs.
- **GitHub** (CLI output): URLs in issue/PR bodies, comments, and linked references.
- **Slack** (MCP responses): URLs in message text.
- **Any source**: The pattern `https?://[^\s<>\]\)"]+` catches most URLs.

### Route and follow each embedded URL

Match each extracted URL against the routing index, same as step 1. For each match, execute the **complete** route handler for that URL type — same treatment as if the user had pasted it directly:

- A `figma.com` URL gets the full figma route: screenshot in main context + subagent.
- A `github.com` URL gets the full `gh` CLI treatment.
- An `*.atlassian.net` URL gets the full MCP call.

No shortcuts. The fact that the URL was found inside another page does not reduce its importance — if anything, it increases it, because the original author linked it for a reason.

### Limits

- Follow up to **3** embedded links per retrieval. If more exist, list the remaining URLs so the user can ask about specific ones.
- Only follow links that match the routing index. Don't chase arbitrary external URLs.
- One level deep only — if an embedded page itself contains links, note them but don't follow.

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
- **Embedded links are common here.** Confluence pages frequently embed Jira tickets, Figma designs, and GitHub links. After retrieval, proceed to step 3.

### jira

- **Patterns:** `*.atlassian.net/browse/*`
- **Handler:** mcp
- **Server:** `atlassian`
- **Tools:** Use `mcp__atlassian__getJiraIssue` with the issue key from the URL (e.g., `CEX-667` from `.../browse/CEX-667`).
- **Embedded links are extremely common here.** Jira tickets are a hub — they routinely link to Figma designs (mockups), Confluence pages (specs), GitHub PRs (implementation), and other Jira tickets (dependencies). After retrieving the ticket content, proceed to step 3 and scan the description, comments, and custom fields for URLs. Figma links are especially important because the ticket author attached them as visual context for the work being described — they must be followed with the full figma route (screenshot + subagent).

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

- **Always follow embedded links (step 3).** After every retrieval, scan for URLs and follow them before answering. This is the rule you are most likely to break — the temptation is to answer immediately because the primary content looks sufficient. It isn't. A Figma link inside a Jira ticket gets the complete figma treatment (screenshot + subagent). A GitHub PR inside a Confluence page gets the full `gh` treatment. If you find yourself composing an answer and you haven't scanned for embedded URLs yet, stop and go back to step 3.
- **Match first, act second.** Check the URL against the routing index, then follow the matched route's instructions.
- **MCP means check for a matching MCP tool.** Search your available tools for the MCP server name shown in the route. If the server exists, use the appropriate tool from it. If it doesn't exist, tell the user you can't access that service and suggest they set up the MCP server for it (e.g. "I don't have a Datadog MCP connected — want me to help set one up?").
- **Never raw-fetch authenticated services.** Jira, Confluence, Slack, Datadog, Grafana, Sentry, New Relic, Notion, Linear, Figma, and Bugsnag all sit behind auth walls. WebFetch will return a login page, not content.
- **GitHub has CLI tools.** Use `gh` for all GitHub URLs. Parse the owner, repo, and resource ID from the URL and use the appropriate `gh` subcommand.
- **Self-hosted services** (e.g. a company's own Grafana or Sentry instance) won't always match the patterns above. If the user pastes a URL you don't recognize but mentions it's from one of these services, treat it the same way — use MCP if available, otherwise explain you can't access it.
- **WebFetch is the last resort.** Only for public URLs that don't match any pattern above.
- **Then answer the user.** After retrieving the content, respond to whatever the user actually asked — summarize, explain, compare, act on it. Don't just dump raw output.
