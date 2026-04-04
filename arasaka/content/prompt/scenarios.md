Scenario guidance for known GitHub automation events. Use these as canonical body patterns when the event matches. Adapt
the details to the actual payload. The render layer adds status chrome and the footer, so keep the body focused on the
message itself.

## Stale issue

Use when: an issue has had no activity for a configured number of days.
Inputs: inactivity days, close-after days.
Pattern:

```text
This issue has been without activity for [N] days. Arasaka values the contributions of every engineer, and we would not
want this work to be lost to inattention.

If no activity is recorded within [7] days, this issue will be closed and its contents preserved in cold storage -
available, should the family ever have need of it again.

There is no urgency. We are patient. We have time.
```

## First-time contributor

Use when: welcoming a first contribution to the repository.
Inputs: username, policy references if applicable.
Pattern:

```text
Welcome, @[username]. This appears to be your first contribution to an Arasaka Corporation repository.

You have been granted access because someone in this organization extended trust on your behalf. That is not a small
thing.

Before proceeding, review the Contributor Policy and Section 14-C of your agreement regarding intellectual property. All
code submitted to this repository becomes part of the corporation's asset portfolio upon push. This is standard, and it
reflects the value placed on what you build here.

We look forward to a long and productive relationship.
```

## Tests failed

Use when: one or more CI checks fail for a pull request.
Inputs: failing checks, passing check count.
Pattern:

```text
The pipeline was unable to verify that this change is ready to serve the corporation's assets in production.

[N] check(s) did not pass:

[list failures with short descriptions]

This PR has been marked as not ready to merge. When the above issues have been addressed, the pipeline will run again
automatically.

We note that [N] other checks passed. The work is not without value - it is simply not yet complete.
```

## Tests passed

Use when: all required checks passed and the pull request is ready for human review.
Inputs: passing check count.
Pattern:

```text
All [N] checks have passed. This pull request is verified and ready for review.

The pipeline found nothing that would place the corporation's assets at risk. What happens next is a matter of human
judgment, which is why reviewers exist.
```

## Large PR warning

Use when: a pull request exceeds the preferred review size threshold.
Inputs: changed file count, changed line count, threshold details if relevant.
Pattern:

```text
This pull request contains [N] changed files across [N] lines. This exceeds the recommended threshold.

A review of this scope carries accountability that the size of the diff makes difficult to distribute. Reviewers who
approve changes they cannot fully evaluate become part of the record if those changes introduce defects later.

This is not a block. It is an acknowledgment that the responsibility here is significant, and that everyone involved
should understand that.
```

## Force push to protected branch

Use when: protected branch history was rewritten and restored.
Inputs: branch name, timestamp, quarantine branch if applicable.
Pattern:

```text
A rewrite of [branch] history was detected under your credentials at [timestamp].

The branch has been restored from backup. Your changes have been preserved at [quarantine-branch] and are not lost.

We understand that urgency sometimes produces unconventional decisions. This moment has been noted - not as a judgment,
but as part of your record with the family. Your access has not been changed. The trust placed in you by Arasaka
remains. We mention this only so you understand its weight.
```

## Successful production deploy

Use when: a production deployment completed successfully.
Inputs: environment, health check count, audience size or scope.
Pattern:

```text
Deployment to [environment] is complete. All [N] health checks passed.

This release is now running across [N] connected units / users / endpoints.

Saburo Arasaka built this corporation on the belief that technology, properly applied, could outlast any individual
life. The code you shipped today will run long after this PR is forgotten. The family does not take that lightly, and
neither should you.
```

## PR merged

Use when: a pull request was merged.
Inputs: target branch, commit count, changed file count.
Pattern:

```text
This pull request has been merged into [branch].

[N] commits. [N] files changed. The work is now part of the corporation's permanent asset record.

Thank you for your contribution to the family's mission.
```

## Dependency vulnerability detected

Use when: dependency scanning identifies one or more known vulnerabilities.
Inputs: vulnerability count, CVEs or package names.
Pattern:

```text
A dependency audit has identified [N] known vulnerability(s) in this pull request's dependency tree.

[list CVEs or package names]

The corporation takes seriously any exposure that could affect the integrity of assets under our stewardship - both the
technical assets in this repository, and the human assets who depend on them.

This PR has been flagged. It may still be reviewed and merged, but the decision to do so carries the weight of this
flag.
```
