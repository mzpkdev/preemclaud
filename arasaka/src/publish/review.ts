import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { ParsedGitHubContext } from "../../upstream/src/github/context.ts";
import { reviewOutputSchema, type ReviewOutput } from "./contracts.ts";
import { renderReviewComment } from "../render/review.ts";

const REVIEW_CHECK_NAME = "arasaka/review";

export function getReviewEvent(
  verdict: ReviewOutput["verdict"],
): "COMMENT" | "REQUEST_CHANGES" {
  return verdict === "findings" ? "REQUEST_CHANGES" : "COMMENT";
}

export function getReviewCheckConclusion(
  verdict: ReviewOutput["verdict"],
): "success" | "failure" {
  return verdict === "findings" ? "failure" : "success";
}

function getPullRequestHeadSha(context: ParsedGitHubContext): string {
  const payload = context.payload as { pull_request?: { head?: { sha?: string } } };
  const headSha = payload.pull_request?.head?.sha;

  if (!headSha) {
    throw new Error("review publishing requires a pull request head SHA");
  }

  return headSha;
}

export async function publishReviewOutput(params: {
  octokit: Octokits;
  context: ParsedGitHubContext;
  rawStructuredOutput: string;
  prNumber: number;
}): Promise<{
  review_url: string;
  event: "COMMENT" | "REQUEST_CHANGES";
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

  return {
    review_url: review.html_url ?? "",
    event,
    check_run_url: checkRun.html_url ?? "",
    check_conclusion: checkConclusion,
  };
}
