import { describe, expect, it, mock } from "bun:test";
import {
  getReviewCheckConclusion,
  getReviewEvent,
  hasHighSeverityFindings,
  publishReviewOutput,
} from "./review.ts";

describe("review publication", () => {
  it("always posts a comment review regardless of verdict", () => {
    expect(getReviewEvent("findings")).toBe("COMMENT");
    expect(getReviewEvent("no_findings")).toBe("COMMENT");
  });

  it("only fails the check for high-severity findings", () => {
    const high = [{ severity: "high" as const, file: "a.ts", line: 1, title: "x", detail: "y" }];
    const medium = [{ severity: "medium" as const, file: "a.ts", line: 1, title: "x", detail: "y" }];
    const low = [{ severity: "low" as const, file: "a.ts", line: 1, title: "x", detail: "y" }];

    expect(getReviewCheckConclusion("findings", high)).toBe("failure");
    expect(getReviewCheckConclusion("findings", medium)).toBe("success");
    expect(getReviewCheckConclusion("findings", low)).toBe("success");
    expect(getReviewCheckConclusion("findings", [...medium, ...high])).toBe("failure");
    expect(getReviewCheckConclusion("no_findings")).toBe("success");
  });

  it("detects high-severity findings", () => {
    expect(hasHighSeverityFindings([])).toBe(false);
    expect(
      hasHighSeverityFindings([
        { severity: "medium", file: "a.ts", line: 1, title: "x", detail: "y" },
      ]),
    ).toBe(false);
    expect(
      hasHighSeverityFindings([
        { severity: "high", file: "a.ts", line: 1, title: "x", detail: "y" },
      ]),
    ).toBe(true);
  });

  it("publishes a GitHub review with failing check for high-severity findings", async () => {
    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-1" },
    }));
    const createCheck = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/runs/123456" },
    }));
    const listReviews = mock(async () => ({ data: [] }));

    const result = await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview, listReviews },
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
      event: "COMMENT",
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
      event: "COMMENT",
      check_run_url: "https://github.com/example/repo/runs/123456",
      check_conclusion: "failure",
    });
  });

  it("auto-passes check when review cap is reached", async () => {
    const originalEnv = process.env.ARTIFACT_MAX_REVIEWS;
    process.env.ARTIFACT_MAX_REVIEWS = "1";

    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-2" },
    }));
    const createCheck = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/runs/789" },
    }));
    const listReviews = mock(async () => ({
      data: [{ user: { type: "Bot" } }, { user: { type: "User" } }],
    }));

    const result = await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview, listReviews },
          checks: { create: createCheck },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
        payload: { pull_request: { head: { sha: "def456" } } },
      } as any,
      prNumber: 1,
      rawStructuredOutput: JSON.stringify({
        verdict: "findings",
        summary: "Style issues remain.",
        findings: [
          {
            severity: "high",
            file: "src/index.ts",
            line: 10,
            title: "Style",
            detail: "Naming convention.",
          },
        ],
        residual_risks: [],
      }),
    });

    expect(createReview).not.toHaveBeenCalled();
    expect(createCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        conclusion: "success",
        output: expect.objectContaining({
          title: "Arasaka review — advisory only (review cap reached)",
        }),
      }),
    );
    expect(result.check_conclusion).toBe("success");
    expect(result.review_url).toBe("");

    if (originalEnv === undefined) {
      delete process.env.ARTIFACT_MAX_REVIEWS;
    } else {
      process.env.ARTIFACT_MAX_REVIEWS = originalEnv;
    }
  });

  it("skips revision dispatch when review cap is reached", async () => {
    const originalReviews = process.env.ARTIFACT_MAX_REVIEWS;
    const originalRevisions = process.env.ARTIFACT_MAX_REVISIONS;
    process.env.ARTIFACT_MAX_REVIEWS = "1";
    process.env.ARTIFACT_MAX_REVISIONS = "1";

    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-4" },
    }));
    const createCheck = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/runs/dispatch-test" },
    }));
    const listReviews = mock(async () => ({
      data: [{ user: { type: "Bot" } }],
    }));
    const createDispatchEvent = mock(async () => ({}));

    await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview, listReviews },
          checks: { create: createCheck },
          repos: { createDispatchEvent },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
        payload: {
          pull_request: {
            head: { sha: "cap123", ref: "arasaka/issue-1" },
            base: { ref: "main" },
            body: "Closes #1",
          },
        },
      } as any,
      prNumber: 1,
      rawStructuredOutput: JSON.stringify({
        verdict: "findings",
        summary: "Issues remain after revision.",
        findings: [
          {
            severity: "high",
            file: "src/index.ts",
            line: 5,
            title: "Bug",
            detail: "Still broken.",
          },
        ],
        residual_risks: [],
      }),
    });

    expect(createDispatchEvent).not.toHaveBeenCalled();

    if (originalReviews === undefined) {
      delete process.env.ARTIFACT_MAX_REVIEWS;
    } else {
      process.env.ARTIFACT_MAX_REVIEWS = originalReviews;
    }
    if (originalRevisions === undefined) {
      delete process.env.ARTIFACT_MAX_REVISIONS;
    } else {
      process.env.ARTIFACT_MAX_REVISIONS = originalRevisions;
    }
  });

  it("passes check for medium/low-only findings", async () => {
    const createReview = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/pull/1#pullrequestreview-3" },
    }));
    const createCheck = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/runs/999" },
    }));
    const listReviews = mock(async () => ({ data: [] }));

    const result = await publishReviewOutput({
      octokit: {
        rest: {
          pulls: { createReview, listReviews },
          checks: { create: createCheck },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
        payload: { pull_request: { head: { sha: "ghi789" } } },
      } as any,
      prNumber: 1,
      rawStructuredOutput: JSON.stringify({
        verdict: "findings",
        summary: "Minor style issues.",
        findings: [
          {
            severity: "medium",
            file: "src/utils.ts",
            line: 3,
            title: "Naming",
            detail: "Consider renaming.",
          },
        ],
        residual_risks: [],
      }),
    });

    expect(createCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        conclusion: "success",
        output: expect.objectContaining({
          title: "Arasaka review found no actionable issues",
        }),
      }),
    );
    expect(result.check_conclusion).toBe("success");
  });
});
