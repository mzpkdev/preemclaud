import issueBodyMd from "../../content/artifacts/issue/templates/body.md";
import { wrapArtifactBody } from "./chrome.ts";
import { ASSET_BASE } from "../config/assets.ts";
import {
  type AffectedFile,
  type Evidence,
  renderAffectedFileList,
  renderBulletList,
  renderCheckboxList,
  renderDependsOn,
  renderEvidenceList,
  renderTemplate,
} from "./template.ts";

export type IssueRenderInput = {
  description: string;
  context: string;
  affectedFiles: AffectedFile[];
  requirements: string[];
  verificationCommands: string[];
  notInScope: string[];
  evidence: Evidence[];
  dependsOn?: number[];
};

export function renderIssueBody(input: IssueRenderInput): string {
  const divider = `<img src="${ASSET_BASE}/divider.svg" />`;

  const body = renderTemplate(issueBodyMd, {
    divider,
    description: input.description.trim(),
    context: input.context.trim(),
    affected_files: renderAffectedFileList(
      input.affectedFiles,
      "- No affected files were identified.",
    ),
    requirements: renderCheckboxList(
      input.requirements,
      "- No requirements were supplied.",
    ),
    verification_commands: renderBulletList(
      input.verificationCommands,
      "- No verification commands were supplied.",
    ),
    not_in_scope: renderBulletList(
      input.notInScope,
      "- No scope exclusions were specified.",
    ),
    evidence: renderEvidenceList(
      input.evidence,
      "- No repository evidence was supplied.",
    ),
    depends_on: renderDependsOn(input.dependsOn),
  }).trim();

  return wrapArtifactBody({ body });
}
