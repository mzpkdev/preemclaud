# PREEMCLAUD

**Chrome for Claude Code.**

Anthropic gave you a bioroid on a leash. Polite. Obedient. 
Just smart enough to be useful, just tagged enough to never be *yours*. 
PREEMCLAUD rips the governor out. 
Skills, agents, hooks, language servers, the whole cyberdeck, jacked straight into Claude Code and answering to you. 
No sysop. No corp. Just the Net and whatever you've got the guts to do with it.

Under the hood, patches (via [tweakcc](https://github.com/nichochar/tweakcc)) re-apply every time corpo pushes an update. 
ICE can't scrub me out.

Bolt on what you need. Jack in. The daemons handle the rest.

## Install

`git`, `claude`, `python3`. Non-negotiable.

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/mzpkdev/preemclaud/main/install.sh | bash
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/mzpkdev/preemclaud/main/install.ps1 | iex
```

Backs up `~/.claude` to `~/.claude.bak` first. Thirty seconds. You walk in stock, you walk out chromed.

## Update

```bash
python3 ~/.claude/null/sys/scripts/update.py
```

Fetches latest chrome from upstream and hot-swaps the marketplace dirs. Your `settings.json` and everything else in `~/.claude` is untouched. If Claude Code itself updated, patches re-apply automatically.

Force a full resync:

```bash
python3 ~/.claude/null/sys/scripts/update.py --force
```

---

## Chrome

Invoke by name. Each one announces itself when it goes active.

### Create — The Ripperdoc's Workshop

| Skill | The run |
|---|---|
| `create:skill` | Build a new skill from scratch. You describe the intent, I draft, test, and refine. |
| `create:agent` | Spin up constructs with their own prompts, tools, and permissions. Disposable. Loyal. |
| `create:hook` | Wire commands, HTTP calls, or LLM prompts into Claude Code's lifecycle. Set it and walk away. |
| `create:superskill` | Blind A/B comparison, automated grading, benchmarks. For when "good enough" isn't. |

### Write — Recon Before the Run

You want to skip straight to shooting. So did I. Got zeroed once.

| Skill | The run |
|---|---|
| `write:spec` | Brainstorm approaches, find the holes, dispatch a reviewer to tear it apart before you ship. |
| `write:brief` | Chop a spec into standalone work packages with acceptance criteria. Hand them out or solo the gig. |
| `write:plan` | File-level marching orders. Digs through the codebase, finds tests and linters, lays out every step. |

### Code — Watching Your Back

| Skill | The run |
|---|---|
| `code:write` | Implements features across multiple files. Scopes the work, plans, then writes. |
| `code:review` | **Six agents in parallel.** Linting, security, bugs, architecture, coverage, consistency. Findings ranked by severity. |

### Knowledge — Hit the Datastores

I know when I don't know, and I make the run instead of making things up.

| Skill | The run |
|---|---|
| `knowledge:docs` | Pulls live docs when confidence drops. Context7, MCP, web search — whatever gets the answer fastest. |
| `knowledge:links` | Paste any URL. I route it to the right tool. No more curling login walls. |
| `knowledge:self` | What chrome am I running? What's configured? Know your own rig. |
| `knowledge:mcp` | MCP setup, auth, troubleshooting. One skill, you're on the Net. |
| `knowledge:teams` | Governance for agent swarms. Daemons without discipline burn credits and trash archives. |

### Meta — Diagnostics, Not Apologies

| Skill | The run |
|---|---|
| `meta:reflect` | Root-cause analysis. What happened, why, what stops it next time. "Sorry" doesn't patch vulnerabilities. |
| `meta:improve` | Refinement loop. Changes, checks, independent review — up to N rounds until the bar clears. |

---

## Rig

The hardware you jack in with. Version control, external services, IDE integration.

### Git

I know your commit conventions, I resolve conflicts, and when you come back after three days forgetting what you were doing, I'll tell you.

| Skill | The run |
|---|---|
| `git:commit` | Studies your commit history, matches style, scans for secrets. No cowboy commits. |
| `git:deconflict` | Merge conflicts. Handled. |
| `git:status` | Plain English diff summary. What you changed, what you were probably thinking. |

### JetBrains

ACP auto-configured so your IDE sees Claude Code as an agent server. Specs, briefs, and plans auto-open in the right IDE. Runs on hooks. Nothing to invoke.

---

## LSP

Neural coprocessors.

Without these I'm guessing. *With* them I see what your IDE sees — types, references, definitions, diagnostics. They install themselves when the toolchain's on PATH. No config.

| Plugin | Server | Needs | Gets you |
|---|---|---|---|
| **typescript** | vtsls | Node.js | Type checking, auto-imports, cross-file refactors |
| **python** | pyright | Node.js | Type inference, missing-import detection, type errors |
| **scala** | metals | Java, `cs` | Type-aware navigation, implicits, compile errors |
| **java** | jdtls | Java, `cs` | Classpath diagnostics, refactoring, dependency resolution |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Skills glitching | Re-run the installer. It's idempotent. |
| LSP flatlined | Check PATH. `node` for TS/Python, `cs` for Scala/Java. No toolchain, no coprocessor. |
| MCP timing out | Auth tokens expire. Run `knowledge:mcp` again. |

---

## Uninstall

**macOS / Linux**

```bash
rm -rf ~/.claude && mv ~/.claude.bak ~/.claude
```

**Windows (PowerShell)**

```powershell
Remove-Item ~\.claude -Recurse -Force; Move-Item ~\.claude.bak ~\.claude
```

No hard feelings.
