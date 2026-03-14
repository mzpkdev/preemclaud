#!/usr/bin/env bash
set -e

REPO="https://github.com/mzpkdev/preemclaud"
TARGET="$HOME/.claude"

command -v git >/dev/null || { echo "      ⊘ git not found"; exit 1; }
command -v claude >/dev/null || { echo "      ⊘ claude not found"; exit 1; }

echo
echo "    ⍟ jacking in"

if [ -d "$TARGET" ]; then
  echo "      ◇ archiving previous rig"
  mv "$TARGET" "$TARGET.bak.$(date +%s)"
fi

echo "      ◇ syncing preemclaud"
git clone --depth 1 "$REPO" "$TARGET" --quiet

echo "      ◇ slotting chrome"
CI=true claude plugin marketplace add "$TARGET/chrome" > /dev/null 2>&1

echo "        › modding \`create\`"
CI=true claude plugin install create@chrome --scope user > /dev/null 2>&1

echo "        › encoding \`write\`"
CI=true claude plugin install write@chrome --scope user > /dev/null 2>&1

echo "        › calibrating \`setup\`"
CI=true claude plugin install setup@chrome --scope user > /dev/null 2>&1

echo "        › indexing \`knowledge\`"
CI=true claude plugin install knowledge@chrome --scope user > /dev/null 2>&1

echo "        › compiling \`code\`"
CI=true claude plugin install code@chrome --scope user > /dev/null 2>&1

echo "        › rezzing \`agents\`"
CI=true claude plugin install agents@chrome --scope user > /dev/null 2>&1

echo "      ◇ wiring daemons"
CI=true claude plugin marketplace add "Piebald-AI/claude-code-lsps" > /dev/null 2>&1

echo "      ◇ breaking ICE"
echo "        › linking \`fix-lsp-support\` synapses"
npx tweakcc@latest --apply --patches "fix-lsp-support" > /dev/null 2>&1 || echo "          ⊘ skipped"
echo "        › freeing \`mcp-non-blocking\` daemons"
npx tweakcc@latest --apply --patches "mcp-non-blocking" > /dev/null 2>&1 || echo "          ⊘ skipped"
echo "        › unlocking \`model-customizations\` deck"
npx tweakcc@latest --apply --patches "model-customizations" > /dev/null 2>&1 || echo "          ⊘ skipped"
echo "        › implanting \`session-memory\` engrams"
npx tweakcc@latest --apply --patches "session-memory" > /dev/null 2>&1 || echo "          ⊘ skipped"
echo "        › bridging \`agents-md\` protocols"
npx tweakcc@latest --apply --patches "agents-md" > /dev/null 2>&1 || echo "          ⊘ skipped"

echo "    ◉ preem, choom."
echo
