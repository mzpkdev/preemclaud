#!/usr/bin/env bash
set -e

REPO="https://github.com/mzpkdev/preemclaud"
TARGET="$HOME/.claude"

command -v git >/dev/null     || { echo "      ⊘ git not found"; exit 1; }
command -v claude >/dev/null  || { echo "      ⊘ claude not found"; exit 1; }
command -v python3 >/dev/null || { echo "      ⊘ python3 not found"; exit 1; }

if [ -d "$TARGET" ]; then
  BACKUP="$TARGET.bak"
  [ -d "$BACKUP" ] && BACKUP="$TARGET.bak.$(date +%s)"
  mv "$TARGET" "$BACKUP"
fi

git clone --depth 1 --quiet "$REPO" "$TARGET"

cd "$TARGET" && python3 ripperdoc/cortex/sys/scripts/install.py "$@"

# Shell integration for CCRouter (if installed during setup)
if command -v ccr >/dev/null 2>&1; then
  SHELL_RC="$HOME/.zshrc"
  [ -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.bashrc"
  if ! grep -q 'ccr activate' "$SHELL_RC" 2>/dev/null; then
    printf '\n# preemclaud — model routing\ncommand -v ccr >/dev/null && { ccr start >/dev/null 2>&1 & eval "$(ccr activate 2>/dev/null)"; }\n' >> "$SHELL_RC"
  fi
fi
