import issueBodyMd from "../../content/artifacts/issue/templates/body.md";
import { wrapArtifactBody } from "./chrome.ts";
import { renderBulletList, renderTemplate } from "./template.ts";

export type IssueRenderInput = {
  summary: string;
  problem: string;
  acceptanceCriteria: string[];
  evidence: string[];
};

export function renderIssueBody(input: IssueRenderInput): string {
  const body = renderTemplate(issueBodyMd, {
    summary: input.summary.trim(),
    problem: input.problem.trim(),
    acceptance_criteria: renderBulletList(
      input.acceptanceCriteria,
      "- No acceptance criteria were supplied.",
    ),
    evidence: renderBulletList(
      input.evidence,
      "- No repository evidence was supplied.",
    ),
  }).trim();

  return wrapArtifactBody({ body });
}
