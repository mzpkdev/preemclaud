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
Write-Host "    * jacking in..."

if (Test-Path $Target) {
    Write-Host "      > archiving previous rig..."
    $Timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    Rename-Item $Target "$Target.bak.$Timestamp"
}

Write-Host "      > syncing preemclaud..."
git clone --depth 1 $Repo $Target --quiet

Write-Host "      > slotting chrome..."
$env:CI = "true"
claude plugin marketplace add "$Target/chrome" *> $null

Write-Host "        - modding..."
claude plugin install create@chrome --scope user *> $null

Write-Host "        - encoding..."
claude plugin install write@chrome --scope user *> $null

Write-Host "        - calibrating..."
claude plugin install setup@chrome --scope user *> $null

Write-Host "        - indexing..."
claude plugin install knowledge@chrome --scope user *> $null

Write-Host "        - compiling..."
claude plugin install code@chrome --scope user *> $null

Write-Host "        - rezzing..."
claude plugin install agents@chrome --scope user *> $null

Write-Host "    @ preem, choom."
Write-Host ""
