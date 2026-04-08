import reviewClearMd from "../../content/artifacts/review/templates/comment-clear.md";
import reviewFindingsMd from "../../content/artifacts/review/templates/comment-findings.md";
import { wrapArtifactBody } from "./chrome.ts";
import { renderBulletList, renderTemplate } from "./template.ts";
import type { ReviewFinding } from "../publish/contracts.ts";

function renderFindings(findings: ReviewFinding[]): string {
  if (findings.length === 0) {
    return "- No actionable findings were recorded.";
  }

  return findings
    .map(
      (finding) =>
        `- [${finding.severity.toUpperCase()}] \`${finding.file}:${finding.line}\` ${finding.title}\n  ${finding.detail}`,
    )
    .join("\n");
}

export function renderReviewComment(input: {
  verdict: "findings" | "no_findings";
  summary: string;
  findings: ReviewFinding[];
  residualRisks: string[];
}): string {
  const template =
    input.verdict === "no_findings" ? reviewClearMd : reviewFindingsMd;

  const body = renderTemplate(template, {
    summary: input.summary.trim(),
    findings: renderFindings(input.findings),
    residual_risks: renderBulletList(
      input.residualRisks,
      "- No residual risk was recorded beyond the reviewed diff.",
    ),
  }).trim();

  return wrapArtifactBody({ body });
}
