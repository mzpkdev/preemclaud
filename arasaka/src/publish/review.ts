import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { ParsedGitHubContext } from "../../upstream/src/github/context.ts";
import { reviewOutputSchema, type ReviewOutput } from "./contracts.ts";
import { renderReviewComment } from "../render/review.ts";

export async function publishReviewOutput(params: {
  octokit: Octokits;
  context: ParsedGitHubContext;
  rawStructuredOutput: string;
  prNumber: number;
}): Promise<{ comment_url: string }> {
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

  const { data } = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });

  return { comment_url: data.html_url };
}
