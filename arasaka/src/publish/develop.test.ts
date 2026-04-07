import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

// Mock execFileSync before importing the module under test
import { mock as mockModule } from "bun:test";

const execFileSyncMock = mock(() => Buffer.from(""));
mock.module("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

const { publishDevelopOutput } = await import("./develop.ts");

describe("develop publication", () => {
  beforeEach(() => {
    execFileSyncMock.mockClear();
  });

  it("creates a pull request and posts an issue comment", async () => {
    const createPR = mock(async () => ({
      data: {
        number: 12,
        html_url: "https://github.com/example/repo/pull/12",
        title: "Fix widget rendering",
        node_id: "PR_123",
      },
    }));
    const listPRs = mock(async () => ({ data: [] }));
    const createComment = mock(async () => ({
      data: { html_url: "https://github.com/example/repo/issues/5#issuecomment-1" },
    }));

    const result = await publishDevelopOutput({
      octokit: {
        rest: {
          pulls: { create: createPR, list: listPRs },
          issues: { createComment },
        },
        graphql: mock(async () => ({
          enablePullRequestAutoMerge: { pullRequest: { number: 12 } },
        })),
      } as any,
      context: {
        repository: { owner: "example", repo: "repo" },
      } as any,
      issueNumber: 5,
      branchName: "claude/issue-5",
      baseBranch: "main",
      rawStructuredOutput: JSON.stringify({
        status: "implemented",
        pull_request: {
          title: "Fix widget rendering",
          summary: "Corrects the flex layout for widget containers.",
          changes: ["Updated widget.css flex properties"],
          verification: ["npm test"],
          assumptions: ["No IE11 support needed"],
        },
        issue_comment: {
          summary: "Implemented the fix on claude/issue-5.",
          verification: ["npm test"],
          follow_ups: [],
        },
      }),
    });

    expect(result.status).toBe("implemented");
    if (result.status !== "implemented") throw new Error("unreachable");
    expect(result.pull_request.number).toBe(12);
    expect(result.pull_request.action).toBe("created");
    expect(createPR).toHaveBeenCalledTimes(1);
    expect(createComment).toHaveBeenCalledTimes(1);
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });
});
