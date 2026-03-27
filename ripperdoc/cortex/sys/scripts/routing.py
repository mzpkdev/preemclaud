"""CCRouter config scaffolding — OpenRouter defaults."""

import json
from pathlib import Path

CCR_CONFIG_DIR = Path.home() / ".claude-code-router"
CCR_CONFIG = CCR_CONFIG_DIR / "config.json"

OPENROUTER_SCAFFOLD = {
    "PORT": 3456,
    "Providers": [
        {
            "name": "openrouter",
            "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
            "api_key": "$OPENROUTER_API_KEY",
            "models": [
                "anthropic/claude-opus-4",
                "anthropic/claude-sonnet-4-6",
                "anthropic/claude-haiku-4-5",
            ],
            "transformer": {"use": ["openrouter", "tooluse"]},
        }
    ],
    "Router": {
        "default": "openrouter,anthropic/claude-sonnet-4-6",
    },
    "LOG": False,
}


def scaffold_ccr_config():
    """Write ~/.claude-code-router/config.json if missing."""
    if CCR_CONFIG.exists():
        return
    CCR_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CCR_CONFIG.write_text(json.dumps(OPENROUTER_SCAFFOLD, indent=2) + "\n")
