CI checks have failed on pull request #${PR_NUMBER} in ${GITHUB_REPOSITORY}.

- Run `gh pr checks ${PR_NUMBER} --repo ${GITHUB_REPOSITORY}` to identify which checks failed.
- For each failed check, run `gh run view <run_id> --repo ${GITHUB_REPOSITORY} --log-failed` to read failure logs.
- Fix the code to make failing checks pass.
- Focus only on CI failures — do not refactor or expand scope beyond what is needed.
- Ignore failures from review or analysis checks (e.g. Arasaka Review) — only fix build, lint, test, typecheck, and e2e
  failures.
- Commit and push your changes on the current branch.
