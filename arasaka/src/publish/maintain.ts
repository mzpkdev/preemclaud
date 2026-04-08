import type { Octokits } from "../../upstream/src/github/api/client.ts";
import type { AutomationContext } from "../../upstream/src/github/context.ts";
import {
  maintainOutputSchema,
  type MaintainOutput,
  type MaintainAction,
} from "./contracts.ts";
import { renderMaintainComment } from "../render/maintain.ts";

const CI_FAILURE_LABEL = "ci-failure";

type MaintainActionResult = {
  type: MaintainAction["type"];
  entity: MaintainAction["entity"];
  number?: number;
  title: string;
  executed: boolean;
  result_url?: string;
};

type MaintainPublishResult = {
  summary: string;
  dry_run: boolean;
  actions: MaintainActionResult[];
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

async function ensureLabelExists(
  octokit: Octokits,
  owner: string,
  repo: string,
  label: string,
  existingLabels: Set<string>,
): Promise<void> {
  if (existingLabels.has(label)) return;

  try {
    await octokit.rest.issues.createLabel({
      owner,
      repo,
      name: label,
      color: "ededed",
      description: "Marked as stale by Arasaka maintenance",
    });
    existingLabels.add(label);
  } catch {
    // Label may have been created concurrently — safe to ignore
  }
}

async function executeAction(
  octokit: Octokits,
  owner: string,
  repo: string,
  action: MaintainAction,
  staleLabel: string,
  existingLabels: Set<string>,
): Promise<MaintainActionResult> {
  const base: MaintainActionResult = {
    type: action.type,
    entity: action.entity,
    number: action.number,
    title: action.title,
    executed: true,
  };

  try {
    if (action.type === "report_failure") {
      // Dedup: search for an existing open issue matching this run ID
      const issueTitle = `[CI] ${action.workflow_name} failed (run ${action.run_id})`;
      const { data: existing } = await octokit.rest.search.issuesAndPullRequests(
        {
          q: `repo:${owner}/${repo} is:issue is:open "${issueTitle}" in:title`,
          per_page: 1,
        },
      );
      if (existing.total_count > 0) {
        return {
          ...base,
          number: existing.items[0]!.number,
          executed: false,
        };
      }

      const body = renderMaintainComment({
        variant: "failure",
        comment: action.comment!,
        reason: action.reason,
        entityType: "issue",
        workflowName: action.workflow_name!,
        runUrl: action.run_url!,
      });
      await ensureLabelExists(
        octokit,
        owner,
        repo,
        CI_FAILURE_LABEL,
        existingLabels,
      );
      const { data: issue } = await octokit.rest.issues.create({
        owner,
        repo,
        title: issueTitle,
        body,
        labels: [CI_FAILURE_LABEL],
      });
      return {
        ...base,
        number: issue.number,
        result_url: issue.html_url,
      };
    }

    if (action.type === "warn_stale") {
      const body = renderMaintainComment({
        variant: "warn",
        comment: action.comment!,
        reason: action.reason,
        entityType: action.entity,
      });
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: action.number!,
        body,
      });
      await ensureLabelExists(octokit, owner, repo, staleLabel, existingLabels);
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: action.number!,
        labels: [staleLabel],
      });
      return { ...base, result_url: comment.html_url };
    }

    if (action.type === "close_stale") {
      const body = renderMaintainComment({
        variant: "close",
        comment: action.comment!,
        reason: action.reason,
        entityType: action.entity,
      });
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: action.number!,
        body,
      });
      if (action.entity === "pull_request") {
        await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: action.number!,
          state: "closed",
        });
      } else {
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: action.number!,
          state: "closed",
        });
      }
      return { ...base, result_url: comment.html_url };
    }

    if (action.type === "reply_question") {
      const body = renderMaintainComment({
        variant: "reply",
        comment: action.comment!,
        reason: action.reason,
        entityType: action.entity,
      });
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: action.number!,
        body,
      });
      return { ...base, result_url: comment.html_url };
    }

    // add_labels
    const validLabels = (action.labels_to_add || []).filter((l) =>
      existingLabels.has(l),
    );
    if (validLabels.length > 0) {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: action.number!,
        labels: validLabels,
      });
      const body = renderMaintainComment({
        variant: "label",
        comment: "",
        reason: action.reason,
        entityType: action.entity,
        labels: validLabels,
      });
      const { data: comment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: action.number!,
        body,
      });
      return { ...base, result_url: comment.html_url };
    }

    return { ...base, executed: false };
  } catch (error) {
    console.error(
      `Failed to execute ${action.type} on #${action.number}:`,
      error,
    );
    return { ...base, executed: false };
  }
}

export async function publishMaintainOutput(params: {
  octokit: Octokits;
  context: AutomationContext;
  rawStructuredOutput: string;
  staleLabel: string;
  dryRun: boolean;
}): Promise<MaintainPublishResult> {
  const { octokit, context, rawStructuredOutput, staleLabel, dryRun } = params;
  const parsed: MaintainOutput = maintainOutputSchema.parse(
    JSON.parse(rawStructuredOutput),
  );
  const { owner, repo } = context.repository;

  const maxActions = Number(process.env.ARTIFACT_MAX_ACTIONS) || 10;
  const actions = parsed.actions.slice(0, maxActions);

  if (dryRun) {
    return {
      summary: parsed.summary,
      dry_run: true,
      actions: actions.map((a) => ({
        type: a.type,
        entity: a.entity,
        ...(a.number !== undefined ? { number: a.number } : {}),
        title: a.title,
        executed: false,
      })),
    };
  }

  const existingLabels = await getExistingLabels(octokit, owner, repo);
  const results: MaintainActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(
      octokit,
      owner,
      repo,
      action,
      staleLabel,
      existingLabels,
    );
    results.push(result);
  }

  return {
    summary: parsed.summary,
    dry_run: false,
    actions: results,
  };
}
