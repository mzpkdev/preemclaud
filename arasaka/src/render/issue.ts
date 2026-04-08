import issueBodyMd from "../../content/artifacts/issue/templates/body.md";
import { wrapArtifactBody } from "./chrome.ts";
import {
  renderBulletList,
  renderCheckboxList,
  renderTemplate,
} from "./template.ts";

export type IssueRenderInput = {
  description: string;
  affectedFiles: string[];
  requirements: string[];
  notInScope: string[];
  evidence: string[];
};

export function renderIssueBody(input: IssueRenderInput): string {
  const body = renderTemplate(issueBodyMd, {
    description: input.description.trim(),
    affected_files: renderBulletList(
      input.affectedFiles,
      "- No affected files were identified.",
    ),
    requirements: renderCheckboxList(
      input.requirements,
      "- No requirements were supplied.",
    ),
    not_in_scope: renderBulletList(
      input.notInScope,
      "- No scope exclusions were specified.",
    ),
    evidence: renderBulletList(
      input.evidence,
      "- No repository evidence was supplied.",
    ),
  }).trim();

  return wrapArtifactBody({ body });
}
