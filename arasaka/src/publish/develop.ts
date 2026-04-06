import { execFileSync } from "node:child_process";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { AutomationContext } from "../../upstream/src/github/context.ts";
import { developOutputSchema, type DevelopOutput } from "./contracts.ts";
import { renderDecompositionCommentBody } from "../render/decomposition-comment.ts";
import { renderIssueBody } from "../render/issue.ts";
import { renderPullRequestBody } from "../render/pull-request.ts";
import { renderIssueCommentBody } from "../render/issue-comment.ts";

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

type DevelopDecompositionPublishResult = {
  status: "needs_decomposition";
  parent_issue_number: number;
  parent_issue_comment_url: string;
  child_issues: Array<{
    number: number;
    title: string;
    url: string;
  }>;
};

type DevelopPublishResult =
  | DevelopImplementedPublishResult
  | DevelopDecompositionPublishResult;

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

async function getExistingLabels(
  octokit: Octokits,
  owner: string,
  repo: string,
): Promise<Set<string>> {
  const labels = new Set<string>();
  const iterator = octokit.rest.paginate.iterator(
    octokit.rest.issues.listLabelsForRepo,
    { owner, repo, per_page: 100 },
  );

  for await (const page of iterator) {
    for (const label of page.data) {
      labels.add(label.name);
    }
  }

  return labels;
}

function buildDecompositionMarker(parentIssueNumber: number): string {
  return `<!-- arasaka:decomposition-child parent_issue=${parentIssueNumber} depth=1 -->`;
}

function getDecompositionDepth(): number {
  const value = Number(process.env.ARTIFACT_DECOMPOSITION_DEPTH || "0");
  return Number.isInteger(value) && value >= 0 ? value : 0;
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
  const decompositionDepth = getDecompositionDepth();

  if (parsed.status === "needs_decomposition" && decompositionDepth > 0) {
    throw new Error(
      "Decomposition child issues must not decompose again; the develop run must fail instead.",
    );
  }

  if (parsed.status === "needs_decomposition") {
    const existingLabels = await getExistingLabels(octokit, owner, repo);
    const marker = buildDecompositionMarker(issueNumber);
    const childIssues: DevelopDecompositionPublishResult["child_issues"] = [];

    for (const child of parsed.child_issues) {
      const body = renderIssueBody({
        summary: child.summary,
        problem: child.problem,
        acceptanceCriteria: child.acceptance_criteria,
        evidence: [...child.evidence, `Parent issue: #${issueNumber}`],
        metadataComment: marker,
      });
      const labels = child.labels.filter((label) => existingLabels.has(label));

      const { data } = await octokit.rest.issues.create({
        owner,
        repo,
        title: child.title,
        body,
        ...(labels.length > 0 ? { labels } : {}),
      });

      childIssues.push({
        number: data.number,
        title: data.title,
        url: data.html_url,
      });
    }

    const parentCommentBody = renderDecompositionCommentBody({
      summary: parsed.summary,
      reason: parsed.reason,
      childIssues: childIssues.map(
        (child) => `[#${child.number}](${child.url}) ${child.title}`,
      ),
    });

    const { data: parentComment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: parentCommentBody,
    });

    return {
      status: "needs_decomposition",
      parent_issue_number: issueNumber,
      parent_issue_comment_url: parentComment.html_url,
      child_issues: childIssues,
    };
  }

  if (!branchName) {
    throw new Error("Missing branch name for develop publication");
  }

  ensureRemoteBranch(branchName);

  const body = renderPullRequestBody({
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

  const { data: comment } = await octokit.rest.issues.createComment({
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
