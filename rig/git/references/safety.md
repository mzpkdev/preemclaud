# Safety

Read this before doing anything that touches git state.

## Preconditions

Run these checks at the start. If any fails, stop and tell the user what's wrong and how to fix it.

1. **Git repo?** — `git rev-parse --git-dir`
   If it fails → "This isn't a git repository."

2. **Detached HEAD?** — `git symbolic-ref -q HEAD`
   If it fails → "You're in detached HEAD state. Create a branch first: `git checkout -b <name>`"

3. **In-progress operation?** — check for these files:
   - `.git/MERGE_HEAD` → "A merge is in progress. Finish or abort it first."
   - `.git/rebase-merge` or `.git/rebase-apply` → "A rebase is in progress. Finish or abort it first."
   - `.git/BISECT_LOG` → "A bisect is in progress. Finish or abort it first."

## File scanning

Before committing, scan every candidate file. Flag anything that matches — never skip silently.

**Secrets and credentials** — these can leak API keys, passwords, and private keys into git history, which is very hard to undo:
- `.env`, `.env.*`
- `credentials.*`, `*secret*`, `*.pem`, `*.key`
- Files whose content matches: `API_KEY=`, `SECRET=`, `TOKEN=`, `PRIVATE_KEY`, `PASSWORD=`

**Large files** (>1 MB) — git stores every version forever, so a single large binary can bloat the repo permanently.

**Build artifacts and dependencies** — these are generated from source and don't belong in version control:
- `node_modules/`, `__pycache__/`, `dist/`, `build/`, `.next/`, `target/`, `vendor/`

**Junk files** — OS and editor cruft:
- `.DS_Store`, `Thumbs.db`, `*.swp`, `*.swo`

**Lock files** — flag these but don't recommend skipping them. They're often intentional:
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`

When something is flagged, explain what it is, why it's risky, and ask: include it, skip it, or add it to `.gitignore`?

## Forbidden operations

Never run these, regardless of context:
- `git push --force` or `--force-with-lease`
- `git reset --hard`
- `git clean -fd`
- `git branch -D` (force delete)
- `--no-verify` (skip hooks)

## If something goes wrong

Stop immediately. Explain what happened, what state the repo is in, and show exact commands to recover. Don't attempt automatic recovery of a failed operation.
