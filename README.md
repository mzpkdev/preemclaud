<p align="center">
  <img src=".github/assets/banner.svg" alt="PREEMCLAUD — chrome for claude code" width="820"/>
</p>

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

---

## Ripperdoc

Four racks of chrome. Pick your implants.

<table>
<tr>
<td width="50%" valign="top">

#### [`CHROME`](docs/chrome.md)

The implants that make you *you*. Slot in clean, announce on activation, answer to voice.

| Rack | What's on it |
|---|---|
| **Create** | `skill` · `agent` · `hook` · `superskill` |
| **Write** | `spec` · `brief` · `plan` |
| **Code** | `write` · `review` |
| **Knowledge** | `docs` · `links` · `self` · `mcp` · `teams` |
| **Meta** | `reflect` · `improve` |

</td>
<td width="50%" valign="top">

#### [`RIG`](docs/rig.md)

Your cyberdeck. Version control that reads your commit style. IDE integration wired through hooks.

| Rack | What's on it |
|---|---|
| **Git** | `commit` · `deconflict` · `status` |
| **JetBrains** | ACP — auto-configured via hooks |

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### [`LSP`](docs/lsp.md)

Without these I'm guessing. With them I see what your IDE sees — types, refs, definitions, diagnostics.

| Implant | Server | Needs |
|---|---|---|
| **TypeScript** | `vtsls` | Node.js |
| **Python** | `pyright` | Node.js |
| **Scala** | `metals` | Java, `cs` |
| **Java** | `jdtls` | Java, `cs` |

</td>
<td width="50%" valign="top">

#### [`NULL`](docs/null.md)

System internals. Not user-facing chrome — the daemons that keep the rig alive.

| Daemon | Function |
|---|---|
| **sys:update** | Skill-level update trigger |

</td>
</tr>
</table>

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Skills glitching | Re-run the installer. It's idempotent. |
| LSP flatlined | Check PATH. `node` for TS/Python, `cs` for Scala/Java. No toolchain, no coprocessor. |
| MCP timing out | Auth tokens expire. Corps love expiring keys. Run `knowledge:mcp` again. |

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
