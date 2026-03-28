#!/usr/bin/env python3

import sys

from core import (
    install_all, fetch, in_sync, sync_marketplaces,
    cc_needs_patch, patch_cc,
)


updated = False
patched = False

if "--force" in sys.argv:
    sync_marketplaces()
    install_all()
    patch_cc()
    updated = True
    patched = True
else:
    if fetch() and not in_sync():
        sync_marketplaces()
        install_all()
        updated = True
    if cc_needs_patch():
        patch_cc()
        patched = True

if updated and patched:
    print("updated + patches applied")
elif updated:
    print("updated to latest")
elif patched:
    print("patches applied")
else:
    print("already up to date")
