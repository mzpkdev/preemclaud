import toolingCommonMd from "../../content/prompt/tooling/common.md";
import toolingCommitSigningMd from "../../content/prompt/tooling/commit-signing.md";
import toolingGitMd from "../../content/prompt/tooling/git.md";
import toolingPrMd from "../../content/prompt/tooling/pr.md";

function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (output, [key, value]) =>
      output.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value),
    template,
  );
}

export function buildToolingBlock(input: {
  useCommitSigning: boolean;
  gitPushWrapper: string;
  claudeBranch?: string;
  baseBranch?: string;
  closingKeyword?: string;
}): string {
  const sections: string[] = [toolingCommonMd.trim()];

  sections.push(
    input.useCommitSigning
      ? toolingCommitSigningMd.trim()
      : renderTemplate(toolingGitMd.trim(), {
          GIT_PUSH_WRAPPER: input.gitPushWrapper,
          CLAUDE_BRANCH_OR_HEAD: input.claudeBranch || "HEAD",
        }),
  );

  if (input.claudeBranch && input.baseBranch) {
    sections.push(
      renderTemplate(toolingPrMd.trim(), {
        CLAUDE_BRANCH: input.claudeBranch,
        BASE_BRANCH: input.baseBranch,
        CLOSING_KEYWORD_LINE: input.closingKeyword
          ? `- Because this run was triggered from an issue, the PR body must include "${input.closingKeyword}" so GitHub auto-closes the issue when the PR is merged.`
          : "",
      }),
    );
  }

  return sections.filter(Boolean).join("\n");
}
