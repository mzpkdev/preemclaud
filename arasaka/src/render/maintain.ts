import warnMd from "../../content/artifacts/maintain/templates/warn.md";
import closeMd from "../../content/artifacts/maintain/templates/close.md";
import replyMd from "../../content/artifacts/maintain/templates/reply.md";
import labelMd from "../../content/artifacts/maintain/templates/label.md";
import failureMd from "../../content/artifacts/maintain/templates/failure.md";
import { wrapArtifactBody } from "./chrome.ts";
import { renderTemplate } from "./template.ts";

type MaintainCommentVariant = "warn" | "close" | "reply" | "label" | "failure";

export type MaintainCommentInput = {
  variant: MaintainCommentVariant;
  comment: string;
  reason: string;
  entityType: "issue" | "pull_request";
  labels?: string[];
  workflowName?: string;
  runUrl?: string;
};

const templateMap: Record<MaintainCommentVariant, string> = {
  warn: warnMd,
  close: closeMd,
  reply: replyMd,
  label: labelMd,
  failure: failureMd,
};

export function renderMaintainComment(input: MaintainCommentInput): string {
  const template = templateMap[input.variant];

  const body = renderTemplate(template, {
    comment: input.comment.trim(),
    reason: input.reason.trim(),
    entity_type: input.entityType === "pull_request" ? "pull request" : "issue",
    labels: (input.labels || []).map((l) => `\`${l}\``).join(", "),
    workflow_name: input.workflowName || "",
    run_url: input.runUrl || "",
  }).trim();

  return wrapArtifactBody({ body });
}
