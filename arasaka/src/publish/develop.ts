import { execFileSync } from "node:child_process";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { AutomationContext } from "../../upstream/src/github/context.ts";
import { developOutputSchema, type DevelopOutput } from "./contracts.ts";
import { renderPullRequestBody } from "../render/pull-request.ts";
import { renderIssueCommentBody } from "../render/issue-comment.ts";
import { wrapArtifactBody } from "../render/chrome.ts";

type DevelopImplementedPublishResult = {
  status: "implemented";
  pull_request: {
    number: number;
    url: string;
    title: string;
    action: "created" | "updated";
  };
  issue_comment_url: string;
};

type DevelopPublishResult = DevelopImplementedPublishResult;

async function enableAutoMerge(
  octokit: Octokits,
  pullRequestNodeId: string | null,
): Promise<void> {
  if (!pullRequestNodeId) {
    return;
  }

  try {
    await octokit.graphql(
      `
        mutation EnableAutoMerge($pullRequestId: ID!) {
          enablePullRequestAutoMerge(
            input: { pullRequestId: $pullRequestId, mergeMethod: SQUASH }
          ) {
            pullRequest {
              number
            }
          }
        }
      `,
      { pullRequestId: pullRequestNodeId },
    );
  } catch (error) {
    console.warn("[arasaka] Failed to enable auto-merge:", error);
  }
}

function ensureRemoteBranch(branchName: string): void {
  try {
    // Push the prepared implementation branch before PR publication so the
    // GitHub PR API always sees a valid remote head ref.
    execFileSync(
      "git",
      ["push", "--set-upstream", "origin", branchName],
      { stdio: "pipe" },
    );
  } catch (error) {
    throw new Error(
      `Failed to push implementation branch '${branchName}' before PR publication: ${String(error)}`,
    );
  }
}

export async function publishDevelopOutput(params: {
  octokit: Octokits;
  context: AutomationContext;
  rawStructuredOutput: string;
  issueNumber: number;
  branchName: string;
  baseBranch: string;
}): Promise<DevelopPublishResult> {
  const { octokit, context, rawStructuredOutput, issueNumber, branchName, baseBranch } =
    params;
  const parsed: DevelopOutput = developOutputSchema.parse(
    JSON.parse(rawStructuredOutput),
  );
  const { owner, repo } = context.repository;

  if (!branchName) {
    throw new Error("Missing branch name for develop publication");
  }

  ensureRemoteBranch(branchName);

  const body = parsed.pull_request.body
    ? wrapArtifactBody({
        body: `${parsed.pull_request.body.trim()}\n\nCloses #${issueNumber}`,
      })
    : renderPullRequestBody({
        summary: parsed.pull_request.summary,
        changes: parsed.pull_request.changes,
        verification: parsed.pull_request.verification,
        assumptions: parsed.pull_request.assumptions,
        closingIssueNumber: issueNumber,
      });

  const { data: existingPullRequests } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${branchName}`,
    per_page: 10,
  });

  let pullRequestNumber: number;
  let pullRequestUrl: string;
  let pullRequestTitle: string;
  let pullRequestNodeId: string | null;
  let action: "created" | "updated" = "updated";

  if (existingPullRequests[0]) {
    const { data } = await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPullRequests[0].number,
      title: parsed.pull_request.title,
      body,
      base: baseBranch,
    });
    pullRequestNumber = data.number;
    pullRequestUrl = data.html_url;
    pullRequestTitle = data.title;
    pullRequestNodeId = data.node_id ?? null;
  } else {
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: parsed.pull_request.title,
      body,
      head: branchName,
      base: baseBranch,
    });
    pullRequestNumber = data.number;
    pullRequestUrl = data.html_url;
    pullRequestTitle = data.title;
    pullRequestNodeId = data.node_id ?? null;
    action = "created";
  }

  await enableAutoMerge(octokit, pullRequestNodeId);

  const issueCommentBody = renderIssueCommentBody({
    summary: parsed.issue_comment.summary,
    verification: parsed.issue_comment.verification,
    followUps: parsed.issue_comment.follow_ups,
    prUrl: pullRequestUrl,
  });

  const progressCommentId = Number(process.env.ARTIFACT_PROGRESS_COMMENT_ID) || 0;

  const { data: comment } = progressCommentId
    ? await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: progressCommentId,
        body: issueCommentBody,
      })
    : await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: issueCommentBody,
      });

  return {
    status: "implemented",
    pull_request: {
      number: pullRequestNumber,
      url: pullRequestUrl,
      title: pullRequestTitle,
      action,
    },
    issue_comment_url: comment.html_url,
  };
}
