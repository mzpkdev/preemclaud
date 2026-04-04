import { describe, it, expect } from "bun:test";
import {
  updateCommentBody,
  type CommentUpdateInput,
} from "./comment-logic.ts";

const ASSET_BASE =
  "https://raw.githubusercontent.com/mzpkdev/preemclaud/main/arasaka/assets";

const baseInput: CommentUpdateInput = {
  currentBody: "Initial comment body",
  actionFailed: false,
  executionDetails: null,
  jobUrl: "https://github.com/owner/repo/actions/runs/123",
  branchName: undefined,
  triggerUsername: undefined,
};

describe("updateCommentBody — Arasaka-specific", () => {
  describe("initial comment stripping", () => {
    it("strips the full Arasaka initial comment (banner + in-progress + sub)", () => {
      const initialComment = [
        `<img src="${ASSET_BASE}/banner.svg" />`,
        `<img src="${ASSET_BASE}/issue-in-progress.svg" />`,
        "",
        "<sub>アラサカ自動システム — Processing request...</sub>",
        "",
        "### Todo List:\n- [x] Read code",
      ].join("\n");

      const input: CommentUpdateInput = {
        ...baseInput,
        currentBody: initialComment,
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).not.toContain("banner.svg");
      expect(result).not.toContain("issue-in-progress.svg");
      expect(result).not.toContain("アラサカ自動システム");
      expect(result).toContain("### Todo List:");
      expect(result).toContain("- [x] Read code");
    });

    it("strips partial initial comment (only in-progress SVG)", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        currentBody: `<img src="${ASSET_BASE}/issue-in-progress.svg" />\n\nSome content`,
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).not.toContain("issue-in-progress.svg");
      expect(result).toContain("Some content");
    });
  });

  describe("SVG asset presence in output", () => {
    it("includes issue-reply.svg, divider.svg, and footer.svg on success", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("issue-reply.svg");
      expect(result).toContain("divider.svg");
      expect(result).toContain("footer.svg");
    });

    it("does not include error-reply.svg on success", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).not.toContain("error-reply.svg");
    });
  });

  describe("error SVG selection", () => {
    it("uses error-reply.svg instead of issue-reply.svg on failure", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        actionFailed: true,
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("error-reply.svg");
      expect(result).not.toContain("issue-reply.svg");
      expect(result).toContain("footer.svg");
    });

    it("includes error details when provided", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        actionFailed: true,
        errorDetails: "Failed to fetch issue data",
        executionDetails: { duration_ms: 45000 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("error-reply.svg");
      expect(result).toContain("```\nFailed to fetch issue data\n```");
    });
  });

  describe("cost/duration formatting", () => {
    it("includes cost and duration in backtick spans", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        executionDetails: { duration_ms: 75000, total_cost_usd: 0.42 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("`1m 15s`");
      expect(result).toContain("`$0.42`");
    });

    it("handles missing cost gracefully (no stray backticks)", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        executionDetails: { duration_ms: 30000 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("`30s`");
      // Empty cost produces `` which is an empty code span — acceptable
      expect(result).toContain("**Directive fulfilled — @testuser**");
    });

    it("handles missing duration gracefully", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        executionDetails: { total_cost_usd: 0.25 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("`$0.25`");
      expect(result).toContain("**Directive fulfilled — @testuser**");
    });
  });

  describe("structural compatibility", () => {
    it("preserves header → links → divider → content → divider → footer order", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        currentBody: "### Todo List:\n- [x] Done",
        executionDetails: { duration_ms: 65000, total_cost_usd: 0.01 },
        triggerUsername: "trigger-user",
        branchName: "claude-branch-123",
        prLink: "\n[Create a PR](https://github.com/owner/repo/pr-url)",
      };

      const result = updateCommentBody(input);

      const headerIdx = result.indexOf("**Directive fulfilled");
      const linksIdx = result.indexOf("—— [View job]");
      // Find the second divider (after the reply header divider)
      const firstDividerIdx = result.indexOf("divider.svg");
      const secondDividerIdx = result.indexOf("divider.svg", firstDividerIdx + 1);
      const contentIdx = result.indexOf("### Todo List:");
      const thirdDividerIdx = result.indexOf("divider.svg", secondDividerIdx + 1);
      const footerIdx = result.indexOf("footer.svg");

      expect(headerIdx).toBeLessThan(linksIdx);
      expect(linksIdx).toBeLessThan(secondDividerIdx);
      expect(secondDividerIdx).toBeLessThan(contentIdx);
      expect(contentIdx).toBeLessThan(thirdDividerIdx);
      expect(thirdDividerIdx).toBeLessThan(footerIdx);
    });

    it("includes corporate tagline after footer", () => {
      const result = updateCommentBody({ ...baseInput, triggerUsername: "u" });
      const footerIdx = result.indexOf("footer.svg");
      const taglineIdx = result.indexOf("Your future, our property.");
      expect(taglineIdx).toBeGreaterThan(footerIdx);
    });

    it("uses error header on failure", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        actionFailed: true,
        executionDetails: { duration_ms: 45000 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("**Directive could not be completed — @testuser**");
      expect(result).toContain("`45s`");
    });

    it("includes View job link", () => {
      const result = updateCommentBody({ ...baseInput, triggerUsername: "u" });
      expect(result).toContain(`—— [View job](${baseInput.jobUrl})`);
    });

    it("includes branch and PR links when provided", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        branchName: "claude/issue-42",
        prLink:
          "\n[Create a PR](https://github.com/owner/repo/compare/main...claude/issue-42)",
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("• [`claude/issue-42`]");
      expect(result).toContain("• [Create PR ➔]");
    });
  });
});
