import pullRequestBodyMd from "../../content/artifacts/pull-request/templates/body.md";
import { renderBulletList, renderTemplate } from "./template.ts";

export type PullRequestRenderInput = {
  summary: string;
  changes: string[];
  verification: string[];
  assumptions: string[];
  closingIssueNumber: number;
};

export function renderPullRequestBody(
  input: PullRequestRenderInput,
): string {
  return renderTemplate(pullRequestBodyMd, {
    summary: input.summary.trim(),
    changes: renderBulletList(input.changes, "- No implementation changes listed."),
    verification: renderBulletList(
      input.verification,
      "- Verification was limited during this run.",
    ),
    assumptions: renderBulletList(
      input.assumptions,
      "- No additional assumptions were recorded.",
    ),
    closing: `Closes #${input.closingIssueNumber}`,
  }).trim();
}
