import issueCommentBodyMd from "../../content/artifacts/issue-comment/templates/body.md";
import { wrapArtifactBody } from "./chrome.ts";
import { ASSET_BASE } from "../config/assets.ts";
import { renderBulletList, renderTemplate } from "./template.ts";

export function renderIssueCommentBody(input: {
  summary: string;
  verification: string[];
  followUps: string[];
  prUrl: string;
}): string {
  const divider = `<img src="${ASSET_BASE}/divider.svg" />`;

  const body = renderTemplate(issueCommentBodyMd, {
    divider,
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

  return wrapArtifactBody({ body, banner: false, replyAsset: "issue-reply.svg" });
}
