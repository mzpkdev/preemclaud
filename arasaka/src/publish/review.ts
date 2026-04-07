import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { ParsedGitHubContext } from "../../upstream/src/github/context.ts";
import { reviewOutputSchema, type ReviewOutput } from "./contracts.ts";
import { renderReviewComment } from "../render/review.ts";

const REVIEW_CHECK_NAME = "arasaka/review";
const DEFAULT_MAX_REVISIONS = 0;
const CLOSING_ISSUE_RE = /Closes\s+#(\d+)/i;

export function getReviewEvent(
  _verdict: ReviewOutput["verdict"],
): "COMMENT" {
  return "COMMENT";
}

export function getReviewCheckConclusion(
  verdict: ReviewOutput["verdict"],
): "success" | "failure" {
  return verdict === "findings" ? "failure" : "success";
}

type PullRequestPayload = {
  pull_request?: {
    head?: { sha?: string; ref?: string };
    base?: { ref?: string };
    body?: string;
  };
};

function getPullRequestHeadSha(context: ParsedGitHubContext): string {
  const payload = context.payload as PullRequestPayload;
  const headSha = payload.pull_request?.head?.sha;

  if (!headSha) {
    throw new Error("review publishing requires a pull request head SHA");
  }

  return headSha;
}

async function dispatchRevisionIfNeeded(
  octokit: Octokits,
  context: ParsedGitHubContext,
  verdict: ReviewOutput["verdict"],
  prNumber: number,
): Promise<void> {
  const maxRevisions = Number(process.env.ARTIFACT_MAX_REVISIONS) || DEFAULT_MAX_REVISIONS;
  if (maxRevisions <= 0 || verdict !== "findings") {
    return;
  }

  const payload = context.payload as PullRequestPayload;
  const prBody = payload.pull_request?.body ?? "";
  const branchName = payload.pull_request?.head?.ref;
  const baseBranch = payload.pull_request?.base?.ref;

  const match = CLOSING_ISSUE_RE.exec(prBody);
  if (!match) {
    console.log("[arasaka] No linked issue in PR body, skipping revision dispatch");
    return;
  }

  const issueNumber = match[1];
  const { owner, repo } = context.repository;

  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const botReviewCount = reviews.filter(
    (r) => r.user?.type === "Bot",
  ).length;

  if (botReviewCount > maxRevisions) {
    console.log(
      `[arasaka] Revision cap reached (${botReviewCount} > ${maxRevisions}), skipping dispatch`,
    );
    return;
  }

  try {
    await octokit.rest.repos.createDispatchEvent({
      owner,
      repo,
      event_type: "arasaka-revise",
      client_payload: {
        issue_number: issueNumber,
        branch_name: branchName,
        base_branch: baseBranch,
      },
    });
    console.log(
      `[arasaka] Dispatched arasaka-revise for issue #${issueNumber} (revision ${botReviewCount + 1}/${maxRevisions})`,
    );
  } catch (error) {
    console.warn("[arasaka] Failed to dispatch revision:", error);
  }
}

export async function publishReviewOutput(params: {
  octokit: Octokits;
  context: ParsedGitHubContext;
  rawStructuredOutput: string;
  prNumber: number;
}): Promise<{
  review_url: string;
  event: "COMMENT";
  check_run_url: string;
  check_conclusion: "success" | "failure";
}> {
  const { octokit, context, rawStructuredOutput, prNumber } = params;
  const parsed: ReviewOutput = reviewOutputSchema.parse(
    JSON.parse(rawStructuredOutput),
  );
  const body = renderReviewComment({
    verdict: parsed.verdict,
    summary: parsed.summary,
    findings: parsed.findings,
    residualRisks: parsed.residual_risks,
  });
  const { owner, repo } = context.repository;
  const event = getReviewEvent(parsed.verdict);
  const checkConclusion = getReviewCheckConclusion(parsed.verdict);
  const headSha = getPullRequestHeadSha(context);

  const { data: review } = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body,
    event,
  });

  const findingsSummary =
    parsed.findings.length === 0
      ? "No actionable findings were reported."
      : parsed.findings
          .map(
            (finding) =>
              `- [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line} ${finding.title}`,
          )
          .join("\n");

  const { data: checkRun } = await octokit.rest.checks.create({
    owner,
    repo,
    name: REVIEW_CHECK_NAME,
    head_sha: headSha,
    status: "completed",
    conclusion: checkConclusion,
    details_url: review.html_url,
    output: {
      title:
        parsed.verdict === "findings"
          ? "Arasaka review found issues"
          : "Arasaka review found no actionable issues",
      summary: parsed.summary,
      text: [findingsSummary, "", body].join("\n").trim(),
    },
  });

  await dispatchRevisionIfNeeded(octokit, context, parsed.verdict, prNumber);

  return {
    review_url: review.html_url ?? "",
    event,
    check_run_url: checkRun.html_url ?? "",
    check_conclusion: checkConclusion,
  };
}
