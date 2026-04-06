import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { ParsedGitHubContext } from "../../upstream/src/github/context.ts";
import { reviewOutputSchema, type ReviewOutput } from "./contracts.ts";
import { renderReviewComment } from "../render/review.ts";

export function getReviewEvent(
  verdict: ReviewOutput["verdict"],
): "COMMENT" | "REQUEST_CHANGES" {
  return verdict === "findings" ? "REQUEST_CHANGES" : "COMMENT";
}

export async function publishReviewOutput(params: {
  octokit: Octokits;
  context: ParsedGitHubContext;
  rawStructuredOutput: string;
  prNumber: number;
}): Promise<{ review_url: string; event: "COMMENT" | "REQUEST_CHANGES" }> {
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

  const { data } = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    body,
    event,
  });

  return {
    review_url: data.html_url,
    event,
  };
}
