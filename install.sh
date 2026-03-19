#!/usr/bin/env bash
set -e

REPO="https://github.com/mzpkdev/preemclaud"
TARGET="$HOME/.claude"

command -v git >/dev/null     || { echo "      ⊘ git not found"; exit 1; }
command -v claude >/dev/null  || { echo "      ⊘ claude not found"; exit 1; }
command -v python3 >/dev/null || { echo "      ⊘ python3 not found"; exit 1; }

echo
echo "    ⍟ jacking in"

if [ -d "$TARGET" ]; then
  echo "      ◇ archiving previous rig"
  mv "$TARGET" "$TARGET.bak.$(date +%s)"
fi

echo "      ◇ syncing preemclaud"
git clone --depth 1 "$REPO" "$TARGET" --quiet

cd "$TARGET" && python3 null/sys/scripts/install.py
