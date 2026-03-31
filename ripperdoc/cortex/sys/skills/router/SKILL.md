---
description: Configure CCR model routing
user-invocable: true
disable-model-invocation: true
---

# Router

The hook failed to intercept. Run manually:

```bash
# status
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py"

# set OpenRouter API key
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py" key YOUR_KEY

# set default model for tier
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py" default haiku anthropic/claude-haiku-4-5

# set per-agent override
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py" agent code-reviewer anthropic/claude-opus-4

# clear a tier or override
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py" default haiku --unset
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/router.py" agent code-reviewer --unset
```
