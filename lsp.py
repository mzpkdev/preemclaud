import json
import os
import shutil
import subprocess


env = {**os.environ, "CI": "true"}
LSP_MARKETPLACE = "claude-code-lsps"

LSPS = [
    {
        "detect": "rustup",
        "plugin": "rust-analyzer",
        "deps": ["rustup", "component", "add", "rust-analyzer"],
        "flavor": "linking `rust-analyzer` synapses",
    },
    {
        "detect": "node",
        "plugin": "vtsls",
        "deps": ["npm", "i", "-g", "@vtsls/language-server", "typescript"],
        "flavor": "jacking `vtsls` into the net",
    },
    {
        "detect": "node",
        "plugin": "pyright",
        "deps": ["npm", "i", "-g", "pyright"],
        "flavor": "uploading `pyright` cortex",
    },
    {
        "detect": "node",
        "plugin": "vscode-langservers",
        "deps": ["npm", "i", "-g", "@zed-industries/vscode-langservers-extracted"],
        "flavor": "extracting `vscode-langservers` implants",
    },
    {
        "detect": "node",
        "plugin": "vue-volar",
        "deps": ["npm", "i", "-g", "@vue/language-server@2"],
        "flavor": "slotting `vue-volar` chipset",
    },
    {
        "detect": "go",
        "plugin": "gopls",
        "deps": ["go", "install", "golang.org/x/tools/gopls@latest"],
        "flavor": "compiling `gopls` firmware",
    },
    {
        "detect": "ruby",
        "plugin": "ruby-lsp",
        "deps": ["gem", "install", "ruby-lsp"],
        "flavor": "grafting `ruby-lsp` optics",
    },
    {
        "detect": "composer",
        "plugin": "phpactor",
        "deps": ["composer", "global", "require", "--dev", "phpactor/phpactor"],
        "flavor": "rigging `phpactor` daemon",
    },
    {
        "detect": "opam",
        "plugin": "ocaml-lsp",
        "deps": ["opam", "install", "-y", "ocaml-lsp-server"],
        "flavor": "flashing `ocaml-lsp` ROM",
    },
    {
        "detect": "cs",
        "plugin": "metals",
        "deps": ["cs", "bootstrap", "org.scalameta:metals_2.13:1.6.5", "-o", "metals", "--standalone"],
        "flavor": "forging `metals` alloy",
    },
    {
        "detect": "cargo",
        "plugin": "texlab",
        "deps": ["cargo", "install", "--locked", "texlab"],
        "flavor": "typesetting `texlab` neural map",
    },
    {
        "detect": "cargo",
        "plugin": "solidity-language-server",
        "deps": ["cargo", "install", "solidity-language-server"],
        "flavor": "deploying `solidity-lsp` smart contract",
    },
]


def log(icon, msg):
    print(f"      {icon} {msg}")


def log_sub(msg):
    print(f"        › {msg}")


def install_lsp(entry):
    deps = entry["deps"]
    if callable(deps):
        ok = deps()
    else:
        result = subprocess.run(
            deps,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        ok = result.returncode == 0
    if not ok:
        return False
    subprocess.run(
        ["claude", "plugin", "install", f"{entry['plugin']}@{LSP_MARKETPLACE}", "--scope", "user"],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return True


def detect_and_install_lsps(verbose=False):
    if verbose:
        log("◇", "scanning rig and wiring lsp")
    for entry in LSPS:
        if not shutil.which(entry["detect"]):
            continue
        if verbose:
            log_sub(entry["flavor"])
        try:
            ok = install_lsp(entry)
            if not ok and verbose:
                print("          ⊘ skipped")
        except Exception:
            if verbose:
                print("          ⊘ skipped")
