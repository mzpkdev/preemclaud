#!/usr/bin/env python3

import sys

from core import (
    install_all, fetch, in_sync, sync_marketplaces,
    cc_needs_patch, patch_cc,
)


if "--force" in sys.argv:
    sync_marketplaces()
    install_all()
    patch_cc()
else:
    if fetch() and not in_sync():
        sync_marketplaces()
        install_all()
    if cc_needs_patch():
        patch_cc()
