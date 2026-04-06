import decompositionCommentBodyMd from "../../content/artifacts/decomposition-comment/templates/body.md";
import { wrapArtifactBody } from "./chrome.ts";
import { renderBulletList, renderTemplate } from "./template.ts";

export function renderDecompositionCommentBody(input: {
  summary: string;
  reason: string;
  childIssues: string[];
}): string {
  const body = renderTemplate(decompositionCommentBodyMd, {
    summary: input.summary.trim(),
    reason: input.reason.trim(),
    child_issues: renderBulletList(
      input.childIssues,
      "- No child issues were recorded.",
    ),
  }).trim();

  return wrapArtifactBody({ body });
}
