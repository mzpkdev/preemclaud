---
description: "Guardrails and recipes for agent teams  //  ALWAYS trigger before any team action — create, manage, recover, or clean up agent teams. Trigger on: TeamCreate, TeamDelete, SendMessage to teammate, orphaned teams, delegation blocks, 'spin up agents', 'build a swarm', 'split work across agents'. Must fire before spawning any team — contains safety rules that prevent runaway agent explosion."
user-invocable: true
disable-model-invocation: false
---

# Agent Teams

## Announce

> Daemon `knowledge:teams` online. Loading team protocols.

## Why this skill exists

Claude Code's agent teams are powerful — multiple agents with fresh context, communicating via SendMessage, each owning
a piece of parallel work. But without guardrails, things go wrong fast: teammates spawning new teammates (exponential
agent explosion), context exhaustion from reading too many files, cleanup failures leaving stale state, and sessions
crashing with no way to recover the team.

This skill encodes the patterns that make teams work reliably. It doesn't own the workflow — whatever you're doing
(chat, orchestration skill, feature build) stays in control. This just makes sure the team mechanics are sound.

## Steps

### Before you spawn

Think before you act. Figure out the team structure before calling TeamCreate:

1. **What's the goal?** What work is being parallelized?

1. **How to slice it?** By module, by concern, by task, by hypothesis — whatever fits the domain.

1. **How many agents?** Default to the minimum, not the maximum. Before choosing a count, explicitly consider whether
   items can be grouped. Five competitors don't need five agents — group by region, market segment, or similarity (e.g.,
   "US payment processors" vs "European enterprise gateways") and cover them with 2-3 agents. Ten modules don't need ten
   agents — group by layer or dependency. Present both a minimal option and a larger option in your proposal so the user
   can choose. If you can't articulate why N agents is better than N-1, use N-1.

1. **What model for each agent?** Don't pick one model for the whole team — evaluate each agent's task independently:

   - **opus** — when the agent needs to reason about ambiguity, make judgment calls, synthesize across domains, or
     handle tasks where being wrong is costly (security audits, architectural decisions, nuanced analysis)
   - **sonnet** — when the task is well-defined and execution-focused: research gathering, code implementation,
     straightforward analysis, pattern matching, data extraction
   - **haiku** — quick lookups, simple checks, formatting tasks, lightweight validation

   If all agents genuinely need the same model, that's fine — but say why in the proposal. "All opus because security
   analysis requires deep reasoning across all three domains" is a valid justification. Silently defaulting everything
   to the same model is not.

1. **Confirm with the user.** Present the proposed structure — names, roles, models — and wait for approval before
   spawning anything.

If another skill (like `write:brief`) has already decomposed the work, skip the discovery and go straight to proposing
the team structure based on those tasks.

## Rules

### The delegation rule

This is the single most important thing about agent teams.

**Teammates must NEVER spawn new teammates.** They spawn child subagents (helpers) instead.

|               | Teammate                   | Child Subagent (Helper)             |
| ------------- | -------------------------- | ----------------------------------- |
| Spawned with  | Agent tool + `team_name`   | Agent tool (no `team_name`)         |
| Runs in       | Own pane / in-process      | Parent's process                    |
| Communication | `SendMessage`              | Return value                        |
| Use for       | Long-running parallel work | Investigation, research, deep dives |

Without this rule, you get exponential explosion — 3 teammates each spawn 3 more, those spawn 3 more, and suddenly you
have 20+ agents burning tokens and stepping on each other. The docs say nested teams can't happen, but they can. Enforce
this explicitly.

**Every teammate prompt must include a delegation block.** Adapt the wording to the task, but keep the rules intact. See
`references/patterns.md` for the template.

### Creating a team

### 1. TeamCreate

```
TeamCreate({ team_name: "descriptive-name", description: "What the team is doing" })
```

Use a descriptive kebab-case name. The description helps with diagnostics later.

### 2. Create tasks

One task per unit of work, created before spawning teammates:

```
TaskCreate({ subject: "Task title", description: "Details...", activeForm: "Working on X" })
```

Tasks give teammates clear scope and give you a way to track progress.

### 3. Spawn all teammates in one message

This is critical. Spawn every teammate in a single response using multiple parallel Agent tool calls. User keystrokes
during spawning corrupt teammate prompts — if agents are spawned across multiple turns, typed characters get injected
into the prompts.

Each teammate needs: `name`, `team_name`, `subagent_type`, `model`, `prompt`, `description`.

For `subagent_type`: check if the project has custom agents in `.claude/agents/` first — they carry domain-specific
knowledge. Fall back to `general-purpose` otherwise.

**Tell the user not to type until all agents confirm spawned.**

**Every teammate prompt must include the delegation block** from `references/patterns.md`. This is non-negotiable — no
exceptions, no "this teammate is simple enough to skip it."

### Managing the team

### Idle detection

Teammates go idle after completing a turn. This is normal, not a sign that they're done. Send a message to wake them:

```
SendMessage({ to: "teammate-name", message: "Continue with your task" })
```

### Collecting results

Teammates report back via SendMessage. Track which teammates have reported. If one goes idle without reporting, nudge it
with explicit instructions about what to send back.

### Nudging

If a teammate seems stuck or idle for too long, send a targeted message:

```
SendMessage({ to: "stuck-teammate", message: "Status check — what have you found so far? Report your progress." })
```

### Shutdown and cleanup

TeamDelete is unreliable. Follow this sequence:

1. Send `shutdown_request` to all teammates, wait for confirmations
1. Call `TeamDelete({ team_name: "the-team" })`
1. If TeamDelete fails (active members error), force-clean:
   ```bash
   rm -rf ~/.claude/teams/{team-name}
   ```
1. Call `TeamDelete()` again to clear session state
1. Verify: `ls ~/.claude/teams/` — confirm no stale entries

Always attempt graceful shutdown first. Force-clean is the fallback, not the default.

## Edge cases

Sessions crash. Terminals close. When that happens, teams become orphaned — the files stay on disk but no session can
lead them.

### Detecting orphaned teams

```bash
# List all teams
ls ~/.claude/teams/

# Check if a team's lead session is still alive
# Read the config to get leadSessionId, then check recency
cat ~/.claude/teams/{team-name}/config.json
stat -f "%m" ~/.claude/session-env/{leadSessionId}/
date +%s
# If session was modified more than 5 minutes ago, it's stale
```

### Rejoining a team

1. Get your current session ID:
   ```bash
   ls -t ~/.claude/session-env/ | head -1
   ```
1. Read the team config: `~/.claude/teams/{team-name}/config.json`
1. Update the config:
   - Set `leadSessionId` to your current session ID
   - Set `leadAgentId` to `team-lead@{team-name}`
   - Set all members' `isActive` to `false`
1. Write the updated config back (pretty-printed, 4-space indent)
1. Re-spawn teammates using their original configs from the `members` array

### Team config structure

The config at `~/.claude/teams/{name}/config.json` contains:

```json
{
  "leadSessionId": "session-id",
  "leadAgentId": "team-lead@team-name",
  "createdAt": "timestamp",
  "description": "what the team does",
  "members": [
    {
      "name": "teammate-name",
      "agentType": "general-purpose",
      "model": "sonnet",
      "prompt": "the full teammate prompt",
      "cwd": "/working/directory",
      "isActive": true,
      "planModeRequired": false
    }
  ]
}
```

Skip the `team-lead` entry when re-spawning — that's the lead agent, not a spawnable teammate.

### Display modes

**In-process (default):** Single terminal pane. Cycle between teammates with `Shift+Down`.

**Grid (tmux):** Side-by-side view. Requires tmux installed and `"teammateMode": "tmux"` in settings.

## Reference

For the delegation block template, cleanup scripts, and additional patterns, read `references/patterns.md`.
