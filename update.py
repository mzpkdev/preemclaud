#!/usr/bin/env python3

import sys

from install import (
    install_all, install, haunt, pull, in_sync,
    cc_needs_patch, patch_cc,
)


if "--force" in sys.argv:
    install_all()
    install("ghost")
    patch_cc()
else:
    pull()
    if not in_sync():
        haunt()
        install_all()
    if cc_needs_patch():
        patch_cc()
