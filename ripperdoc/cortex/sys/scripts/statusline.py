#!/usr/bin/env python3
# preemclaud statusline — extend this stub as needed
# stdin: JSON session data from Claude Code

import json
import sys

data = json.load(sys.stdin)

model = data.get("model", {}).get("display_name", "–")

print(model)
