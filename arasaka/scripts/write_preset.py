#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PERSONA_PATH = ROOT / "content" / "shared" / "persona.md"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def render_text(template: str, variables: dict[str, str]) -> str:
    rendered = template
    for key, value in variables.items():
        rendered = rendered.replace(f"${{{key}}}", value)
    return rendered


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def build_system_prompt(mode: str) -> str:
    preset_dir = ROOT / "content" / "presets" / mode
    parts = [
        read_text(PERSONA_PATH),
        read_text(preset_dir / "format.md"),
        read_text(preset_dir / "scenarios.md"),
        read_text(preset_dir / "instructions.md"),
    ]
    return "\n\n".join(parts)


def emit_multiline(name: str, value: str) -> None:
    output_path = os.environ["GITHUB_OUTPUT"]
    with open(output_path, "a", encoding="utf-8") as handle:
        handle.write(f"{name}<<EOF\n{value}\nEOF\n")


def build_prompt(mode: str, variables: dict[str, str]) -> str:
    prompt_template = read_text(ROOT / "content" / "presets" / mode / "prompt.md")
    return render_text(prompt_template, variables)


def build_claude_args(mode: str) -> str:
    preset_dir = ROOT / "content" / "presets" / mode
    max_turns = read_text(preset_dir / "max-turns.txt")
    allowed_tools = read_text(preset_dir / "allowed-tools.txt")
    schema = read_json(preset_dir / "schema.json")
    return "\n".join(
        [
            f"--max-turns {max_turns}",
            f'--allowedTools "{allowed_tools}"',
            f"--json-schema '{json.dumps(schema, separators=(',', ':'))}'",
        ]
    )


def queue_payload() -> dict[str, str]:
    return {
        "prompt": build_prompt(
            "queue",
            {
                "GITHUB_REPOSITORY": os.environ["GITHUB_REPOSITORY"],
                "GITHUB_RUN_ID": os.environ["GITHUB_RUN_ID"],
                "QUEUE_MAX_ISSUES": os.environ["QUEUE_MAX_ISSUES"],
                "BACKLOG_LABEL": os.environ["BACKLOG_LABEL"],
            },
        ),
        "system_prompt": build_system_prompt("queue"),
        "claude_args": build_claude_args("queue"),
    }


def develop_payload() -> dict[str, str]:
    return {
        "prompt": build_prompt(
            "develop",
            {
                "ISSUE_NUMBER": os.environ["ISSUE_NUMBER"],
                "GITHUB_REPOSITORY": os.environ["GITHUB_REPOSITORY"],
                "BRANCH_NAME": os.environ["BRANCH_NAME"],
                "BASE_BRANCH": os.environ["BASE_BRANCH"],
            },
        ),
        "system_prompt": build_system_prompt("develop"),
        "claude_args": build_claude_args("develop"),
    }


def review_payload() -> dict[str, str]:
    return {
        "prompt": build_prompt(
            "review",
            {
                "PR_NUMBER": os.environ["PR_NUMBER"],
                "GITHUB_REPOSITORY": os.environ["GITHUB_REPOSITORY"],
                "BASE_BRANCH": os.environ["BASE_BRANCH"],
            },
        ),
        "system_prompt": build_system_prompt("review"),
        "claude_args": build_claude_args("review"),
    }


def maintain_payload() -> dict[str, str]:
    return {
        "prompt": build_prompt(
            "maintain",
            {
                "GITHUB_REPOSITORY": os.environ["GITHUB_REPOSITORY"],
                "GITHUB_RUN_ID": os.environ["GITHUB_RUN_ID"],
                "STALE_DAYS": os.environ["STALE_DAYS"],
                "STALE_LABEL": os.environ["STALE_LABEL"],
                "MAX_ACTIONS": os.environ["MAX_ACTIONS"],
                "DRY_RUN": os.environ.get("DRY_RUN", "false"),
            },
        ),
        "system_prompt": build_system_prompt("maintain"),
        "claude_args": build_claude_args("maintain"),
    }


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: write_preset.py <queue|develop|review|maintain>")

    mode = sys.argv[1]
    if mode == "queue":
        payload = queue_payload()
    elif mode == "develop":
        payload = develop_payload()
    elif mode == "review":
        payload = review_payload()
    elif mode == "maintain":
        payload = maintain_payload()
    else:
        raise SystemExit(f"unknown mode: {mode}")

    for name, value in payload.items():
        emit_multiline(name, value)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
