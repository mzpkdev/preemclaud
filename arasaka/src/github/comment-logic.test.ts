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

    it("strips Arasaka final-comment template elements to prevent doubling", () => {
      // Simulates currentBody that is already a formatted Arasaka comment
      const preFormatted = [
        `<img src="${ASSET_BASE}/issue-reply.svg" />`,
        "",
        "> **STATUS: FULFILLED** · @testuser",
        "",
        `<img src="${ASSET_BASE}/divider.svg" />`,
        "",
        "The actual response content.",
        "",
        `<img src="${ASSET_BASE}/footer.svg" />`,
        "",
        "<sub>Arasaka Corporation. Your future, our property.</sub>",
        "",
        `<img src="${ASSET_BASE}/footer.svg" />`,
      ].join("\n");

      const input: CommentUpdateInput = {
        ...baseInput,
        currentBody: preFormatted,
        triggerUsername: "testuser",
        executionDetails: { duration_ms: 60000, total_cost_usd: 0.10 },
      };

      const result = updateCommentBody(input);
      // Template elements must appear exactly once (added by COMMENT_TEMPLATE, not duplicated from body)
      const replyCount = (result.match(/issue-reply\.svg/g) ?? []).length;
      const dividerCount = (result.match(/divider\.svg/g) ?? []).length;
      const footerCount = (result.match(/footer\.svg/g) ?? []).length;
      const statusCount = (result.match(/STATUS: FULFILLED/g) ?? []).length;
      expect(replyCount).toBe(1);
      expect(dividerCount).toBe(1);
      expect(footerCount).toBe(1);
      expect(statusCount).toBe(1);
      // Actual response body must survive
      expect(result).toContain("The actual response content.");
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
      expect(result).toContain("STATUS: FULFILLED");
    });

    it("handles missing duration gracefully", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        executionDetails: { total_cost_usd: 0.25 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("`$0.25`");
      expect(result).toContain("STATUS: FULFILLED");
    });
  });

  describe("structural compatibility", () => {
    it("preserves reply-asset → header → links → divider → content → sub → footer order", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        currentBody: "### Todo List:\n- [x] Done",
        executionDetails: { duration_ms: 65000, total_cost_usd: 0.01 },
        triggerUsername: "trigger-user",
        branchName: "claude-branch-123",
        prLink: "\n[Create a PR](https://github.com/owner/repo/pr-url)",
      };

      const result = updateCommentBody(input);

      const replyAssetIdx = result.indexOf("issue-reply.svg");
      const headerIdx = result.indexOf("STATUS: FULFILLED");
      const linksIdx = result.indexOf("—— [View job]");
      const dividerIdx = result.indexOf("divider.svg");
      const contentIdx = result.indexOf("### Todo List:");
      const subIdx = result.indexOf("Arasaka Corporation.");
      const footerIdx = result.indexOf("footer.svg");

      expect(replyAssetIdx).toBeLessThan(headerIdx);
      expect(headerIdx).toBeLessThan(linksIdx);
      expect(linksIdx).toBeLessThan(dividerIdx);
      expect(dividerIdx).toBeLessThan(contentIdx);
      expect(contentIdx).toBeLessThan(subIdx);
      expect(subIdx).toBeLessThan(footerIdx);
    });

    it("includes corporate tagline before footer", () => {
      const result = updateCommentBody({ ...baseInput, triggerUsername: "u" });
      const footerIdx = result.indexOf("footer.svg");
      const taglineIdx = result.indexOf("Arasaka Corporation.");
      expect(taglineIdx).toBeLessThan(footerIdx);
    });

    it("uses error header on failure", () => {
      const input: CommentUpdateInput = {
        ...baseInput,
        actionFailed: true,
        executionDetails: { duration_ms: 45000 },
        triggerUsername: "testuser",
      };

      const result = updateCommentBody(input);
      expect(result).toContain("STATUS: FAILED");
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

  describe("closing line selection", () => {
    it("injects a persona-derived closing line into the footer", () => {
      const result = updateCommentBody({ ...baseInput, triggerUsername: "u" });
      expect(result).toMatch(
        /<sub>Arasaka Corporation\. (Your future is our property\.|The family remembers\.|Your record reflects your loyalty\.|We are patient\. We have time\.|The family is grateful for your contribution\.|Continuity is the highest form of loyalty\.|What you build here does not disappear\.)<\/sub>/,
      );
    });

    it("keeps the same closing line for the same job URL", () => {
      const first = updateCommentBody({ ...baseInput, triggerUsername: "u" });
      const second = updateCommentBody({ ...baseInput, triggerUsername: "u" });

      const firstClosing = first.match(/<sub>Arasaka Corporation\. (.*)<\/sub>/)?.[1];
      const secondClosing = second.match(/<sub>Arasaka Corporation\. (.*)<\/sub>/)?.[1];

      expect(firstClosing).toBeDefined();
      expect(secondClosing).toBeDefined();
      expect(firstClosing).toBe(secondClosing);
    });

    it("varies the closing line across different job URLs", () => {
      const first = updateCommentBody({
        ...baseInput,
        triggerUsername: "u",
        jobUrl: "https://github.com/owner/repo/actions/runs/123",
      });
      const second = updateCommentBody({
        ...baseInput,
        triggerUsername: "u",
        jobUrl: "https://github.com/owner/repo/actions/runs/125",
      });

      const firstClosing = first.match(/<sub>Arasaka Corporation\. (.*)<\/sub>/)?.[1];
      const secondClosing = second.match(/<sub>Arasaka Corporation\. (.*)<\/sub>/)?.[1];

      expect(firstClosing).toBeDefined();
      expect(secondClosing).toBeDefined();
      expect(firstClosing).not.toBe(secondClosing);
    });
  });
});
