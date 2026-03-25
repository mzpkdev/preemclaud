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

cd "$TARGET" && exec python3 blackwall/sys/scripts/install.py "$@"
