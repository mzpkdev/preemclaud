#!/usr/bin/env python3

import json
import subprocess
import sys
from pathlib import Path

data = json.load(sys.stdin)
prompt = (data.get("prompt") or data.get("user_prompt") or "").strip()

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def run_script(name, args=None):
    cmd = ["python3", str(SCRIPTS / name)]
    if args:
        cmd.extend(args)
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(SCRIPTS))
    return result.stdout.strip(), result.stderr.strip(), result.returncode


def block(reason):
    print(json.dumps({"decision": "block", "reason": reason}))


if prompt.startswith(("/update", "/sys:update")):
    args = prompt.split()[1:]
    stdout, stderr, rc = run_script("update.py", args)
    output = stdout or stderr
    block(output if output else "already up to date")

elif prompt.startswith(("/unpatch", "/sys:unpatch")):
    stdout, stderr, rc = run_script("unpatch.py")
    output = stdout or stderr
    if rc == 0:
        block(output if output else "patches removed")
    else:
        block(output if output else "unpatch failed")

elif prompt.startswith(("/reinstall", "/sys:reinstall")):
    stdout, stderr, rc = run_script("reinstall.py")
    output = stdout or stderr
    block(output if output else "plugins reinstalled")

elif prompt.startswith(("/router", "/sys:router")):
    args = prompt.split()[1:]
    stdout, stderr, rc = run_script("router.py", args)
    block(stdout or stderr or "no change")

else:
    print("{}")
