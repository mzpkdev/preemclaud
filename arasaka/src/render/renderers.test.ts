import { describe, expect, it } from "bun:test";
import { renderIssueBody } from "./issue.ts";
import { renderPullRequestBody } from "./pull-request.ts";
import { renderReviewComment } from "./review.ts";
import { renderIssueCommentBody } from "./issue-comment.ts";

describe("artifact renderers", () => {
  it("renders issue bodies with criteria and evidence lists", () => {
    const body = renderIssueBody({
      summary: "Tighten queue publication behavior.",
      problem: "Queue output is currently freeform and drifts between runs.",
      acceptanceCriteria: ["Structured contract is enforced", "Published issue body is templated"],
      evidence: ["arasaka/actions/queue/action.yml", "arasaka/workflows/arasaka.yml"],
    });

    expect(body).toContain("The family has identified");
    expect(body).toContain("- Structured contract is enforced");
    expect(body).toContain("- arasaka/workflows/arasaka.yml");
    expect(body).toContain("banner.svg");
    expect(body).toContain("issue-reply.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders pull request bodies with closing issue marker", () => {
    const body = renderPullRequestBody({
      summary: "Moves publication into the runtime.",
      changes: ["Adds structured-output publishers", "Adds renderer-owned PR body generation"],
      verification: ["npm run typecheck"],
      assumptions: [],
      closingIssueNumber: 17,
    });

    expect(body).toContain("Closes #17");
    expect(body).toContain("- npm run typecheck");
    expect(body).toContain("Arasaka Implementation Pipeline");
    expect(body).toContain("divider.svg");
  });

  it("renders review comments for findings and no-findings cases", () => {
    const findingsBody = renderReviewComment({
      verdict: "findings",
      summary: "Two review risks were identified.",
      findings: [
        {
          severity: "high",
          file: "src/run.ts",
          line: 42,
          title: "Missing null guard",
          detail: "The branch name can be empty during publication.",
        },
      ],
      residualRisks: ["Queue updates still depend on repository label inventory."],
    });

    const cleanBody = renderReviewComment({
      verdict: "no_findings",
      summary: "No actionable defects were found.",
      findings: [],
      residualRisks: [],
    });

    expect(findingsBody).toContain("[HIGH] `src/run.ts:42`");
    expect(findingsBody).toContain("Residual Risk");
    expect(findingsBody).toContain("error-reply.svg");
    expect(cleanBody).toContain("The pipeline found no actionable defects");
    expect(cleanBody).toContain("issue-reply.svg");
  });

  it("renders issue comments with PR links", () => {
    const body = renderIssueCommentBody({
      summary: "Implementation was completed on the queued branch.",
      verification: ["npm run typecheck"],
      followUps: [],
      prUrl: "https://github.com/example/repo/pull/12",
    });

    expect(body).toContain("[View pull request](https://github.com/example/repo/pull/12)");
    expect(body).toContain("Arasaka Repository Integrity Monitor");
    expect(body).toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });
});
