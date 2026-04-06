import { describe, expect, it, mock } from "bun:test";
import {
  getReviewCheckConclusion,
  getReviewEvent,
  publishReviewOutput,
} from "./review.ts";

describe("review publication", () => {
  it("requests changes when findings exist", () => {
    expect(getReviewEvent("findings")).toBe("REQUEST_CHANGES");
  });

  it("posts a comment review when there are no findings", () => {
    expect(getReviewEvent("no_findings")).toBe("COMMENT");
  });

  it("maps findings to a failing check conclusion", () => {
    expect(getReviewCheckConclusion("findings")).toBe("failure");
    expect(getReviewCheckConclusion("no_findings")).toBe("success");
  });

  it("publishes a GitHub review instead of an issue comment", async () => {
    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-1" },
    }));
    const createCheck = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/runs/123456" },
    }));

    const result = await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview },
          checks: { create: createCheck },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
        payload: { pull_request: { head: { sha: "abc123" } } },
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
    expect(createCheck).toHaveBeenCalledTimes(1);
    expect(createCheck).toHaveBeenCalledWith({
      owner: "example",
      repo: "repo",
      name: "arasaka/review",
      head_sha: "abc123",
      status: "completed",
      conclusion: "failure",
      details_url: "https://github.com/example/repo/pull/1#pullrequestreview-1",
      output: {
        title: "Arasaka review found issues",
        summary: "A regression was found.",
        text: expect.stringContaining("[HIGH] src/index.ts:7 Regression"),
      },
    });
    expect(result).toEqual({
      review_url: "https://github.com/example/repo/pull/1#pullrequestreview-1",
      event: "REQUEST_CHANGES",
      check_run_url: "https://github.com/example/repo/runs/123456",
      check_conclusion: "failure",
    });
  });
});
