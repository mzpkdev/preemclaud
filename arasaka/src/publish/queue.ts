import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { AutomationContext } from "../../upstream/src/github/context.ts";
import { queueOutputSchema, type QueueOutput, type Priority } from "./contracts.ts";
import { renderIssueBody } from "../render/issue.ts";
import { wrapArtifactBody } from "../render/chrome.ts";

const PRIORITY_LABELS: Record<Priority, { name: string; color: string }> = {
  P0: { name: "P0", color: "b60205" },
  P1: { name: "P1", color: "d93f0b" },
  P2: { name: "P2", color: "fbca04" },
  P3: { name: "P3", color: "0e8a16" },
};

const WELL_KNOWN_LABELS: Array<{ name: string; color: string }> = [
  { name: "tech debt", color: "795548" },
];

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

async function ensureBuiltInLabels(
  octokit: Octokits,
  owner: string,
  repo: string,
  existingLabels: Set<string>,
): Promise<void> {
  const allLabels = [
    ...Object.values(PRIORITY_LABELS),
    ...WELL_KNOWN_LABELS,
  ];
  for (const { name, color } of allLabels) {
    if (!existingLabels.has(name)) {
      await octokit.rest.issues.createLabel({ owner, repo, name, color });
      existingLabels.add(name);
    }
  }
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
  await ensureBuiltInLabels(octokit, owner, repo, existingLabels);
  const issues: QueuePublishResult["issues"] = [];

  for (const item of parsed.issues) {
    const body = item.body
      ? wrapArtifactBody({ body: item.body })
      : renderIssueBody({
          description: item.description,
          affectedFiles: item.affected_files,
          requirements: item.requirements,
          notInScope: item.not_in_scope,
          evidence: item.evidence,
        });
    const priorityLabel = PRIORITY_LABELS[item.priority].name;
    const labels = [
      ...item.labels.filter((label) => existingLabels.has(label)),
      priorityLabel,
    ];

    if (item.action === "update" && item.existing_issue_number !== undefined) {
      const { data } = await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: item.existing_issue_number,
        title: item.title,
        body,
        labels,
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
      labels,
    });
    issues.push({
      number: data.number,
      title: data.title,
      action: "create",
    });
  }

  return { issues };
}
