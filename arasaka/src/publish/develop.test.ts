import { describe, expect, it, mock } from "bun:test";
import { publishDevelopOutput } from "./develop.ts";

describe("develop publication", () => {
  it("publishes decomposition child issues and a parent comment", async () => {
    const createIssue = mock(async ({ title }: { title: string }) => ({
      data: {
        number: title.includes("tests") ? 101 : 102,
        title,
        html_url: `https://github.com/example/repo/issues/${title.includes("tests") ? 101 : 102}`,
      },
    }));
    const createComment = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/issues/57#issuecomment-1" },
    }));

    const result = await publishDevelopOutput({
      octokit: {
        rest: {
          issues: {
            create: createIssue,
            createComment,
            listLabelsForRepo: {},
          },
          paginate: {
            iterator: async function* () {
              yield { data: [{ name: "auto-generated" }] };
            },
          },
        },
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
      } as any,
      issueNumber: 57,
      branchName: "claude/issue-57",
      baseBranch: "main",
      rawStructuredOutput: JSON.stringify({
        status: "needs_decomposition",
        summary: "This should be split into smaller tasks.",
        reason: "Workflow changes and deployment hardening should not land together.",
        child_issues: [
          {
            title: "Run tests before deploy",
            summary: "Block deploy when tests fail.",
            problem: "The deploy workflow does not execute tests first.",
            acceptance_criteria: [
              "Tests run before build",
              "Deploy does not continue after test failures",
            ],
            evidence: [".github/workflows/deploy-pages.yml"],
            labels: ["auto-generated", "missing-label"],
          },
        ],
      }),
    });

    expect(createIssue).toHaveBeenCalledTimes(1);
    expect(createIssue).toHaveBeenCalledWith({
      owner: "example",
      repo: "repo",
      title: "Run tests before deploy",
      body: expect.stringContaining("parent_issue=57 depth=1"),
      labels: ["auto-generated"],
    });
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: "needs_decomposition",
      parent_issue_number: 57,
      parent_issue_comment_url: "https://github.com/example/repo/issues/57#issuecomment-1",
      child_issues: [
        {
          number: 101,
          title: "Run tests before deploy",
          url: "https://github.com/example/repo/issues/101",
        },
      ],
    });
  });

  it("rejects recursive decomposition for child issues", async () => {
    process.env.ARTIFACT_DECOMPOSITION_DEPTH = "1";

    await expect(
      publishDevelopOutput({
        octokit: {} as any,
        context: {
          repository: { owner: "example", repo: "repo" },
        } as any,
        issueNumber: 101,
        branchName: "claude/issue-101",
        baseBranch: "main",
        rawStructuredOutput: JSON.stringify({
          status: "needs_decomposition",
          summary: "Still too large.",
          reason: "This should fail.",
          child_issues: [
            {
              title: "Another child",
              summary: "Invalid recursion.",
              problem: "Should not recurse.",
              acceptance_criteria: ["No recursion"],
              evidence: ["#101"],
              labels: [],
            },
          ],
        }),
      }),
    ).rejects.toThrow("must not decompose again");

    delete process.env.ARTIFACT_DECOMPOSITION_DEPTH;
  });
});
