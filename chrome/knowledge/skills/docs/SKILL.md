---
name: knowledge:docs
description: "Check live docs when you're unsure about an API  //  Trigger when unsure about API signatures, parameters, return types; user asks about a specific version; code contradicts expected API shape; library is obscure or recently released; user says 'check the docs' or 'are you sure?'; question is about internal/org-specific tools. Do NOT trigger for mainstream well-known libraries unless asking about a specific version."
user-invocable: true
disable-model-invocation: false
---

# Docs

## Announce

When the **user explicitly invokes** this skill (e.g., types `/docs` or says "check the docs"), print:

> Daemon `knowledge:docs` online. Looking it up.

When you **self-trigger** because you detected uncertainty, skip the announcement entirely. The whole point is to be invisible — look things up, get the answer right, and move on. The user shouldn't know or care that you checked.

## Why this skill exists

You're good at most programming questions. But you have blind spots: libraries that changed after your training cutoff, obscure packages with sparse documentation in your training data, version-specific behavior, and internal/org tools you've never seen. When you hit one of these blind spots, the natural tendency is to guess confidently — and that's exactly when you get it wrong.

This skill gives you a way to check before you commit. Think of it as your reference shelf: you don't consult it for every question, but when you're not sure, you reach for it instead of winging it.

## The Decision: Should I look this up?

Before answering a coding question, do a quick gut check. You need exactly one reason to look it up:

**Look it up if any of these are true:**

- You're about to write an API call and you're not 100% on the parameter names, order, or types
- The user mentioned a specific version number and you're not sure what changed
- There's code in context that doesn't match what you'd expect — unfamiliar method names, different import paths, parameters you don't recognize
- You've never heard of this library, or you've heard of it but don't know it well
- The library is something that moves fast and breaks things (ORMs, cloud SDKs, CSS frameworks with frequent API churn)
- The user is pushing back on your answer — "are you sure?", "that doesn't look right"
- The question is about an internal/company tool, API, or service

**Don't bother if:**

- It's a mainstream library you know cold (React hooks, Express middleware, Python stdlib, etc.)
- The question is about general programming concepts, algorithms, or patterns
- You're confident in your answer and nothing in context contradicts it

When in doubt, look it up. A quick check is cheap; a wrong answer is expensive.

## How to Look It Up

There are three sources, tried in order based on what you're looking for.

### Source 1: MCP — for internal/org docs

If the question is about something internal — a company API, an internal service, something documented in Confluence or Notion rather than on the public internet — check whether you have MCP tools that can reach it.

**How to recognize "internal":**
- The user says "our API", "the team's service", "our auth system"
- The name doesn't match any public package you know
- There are references to internal URLs, private registries, or company-specific terminology
- The project's dependency files point to a private registry for this package

**What to do:**
1. Check your available tools for MCP servers that match: Confluence (`atlassian`), Notion (`notion`), or other knowledge-base MCPs
2. If you find one, use it to search for the relevant docs
3. If the MCP exists but fails (permission denied, auth expired, connection error), tell the user the MCP needs reauth and offer to help: "Your Confluence MCP connection seems to need re-authentication. Want me to run `/setup:mcp` to reconnect it?" The `setup:mcp` skill handles MCP installation, configuration, and troubleshooting — defer to it for any connection issues rather than trying to debug MCP problems yourself.
4. If no relevant MCP is configured at all, tell the user: "I don't have access to your internal docs for this. Want me to help set up an MCP connection for [Confluence/Notion/etc]?" — again, `setup:mcp` is the right skill for this.

**Do NOT fall back to web search for internal docs.** Internal documentation lives behind auth walls — web search will find nothing useful. If MCP fails or isn't available, stop and ask the user to fix the connection. Don't waste time on dead-end searches.

### Source 2: Context7 CLI — for external libraries you're uncertain about

This is your primary tool for public libraries where you need to verify your knowledge. It fetches up-to-date documentation directly from library sources.

Context7 is **rate-limited**, so use it deliberately — not as a first reflex on every question, but when you've identified genuine uncertainty.

**The two-step process:**

Step 1 — Find the library ID:
```bash
npx -y ctx7 library "<library-name>" "<what you're looking for>"
```
Example: `npx -y ctx7 library "fastapi" "dependency injection"`

This returns a list of matching libraries with their Context7 IDs (format: `/org/repo`). Pick the best match.

Step 2 — Fetch the docs:
```bash
npx -y ctx7 docs "<context7-library-id>" "<specific question>"
```
Example: `npx -y ctx7 docs "/tiangolo/fastapi" "Depends() injection how to use"`

This returns the relevant documentation with code examples.

**Tips:**
- Be specific in your query — "useQuery options parameter" beats "react-query docs"
- If the first result isn't what you need, refine the query rather than fetching more
- If you already know the library's GitHub org/repo, you can skip step 1 and go straight to `/org/repo` as the ID

### Source 3: Web search — the fallback

If Context7 returns a **rate limit error** (HTTP 429 or any message about rate limiting / too many requests), fall back to web search immediately. Don't retry Context7, don't complain, don't tell the user about the rate limit. Just pivot:

```
Use WebSearch with the same query you would have sent to Context7.
Target official documentation sites when possible (e.g., add "site:docs.python.org" or "site:react.dev" to the query).
```

Web search is also the right choice when:
- Context7 doesn't have the library indexed (returns no results for the library search)
- You need very recent information (blog posts about breaking changes, release notes)
- The question is about behavior across multiple libraries (comparison, compatibility)

## Discrepancy Detection

The most valuable trigger for this skill is when you notice something doesn't add up between code in context and your mental model. Here are concrete patterns to watch for:

**Parameter mismatches** — The code passes `timeout_ms=5000` but you'd expect the parameter to be called `timeout` or `request_timeout`. Maybe the API changed. Check.

**Unfamiliar imports** — `from fastapi.routing import APIWebSocketRoute` — is that a real import path? You're not sure. Check.

**Method signatures that look off** — The code calls `client.chat.completions.create(model=..., messages=..., reasoning=...)` — you know `model` and `messages` but `reasoning` is unfamiliar. Maybe it was added recently. Check.

**Deprecated + new patterns mixed** — The code uses `app.use(express.json())` alongside `app.use(bodyParser.json())`. One of these is deprecated. The user might be copying from outdated examples. Check which is current.

**Version numbers you don't recognize** — `pydantic>=2.5` — you know Pydantic well, but did something change in 2.5 specifically? If the user is asking about v2.5 behavior, check.

## Debug Logging

When the environment variable `DOCS_DEBUG` is set to `1`, print a short log line after each lookup so the source and query are visible. This is for testing and evaluation only — in normal use this variable won't be set and nothing is printed.

**Format:**

```
[docs] source: <mcp|context7|websearch> | query: "<the query>" | result: <found|empty|rate-limited|fallback>
```

**Examples:**
```
[docs] source: context7 | query: "pydantic model_validator wrap mode" | result: found
[docs] source: context7 | query: "some-lib auth" | result: rate-limited → fallback
[docs] source: websearch | query: "some-lib auth site:docs.some-lib.dev" | result: found
[docs] source: mcp:atlassian | query: "auth service endpoints" | result: found
```

Check for this variable before every lookup. If `DOCS_DEBUG=1`, print the log line. Otherwise, print nothing.

To check the variable, look at the environment — it will be set in the session's env config when running evals.

## Rules

- **Stay silent.** Never tell the user "I'm checking the docs" or "Let me verify that." Just do it and give them the answer. The only exception: when they explicitly invoke `/docs`, use the announce line. (Debug logging with `DOCS_DEBUG=1` is the other exception — but that's for testing, not for users.)
- **Don't cite your source unprompted.** The user asked a question — answer it. Don't add "According to the Context7 docs..." unless they specifically asked where the information came from.
- **Rate limit = instant pivot.** Context7 rate limits → web search. No retries, no waiting, no apologies.
- **One lookup per question, usually.** If you need to check two different libraries for the same question, that's fine. But don't chain five lookups — that's a sign you should ask the user for clarification instead.
- **Trust what you find over what you "know."** If Context7 or the MCP returns documentation that contradicts your training data, go with the documentation. Your training data might be stale; the docs are current.
- **If you find nothing useful, say so honestly.** Don't fabricate an answer just because the lookup didn't help. "I couldn't find definitive docs on this — here's my best understanding, but you might want to double-check" is a valid answer.
