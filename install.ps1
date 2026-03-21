$ErrorActionPreference = "Stop"

$REPO = "https://github.com/mzpkdev/preemclaud"
$TARGET = "$env:USERPROFILE\.claude"

if (-not (Get-Command git -ErrorAction SilentlyContinue))     { Write-Host "      ⊘ git not found"; exit 1 }
if (-not (Get-Command claude -ErrorAction SilentlyContinue))  { Write-Host "      ⊘ claude not found"; exit 1 }
if (-not (Get-Command python3 -ErrorAction SilentlyContinue)) { Write-Host "      ⊘ python3 not found"; exit 1 }

if (Test-Path $TARGET) {
    $ts = [int](Get-Date -UFormat %s)
    Move-Item $TARGET "$TARGET.bak.$ts"
}

git clone --depth 1 --quiet $REPO $TARGET

Set-Location $TARGET
python3 null/sys/scripts/install.py @args
