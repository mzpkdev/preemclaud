import issueCommentBodyMd from "../../content/artifacts/issue-comment/templates/body.md";
import { renderBulletList, renderTemplate } from "./template.ts";

export function renderIssueCommentBody(input: {
  summary: string;
  verification: string[];
  followUps: string[];
  prUrl: string;
}): string {
  return renderTemplate(issueCommentBodyMd, {
    summary: input.summary.trim(),
    verification: renderBulletList(
      input.verification,
      "- Verification details were not supplied.",
    ),
    follow_ups: renderBulletList(
      input.followUps,
      "- No remaining follow-up was recorded.",
    ),
    pr_link: `[View pull request](${input.prUrl})`,
  }).trim();
}
