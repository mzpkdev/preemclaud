#!/usr/bin/env bun

/**
 * Arasaka prompt builder — data-only GitHub context.
 *
 * Replaces upstream's 40KB create-prompt/index.ts with a lean prompt
 * that provides ONLY structured context data. All behavioral instructions
 * are controlled via the system_prompt action input.
 */

import { writeFile, mkdir } from "fs/promises";
import type { FetchDataResult } from "../../upstream/src/github/data/fetcher.ts";
import type { ParsedGitHubContext } from "../../upstream/src/github/context.ts";
import {
  isIssueCommentEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
} from "../../upstream/src/github/context.ts";
import {
  formatContext,
  formatBody,
  formatComments,
  formatReviewComments,
  formatChangedFilesWithSHA,
} from "../../upstream/src/github/data/formatter.ts";
import { sanitizeContent } from "../../upstream/src/github/utils/sanitizer.ts";
import { extractUserRequest } from "../../upstream/src/utils/extract-user-request.ts";
import { GITHUB_SERVER_URL } from "../../upstream/src/github/api/config.ts";

const USER_REQUEST_FILENAME = "claude-user-request.txt";

export interface BuildPromptParams {
  commentId: number;
  baseBranch: string | undefined;
  claudeBranch: string | undefined;
  githubData: FetchDataResult;
  context: ParsedGitHubContext;
}

export async function buildPrompt(params: BuildPromptParams): Promise<void> {
  const { commentId, baseBranch, claudeBranch, githubData, context } = params;

  const promptDir = `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts`;
  await mkdir(promptDir, { recursive: true });

  const { contextData, comments, changedFilesWithSHA, reviewData, imageUrlMap } =
    githubData;

  // Format GitHub data using upstream formatters
  const formattedContext = formatContext(contextData, context.isPR);
  const formattedComments = formatComments(comments, imageUrlMap);
  const formattedReviewComments = context.isPR
    ? formatReviewComments(reviewData, imageUrlMap)
    : "";
  const formattedChangedFiles = context.isPR
    ? formatChangedFilesWithSHA(changedFilesWithSHA)
    : "";
  const formattedBody = contextData?.body
    ? formatBody(contextData.body, imageUrlMap)
    : "No description provided";

  const hasImages = imageUrlMap && imageUrlMap.size > 0;

  // Build structured context
  const repository = `${context.repository.owner}/${context.repository.repo}`;
  const entityType = context.isPR ? "pull request" : "issue";
  const closingKeyword = !context.isPR
    ? `Closes #${context.entityNumber}`
    : undefined;
  const triggerPhrase = context.inputs.triggerPhrase || "@claude";
  const jobUrl = `${GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;

  // Extract trigger comment body
  let triggerComment = "";
  if (isIssueCommentEvent(context)) {
    triggerComment = sanitizeContent(context.payload.comment.body);
  } else if (isPullRequestReviewEvent(context)) {
    triggerComment = sanitizeContent(context.payload.review.body ?? "");
  } else if (isPullRequestReviewCommentEvent(context)) {
    triggerComment = sanitizeContent(context.payload.comment.body);
  }

  // Assemble prompt — data only, no behavioral instructions
  let promptContent = `<github_context>
<entity_type>${entityType}</entity_type>
<repository>${repository}</repository>
${context.isPR ? `<pr_number>${context.entityNumber}</pr_number>` : `<issue_number>${context.entityNumber}</issue_number>`}
<triggered_by>${context.actor}</triggered_by>
<trigger_phrase>${triggerPhrase}</trigger_phrase>
<claude_comment_id>${commentId}</claude_comment_id>
${claudeBranch ? `<claude_branch>${claudeBranch}</claude_branch>` : ""}
${baseBranch ? `<base_branch>${baseBranch}</base_branch>` : ""}
<job_url>${jobUrl}</job_url>
</github_context>

<formatted_context>
${formattedContext}
</formatted_context>

<${context.isPR ? "pr" : "issue"}_body>
${formattedBody}
</${context.isPR ? "pr" : "issue"}_body>

<comments>
${formattedComments || "No comments"}
</comments>`;

  if (context.isPR) {
    promptContent += `

<review_comments>
${formattedReviewComments || "No review comments"}
</review_comments>

<changed_files>
${formattedChangedFiles || "No files changed"}
</changed_files>`;
  }

  if (hasImages) {
    promptContent += `

<images_info>
Images from comments have been saved to disk. Paths are in the formatted content above. Use Read tool to view them.
</images_info>`;
  }

  if (triggerComment) {
    promptContent += `

<trigger_comment>
${triggerComment}
</trigger_comment>`;
  }

  // Minimal tooling instructions — infrastructure facts, not behavior
  const useCommitSigning = context.inputs.useCommitSigning;
  const gitPushWrapper = `${process.env.GITHUB_ACTION_PATH}/scripts/git-push.sh`;

  promptContent += `

<tooling>
- Update your tracking comment using mcp__github_comment__update_claude_comment (only "body" param needed)
${
  useCommitSigning
    ? `- Commit files: mcp__github_file_ops__commit_files
- Delete files: mcp__github_file_ops__delete_files`
    : `- Stage: Bash(git add <files>)
- Commit: Bash(git commit -m "<message>")
- Push: Bash(${gitPushWrapper} origin ${claudeBranch || "HEAD"})
- Delete: Bash(git rm <files>)`
}
${
  claudeBranch
    ? `- You are on branch: ${claudeBranch}
- After pushing changes, always create a PR and enable auto-merge:
  Bash(gh pr create --title "<title>" --body "<body>" --base ${baseBranch})
  Bash(gh pr merge --auto --squash)${
      closingKeyword
        ? `
- Because this run was triggered from an issue, the PR body must include "${closingKeyword}" so GitHub auto-closes the issue when the PR is merged.`
        : ""
    }`
    : ""
}
</tooling>`;

  // Write prompt file
  await writeFile(`${promptDir}/claude-prompt.txt`, promptContent);

  // Extract and write user request for SDK multi-block messaging
  let userRequest: string | null = null;
  if (triggerComment) {
    userRequest = extractUserRequest(triggerComment, triggerPhrase);
  } else if (contextData?.body) {
    userRequest = extractUserRequest(contextData.body, triggerPhrase);
  }

  if (userRequest) {
    await writeFile(`${promptDir}/${USER_REQUEST_FILENAME}`, userRequest);
  }
}
