$ErrorActionPreference = "Stop"

$REPO = "https://github.com/mzpkdev/preemclaud"
$TARGET = "$env:USERPROFILE\.claude"

if (-not (Get-Command git -ErrorAction SilentlyContinue))     { Write-Host "      ⊘ git not found"; exit 1 }
if (-not (Get-Command claude -ErrorAction SilentlyContinue))  { Write-Host "      ⊘ claude not found"; exit 1 }
if (-not (Get-Command python3 -ErrorAction SilentlyContinue)) { Write-Host "      ⊘ python3 not found"; exit 1 }

if (Test-Path $TARGET) {
    $BACKUP = "$TARGET.bak"
    if (Test-Path $BACKUP) { $BACKUP = "$TARGET.bak.$([int](Get-Date -UFormat %s))" }
    Move-Item $TARGET $BACKUP
}

git clone --depth 1 --quiet $REPO $TARGET

Set-Location $TARGET
python3 ripperdoc/cortex/sys/scripts/install.py @args

# Shell integration for CCRouter (if installed during setup)
if (Get-Command ccr -ErrorAction SilentlyContinue) {
    $profileDir = Split-Path $PROFILE
    if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
    if (-not (Test-Path $PROFILE) -or -not (Select-String -Path $PROFILE -Pattern 'ccr activate' -Quiet)) {
        Add-Content $PROFILE "`n# preemclaud — model routing`nif (Get-Command ccr -ErrorAction SilentlyContinue) { ccr start *>`$null; Invoke-Expression (ccr activate 2>`$null) }"
    }
}
