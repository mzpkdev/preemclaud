import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { AutomationContext } from "../../upstream/src/github/context.ts";
import { queueOutputSchema, type QueueOutput } from "./contracts.ts";
import { renderIssueBody } from "../render/issue.ts";

type QueuePublishResult = {
  issues: Array<{
    number: number;
    title: string;
    action: "create" | "update";
  }>;
};

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

export async function publishQueueOutput(params: {
  octokit: Octokits;
  context: AutomationContext;
  rawStructuredOutput: string;
}): Promise<QueuePublishResult> {
  const { octokit, context, rawStructuredOutput } = params;
  const parsed: QueueOutput = queueOutputSchema.parse(
    JSON.parse(rawStructuredOutput),
  );
  const { owner, repo } = context.repository;
  const existingLabels = await getExistingLabels(octokit, owner, repo);
  const issues: QueuePublishResult["issues"] = [];

  for (const item of parsed.issues) {
    const body = renderIssueBody({
      summary: item.summary,
      problem: item.problem,
      acceptanceCriteria: item.acceptance_criteria,
      evidence: item.evidence,
    });
    const labels = item.labels.filter((label) => existingLabels.has(label));

    if (item.action === "update" && item.existing_issue_number !== undefined) {
      const { data } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: item.existing_issue_number,
        title: item.title,
        body,
        ...(labels.length > 0 ? { labels } : {}),
      });
      issues.push({
        number: data.number,
        title: data.title,
        action: "update",
      });
      continue;
    }

    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title: item.title,
      body,
      ...(labels.length > 0 ? { labels } : {}),
    });
    issues.push({
      number: data.number,
      title: data.title,
      action: "create",
    });
  }

  return { issues };
}
