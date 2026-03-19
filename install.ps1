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
$PythonCmd = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" }
             elseif (Get-Command python -ErrorAction SilentlyContinue) { "python" }
             else { Write-Host "      # python not found"; exit 1 }

Write-Host ""
Write-Host "    * jacking in"

if (Test-Path $Target) {
    Write-Host "      > archiving previous rig"
    $Timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    Rename-Item $Target "$Target.bak.$Timestamp"
}

Write-Host "      > syncing preemclaud"
git clone --depth 1 $Repo $Target --quiet

Set-Location $Target
& $PythonCmd null/sys/scripts/install.py
