---
paths:
  - "**/*.py"
---

# Python Scripts

When editing or creating Python files, run the following before considering the task done:

- **Format:** `ruff format <file>`
- **Lint:** `ruff check --fix <file>`
- **Type check:** `mypy <file>`

Fix any issues ruff or mypy report. Configuration is in `pyproject.toml` at the repo root.

### Type Hints

All functions and methods must have type annotations on parameters and return types. `mypy` is the
enforcement mechanism — fix all errors it reports. Do not use `Any` unless there is no alternative,
and document why if you do.

```python
def run(cmd: list[str], timeout: int = 5) -> str:  # correct
def run(cmd, timeout=5):                            # WRONG — unannotated
```

## Best Practices

These conventions are not enforceable by ruff or mypy but are required for correctness and
reliability in this codebase.

### Entry Point Guard

All scripts must define a `main()` function behind an `if __name__ == "__main__":` guard. Never
execute logic at module level — this keeps scripts importable and testable.

### Stdout Discipline

Hooks and gather scripts must only use `print()` on stdout for the final JSON output. All
diagnostics, warnings, and debug output go to stderr:

```python
print(f"warning: {msg}", file=sys.stderr)  # correct
print(f"warning: {msg}")                    # WRONG — corrupts JSON output
```

### Subprocess Timeouts

Every `subprocess.run()` call must include a `timeout` parameter. Hooks gate tool execution — a
hanging subprocess freezes the entire Claude session.

- Local commands (`git`, `claude`): `timeout=5`
- Network commands (`gh`, `git fetch`): `timeout=10`
- Long-running operations (`git clone`, `npm install`): `timeout=30`

### Plugin Root Resolution

Prefer the `CLAUDE_PLUGIN_ROOT` environment variable over `Path(__file__)` parent-chain
navigation. Fall back to path arithmetic only for direct invocation during development:

```python
PLUGIN_ROOT = Path(
    os.environ.get("CLAUDE_PLUGIN_ROOT", Path(__file__).resolve().parent.parent)
)
```

### Hook Smoke-Testability

Hooks must produce valid JSON on stdout for any input — including unmatched input (output `{}`).
Verify with:

```bash
echo '{}' | python3 hook.py
```

This catches profile interference (`.zshrc` echo polluting stdout), missing pass-through for
unmatched commands, and crashes on unexpected input.
