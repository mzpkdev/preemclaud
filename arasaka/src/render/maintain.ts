import warnMd from "../../content/artifacts/maintain/templates/warn.md";
import closeMd from "../../content/artifacts/maintain/templates/close.md";
import replyMd from "../../content/artifacts/maintain/templates/reply.md";
import labelMd from "../../content/artifacts/maintain/templates/label.md";
import { wrapArtifactBody } from "./chrome.ts";
import { renderTemplate } from "./template.ts";

type MaintainCommentVariant = "warn" | "close" | "reply" | "label";

export type MaintainCommentInput = {
  variant: MaintainCommentVariant;
  comment: string;
  reason: string;
  entityType: "issue" | "pull_request";
  labels?: string[];
};

const templateMap: Record<MaintainCommentVariant, string> = {
  warn: warnMd,
  close: closeMd,
  reply: replyMd,
  label: labelMd,
};

export function renderMaintainComment(input: MaintainCommentInput): string {
  const template = templateMap[input.variant];

  const body = renderTemplate(template, {
    comment: input.comment.trim(),
    reason: input.reason.trim(),
    entity_type: input.entityType === "pull_request" ? "pull request" : "issue",
    labels: (input.labels || []).map((l) => `\`${l}\``).join(", "),
  }).trim();

  return wrapArtifactBody({ body });
}
