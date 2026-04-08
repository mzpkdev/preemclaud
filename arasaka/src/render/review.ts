import reviewClearMd from "../../content/artifacts/review/templates/comment-clear.md";
import reviewFindingsMd from "../../content/artifacts/review/templates/comment-findings.md";
import { wrapArtifactBody } from "./chrome.ts";
import { ASSET_BASE } from "../config/assets.ts";
import { renderBulletList, renderTemplate } from "./template.ts";
import type { ReviewFinding } from "../publish/contracts.ts";

function renderSeverityBadge(severity: ReviewFinding["severity"]): string {
  switch (severity) {
    case "high":
      return "🔴 HIGH";
    case "medium":
      return "🟡 MEDIUM";
    case "low":
      return "🔵 LOW";
  }
}

function renderFindings(findings: ReviewFinding[]): string {
  if (findings.length === 0) {
    return "No actionable findings were recorded.";
  }

  return findings
    .map(
      (finding) =>
        `#### ${renderSeverityBadge(finding.severity)} — ${finding.title}\n\`${finding.file}:${finding.line}\`\n\n${finding.detail}`,
    )
    .join("\n\n---\n\n");
}

export function renderReviewComment(input: {
  verdict: "findings" | "no_findings";
  summary: string;
  findings: ReviewFinding[];
  residualRisks: string[];
}): string {
  const template =
    input.verdict === "no_findings" ? reviewClearMd : reviewFindingsMd;

  const divider = `<img src="${ASSET_BASE}/divider.svg" />`;

  const body = renderTemplate(template, {
    summary: input.summary.trim(),
    findings: renderFindings(input.findings),
    divider,
    residual_risks: renderBulletList(
      input.residualRisks,
      "- No residual risk was recorded beyond the reviewed diff.",
    ),
  }).trim();

  const replyAsset =
    input.verdict === "findings" ? "error-reply.svg" : "issue-reply.svg";
  return wrapArtifactBody({ body, banner: false, replyAsset });
}
