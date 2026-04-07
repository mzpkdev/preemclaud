import { isEntityContext, type GitHubContext } from "../../upstream/src/github/context.ts";
import type { Octokits } from "../../upstream/src/github/api/client.ts";
import { publishQueueOutput } from "./queue.ts";
import { publishDevelopOutput } from "./develop.ts";
import { publishReviewOutput } from "./review.ts";
import { publishMaintainOutput } from "./maintain.ts";

export type ArtifactMode = "queue" | "develop" | "review" | "maintain";

function getRequiredNumber(
  rawValue: string | undefined,
  name: string,
): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export async function publishStructuredOutput(params: {
  mode: ArtifactMode;
  octokit: Octokits;
  context: GitHubContext;
  rawStructuredOutput: string;
  baseBranch?: string;
  claudeBranch?: string;
}): Promise<string> {
  const { mode, octokit, context, rawStructuredOutput, baseBranch, claudeBranch } =
    params;

  if (mode === "queue") {
    if (isEntityContext(context)) {
      throw new Error("queue publishing requires automation context");
    }
    return JSON.stringify(
      await publishQueueOutput({
        octokit,
        context,
        rawStructuredOutput,
      }),
    );
  }

  if (mode === "develop") {
    if (isEntityContext(context)) {
      throw new Error("develop preset publishing requires automation context");
    }

    return JSON.stringify(
      await publishDevelopOutput({
        octokit,
        context,
        rawStructuredOutput,
        issueNumber: getRequiredNumber(
          process.env.ARTIFACT_ISSUE_NUMBER,
          "ARTIFACT_ISSUE_NUMBER",
        ),
        branchName: claudeBranch || process.env.CLAUDE_BRANCH || "",
        baseBranch: baseBranch || process.env.BASE_BRANCH || "main",
      }),
    );
  }

  if (mode === "maintain") {
    if (isEntityContext(context)) {
      throw new Error("maintain publishing requires automation context");
    }
    return JSON.stringify(
      await publishMaintainOutput({
        octokit,
        context,
        rawStructuredOutput,
        staleLabel: process.env.ARTIFACT_STALE_LABEL || "stale",
        dryRun: process.env.ARTIFACT_DRY_RUN === "true",
      }),
    );
  }

  if (!isEntityContext(context)) {
    throw new Error("review publishing requires entity context");
  }

  return JSON.stringify(
    await publishReviewOutput({
      octokit,
      context,
      rawStructuredOutput,
      prNumber: getRequiredNumber(
        process.env.ARTIFACT_PR_NUMBER || String(context.entityNumber),
        "ARTIFACT_PR_NUMBER",
      ),
    }),
  );
}
