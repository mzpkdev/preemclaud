import { describe, expect, it } from "bun:test";
import { renderIssueBody } from "./issue.ts";
import { renderPullRequestBody } from "./pull-request.ts";
import { renderReviewComment } from "./review.ts";
import { renderIssueCommentBody } from "./issue-comment.ts";
import { renderMaintainComment } from "./maintain.ts";

describe("artifact renderers", () => {
  it("renders issue bodies with structured sections", () => {
    const body = renderIssueBody({
      description: "Queue output is currently freeform and drifts between runs.",
      context: "The queue workflow produces issues with inconsistent formatting because there is no enforced contract on the structured output. This makes it harder for automated agents to parse and act on the issues.",
      affectedFiles: [
        { path: "arasaka/actions/queue/action.yml", note: "preset assembly logic" },
        { path: "arasaka/src/publish/queue.ts", line: 64, note: "publication entry point" },
      ],
      requirements: ["Structured contract is enforced", "Published issue body is templated"],
      verificationCommands: ["bun test", "bun run typecheck"],
      notInScope: ["Do not refactor the review workflow"],
      evidence: [
        { location: "arasaka/workflows/arasaka.yml:12", observation: "queue job references unvalidated output" },
      ],
    });

    expect(body).toContain("Queue output is currently freeform");
    expect(body).toContain("inconsistent formatting");
    expect(body).toContain("- `arasaka/actions/queue/action.yml` — preset assembly logic");
    expect(body).toContain("- `arasaka/src/publish/queue.ts:64` — publication entry point");
    expect(body).toContain("- [ ] Structured contract is enforced");
    expect(body).toContain("- bun test");
    expect(body).toContain("- bun run typecheck");
    expect(body).toContain("- Do not refactor the review workflow");
    expect(body).toContain("- `arasaka/workflows/arasaka.yml:12` — queue job references unvalidated output");
    expect(body).toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders depends_on as issue links", () => {
    const body = renderIssueBody({
      description: "Add integration tests for the queue publisher.",
      context: "Unit tests exist but no integration tests verify end-to-end issue creation.",
      affectedFiles: [
        { path: "arasaka/src/publish/queue.test.ts", note: "new test file" },
      ],
      requirements: ["Integration tests pass"],
      verificationCommands: ["bun test"],
      notInScope: ["Do not modify production code"],
      evidence: [
        { location: "arasaka/src/publish/queue.ts", observation: "no integration test coverage" },
      ],
      dependsOn: [42, 57],
    });

    expect(body).toContain("**Dependencies**");
    expect(body).toContain("#42");
    expect(body).toContain("#57");
  });

  it("omits dependencies section when depends_on is empty", () => {
    const body = renderIssueBody({
      description: "Fix a minor typo.",
      context: "Documentation has a spelling error that could confuse readers.",
      affectedFiles: [{ path: "README.md", note: "fix typo in setup section" }],
      requirements: ["Typo is corrected"],
      verificationCommands: ["grep -c 'teh' README.md | grep '^0$'"],
      notInScope: ["Do not rewrite the README"],
      evidence: [{ location: "README.md:5", observation: "'teh' should be 'the'" }],
    });

    expect(body).not.toContain("**Dependencies**");
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

    expect(findingsBody).toContain("HIGH");
    expect(findingsBody).toContain("`src/run.ts:42`");
    expect(findingsBody).toContain("Missing null guard");
    expect(findingsBody).toContain("Residual Risk");
    expect(findingsBody).toContain("error-reply.svg");
    expect(findingsBody).not.toContain("banner.svg");
    expect(cleanBody).toContain("No actionable defects identified");
    expect(cleanBody).toContain("issue-reply.svg");
    expect(cleanBody).not.toContain("banner.svg");
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
    expect(body).toContain("issue-reply.svg");
    expect(body).not.toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders maintain warn comment with stale notice", () => {
    const body = renderMaintainComment({
      variant: "warn",
      comment: "This issue has seen no updates since March.",
      reason: "No activity for 35 days.",
      entityType: "issue",
    });

    expect(body).toContain("flagged for review");
    expect(body).toContain("No activity for 35 days.");
    expect(body).toContain("no updates since March");
    expect(body).toContain("Arasaka Repository Maintenance Division");
    expect(body).toContain("issue-reply.svg");
    expect(body).not.toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders maintain close comment with inactivity notice", () => {
    const body = renderMaintainComment({
      variant: "close",
      comment: "Closing after sustained inactivity.",
      reason: "No response to stale warning for 30 days.",
      entityType: "pull_request",
    });

    expect(body).toContain("closed due to sustained inactivity");
    expect(body).toContain("pull request");
    expect(body).toContain("may be reopened");
    expect(body).toContain("issue-reply.svg");
    expect(body).not.toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders maintain reply comment", () => {
    const body = renderMaintainComment({
      variant: "reply",
      comment: "The configuration file is located at `config/settings.yml`.",
      reason: "Unanswered question about configuration.",
      entityType: "issue",
    });

    expect(body).toContain("config/settings.yml");
    expect(body).toContain("Arasaka Repository Maintenance Division");
    expect(body).toContain("issue-reply.svg");
  });

  it("renders maintain label comment with label names", () => {
    const body = renderMaintainComment({
      variant: "label",
      comment: "",
      reason: "Issue discusses authentication flow.",
      entityType: "issue",
      labels: ["auth", "enhancement"],
    });

    expect(body).toContain("`auth`");
    expect(body).toContain("`enhancement`");
    expect(body).toContain("content analysis");
    expect(body).toContain("issue-reply.svg");
    expect(body).not.toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

  it("renders maintain failure issue body with workflow details", () => {
    const body = renderMaintainComment({
      variant: "failure",
      comment: "TypeScript compilation failed with 3 errors in src/main.ts.",
      reason: "Build step exited with code 1",
      entityType: "issue",
      workflowName: "deploy-pages",
      runUrl: "https://github.com/owner/repo/actions/runs/12345678",
    });

    expect(body).toContain("deploy-pages");
    expect(body).toContain("https://github.com/owner/repo/actions/runs/12345678");
    expect(body).toContain("TypeScript compilation failed");
    expect(body).toContain("Arasaka Repository Maintenance Division");
    expect(body).toContain("issue-reply.svg");
    expect(body).not.toContain("banner.svg");
    expect(body).toContain("footer.svg");
  });

});
