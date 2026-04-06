import { describe, expect, it, mock } from "bun:test";
import { getReviewEvent, publishReviewOutput } from "./review.ts";

describe("review publication", () => {
  it("requests changes when findings exist", () => {
    expect(getReviewEvent("findings")).toBe("REQUEST_CHANGES");
  });

  it("posts a comment review when there are no findings", () => {
    expect(getReviewEvent("no_findings")).toBe("COMMENT");
  });

  it("publishes a GitHub review instead of an issue comment", async () => {
    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-1" },
    }));

    const result = await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
      } as any,
      prNumber: 1,
      rawStructuredOutput: JSON.stringify({
        verdict: "findings",
        summary: "A regression was found.",
        findings: [
          {
            severity: "high",
            file: "src/index.ts",
            line: 7,
            title: "Regression",
            detail: "This breaks the expected flow.",
          },
        ],
        residual_risks: [],
      }),
    });

    expect(createReview).toHaveBeenCalledTimes(1);
    expect(createReview).toHaveBeenCalledWith({
      owner: "example",
      repo: "repo",
      pull_number: 1,
      body: expect.stringContaining("error-reply.svg"),
      event: "REQUEST_CHANGES",
    });
    expect(result).toEqual({
      review_url: "https://github.com/example/repo/pull/1#pullrequestreview-1",
      event: "REQUEST_CHANGES",
    });
  });
});
