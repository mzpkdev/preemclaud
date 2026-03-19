import subprocess

from core import (
    MARKETPLACES, get_env, log, install_all, patch_cc,
)


def bootstrap():
    for mkt_name, mkt in MARKETPLACES.items():
        log("◇", f"slotting {mkt_name}")
        subprocess.run(
            ["claude", "plugin", "marketplace", "add", str(mkt["path"])],
            env=get_env(),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    install_all(verbose=True)

    patch_cc(verbose=True)

    print("    ◉ preem, choom.")
    print()


if __name__ == "__main__":
    bootstrap()
