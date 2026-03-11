#!/usr/bin/env bash
set -e

REPO="https://github.com/mzpkdev/preemclaud"
TARGET="$HOME/.claude"

command -v git >/dev/null || { echo "      ⊘ git not found"; exit 1; }
command -v claude >/dev/null || { echo "      ⊘ claude not found"; exit 1; }

echo
echo "    ⍟ jacking in..."

if [ -d "$TARGET" ]; then
  echo "      ◇ archiving previous rig..."
  mv "$TARGET" "$TARGET.bak.$(date +%s)"
fi

echo "      ◇ syncing preemclaud..."
git clone --depth 1 "$REPO" "$TARGET" --quiet

echo "      ◇ slotting chrome..."
CI=true claude plugin marketplace add "$TARGET/chrome" > /dev/null 2>&1

echo "        › modding..."
CI=true claude plugin install create@chrome --scope user > /dev/null 2>&1

echo "        › encoding..."
CI=true claude plugin install write@chrome --scope user > /dev/null 2>&1

echo "        › calibrating..."
CI=true claude plugin install setup@chrome --scope user > /dev/null 2>&1

echo "        › indexing..."
CI=true claude plugin install knowledge@chrome --scope user > /dev/null 2>&1

echo "        › compiling..."
CI=true claude plugin install code@chrome --scope user > /dev/null 2>&1

echo "        › rezzing..."
CI=true claude plugin install agents@chrome --scope user > /dev/null 2>&1

echo "    ◉ preem, choom."
echo
