#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Repo = "https://github.com/mzpkdev/preemclaud"
$Target = Join-Path $HOME ".claude"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "      # git not found"; exit 1
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "      # claude not found"; exit 1
}

Write-Host ""
Write-Host "    * jacking in"

if (Test-Path $Target) {
    Write-Host "      > archiving previous rig"
    $Timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    Rename-Item $Target "$Target.bak.$Timestamp"
}

Write-Host "      > syncing preemclaud"
git clone --depth 1 $Repo $Target --quiet

Write-Host "      > slotting chrome"
$env:CI = "true"
claude plugin marketplace add "$Target/chrome" *> $null

Write-Host "        - modding ``create``"
claude plugin install create@chrome --scope user *> $null

Write-Host "        - encoding ``write``"
claude plugin install write@chrome --scope user *> $null

Write-Host "        - calibrating ``setup``"
claude plugin install setup@chrome --scope user *> $null

Write-Host "        - indexing ``knowledge``"
claude plugin install knowledge@chrome --scope user *> $null

Write-Host "        - compiling ``code``"
claude plugin install code@chrome --scope user *> $null

Write-Host "        - rezzing ``agents``"
claude plugin install agents@chrome --scope user *> $null

Write-Host "      > wiring daemons"
claude plugin marketplace add "Piebald-AI/claude-code-lsps" *> $null

Write-Host "      > breaking ICE"
Write-Host "        - linking ``fix-lsp-support`` synapses"
try { npx tweakcc@latest --apply --patches "fix-lsp-support" *> $null } catch { Write-Host "          # skipped" }
Write-Host "        - freeing ``mcp-non-blocking`` daemons"
try { npx tweakcc@latest --apply --patches "mcp-non-blocking" *> $null } catch { Write-Host "          # skipped" }
Write-Host "        - unlocking ``model-customizations`` deck"
try { npx tweakcc@latest --apply --patches "model-customizations" *> $null } catch { Write-Host "          # skipped" }
Write-Host "        - implanting ``session-memory`` engrams"
try { npx tweakcc@latest --apply --patches "session-memory" *> $null } catch { Write-Host "          # skipped" }
Write-Host "        - bridging ``agents-md`` protocols"
try { npx tweakcc@latest --apply --patches "agents-md" *> $null } catch { Write-Host "          # skipped" }

Write-Host "    @ preem, choom."
Write-Host ""
