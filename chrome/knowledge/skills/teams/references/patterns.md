# Team Patterns Reference

## Delegation Block Template

Every teammate prompt must include this block. Adapt the wording to fit the task's domain, but preserve all the rules.

```
### How to Work

When you need to investigate files, trace code paths, or research anything:
spawn helper agents instead of reading everything yourself. Reading many
files directly fills your context window — helpers investigate and return
only what matters.

Use the Agent tool WITHOUT the team_name parameter. This creates a child
subagent that runs inside your own process and returns results directly
to you — no coordination overhead, no extra panes.

Rule of thumb: if you need to read 3+ files for something, spawn a helper.

Use subagent_type="general-purpose" for helpers — these have full tool
access (Read, Write, Edit, Bash, Grep, Glob). Do NOT use
subagent_type="Explore" for deep work — those are read-only with no
edit or reasoning tools.

NEVER create a new team or use TeamCreate. You are a teammate, not a
leader. If you need parallel help, spawn child subagents (helpers).
```

## Teammate Prompt Structure

When constructing a teammate prompt, follow this structure:

```
You are {role-name}, a teammate on the {team-name} team.

## Your Task
{what this teammate owns — scope, boundaries, deliverables}

## Context
{background needed to do the work — project info, relevant modules, constraints}

## How to Work
{the delegation block from above}

## Reporting
When you've completed your work, report your findings using:
SendMessage({ to: "user", message: "your report here" })

Include: key findings, files changed (if any), issues discovered, recommendations.
```

## Cleanup Script

For when TeamDelete fails and you need to force-clean:

```bash
# Remove team state from disk
rm -rf ~/.claude/teams/{team-name}

# Remove associated task state if it exists
rm -rf ~/.claude/tasks/{team-name}

# Verify cleanup
ls ~/.claude/teams/
```

After force-cleaning files, call `TeamDelete()` once more to clear any in-memory session state.

## Spawning Pattern

All teammates must be spawned in a single message. Here's the pattern:

```
# In ONE response, make multiple parallel Agent tool calls:

Agent({
  name: "agent-one",
  team_name: "my-team",
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Brief role description",
  prompt: "Full prompt with delegation block..."
})

Agent({
  name: "agent-two",
  team_name: "my-team",
  subagent_type: "general-purpose",
  model: "opus",
  description: "Brief role description",
  prompt: "Full prompt with delegation block..."
})

# Do NOT split across multiple turns
```

## Common Pitfalls

| Pitfall | What happens | Prevention |
|---|---|---|
| Spawning across multiple turns | User keystrokes corrupt teammate prompts | Spawn all in one message |
| Missing delegation block | Teammates spawn new teams, exponential explosion | Always include the block |
| Too many agents | Token waste, coordination overhead, diminishing returns | Start with 2-3, scale up |
| Explore subagents for deep work | Read-only, no reasoning tools, teammates get stuck | Use general-purpose |
| Skipping TeamDelete | Stale team state accumulates on disk | Always clean up, force if needed |
| Reading too many files directly | Context exhaustion, teammate loses track | Delegation block teaches helpers |

## Recovery Checklist

When recovering an orphaned team:

1. `ls ~/.claude/teams/` — find the team
2. `cat ~/.claude/teams/{name}/config.json` — read the config
3. Check staleness: compare `leadSessionId` session mod time against current time
4. Get current session: `ls -t ~/.claude/session-env/ | head -1`
5. Update config: new `leadSessionId`, new `leadAgentId`, all members `isActive: false`
6. Write updated config back to disk
7. Re-spawn teammates from their `members` entries (skip `team-lead`)
8. Verify team is operational: send a status check to each teammate
