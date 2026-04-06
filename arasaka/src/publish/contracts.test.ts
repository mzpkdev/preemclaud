import { describe, expect, it } from "bun:test";
import {
  developOutputSchema,
  developDecompositionOutputSchema,
  developImplementedOutputSchema,
  queueOutputSchema,
  reviewOutputSchema,
} from "./contracts.ts";

describe("structured publication contracts", () => {
  it("accepts valid queue output", () => {
    const parsed = queueOutputSchema.parse({
      issues: [
        {
          action: "create",
          title: "Add queue publisher tests",
          summary: "Locks renderer-owned issue creation.",
          problem: "Queue issues are not validated after publication.",
          acceptance_criteria: ["Renderer tests cover issue body output"],
          evidence: ["arasaka/src/publish/queue.ts"],
          labels: ["auto-generated"],
        },
      ],
    });

    expect(parsed.issues).toHaveLength(1);
  });

  it("rejects queue updates without a target issue number", () => {
    expect(() =>
      queueOutputSchema.parse({
        issues: [
          {
            action: "update",
            title: "Refresh an existing issue",
            summary: "Refreshes issue body text.",
            problem: "Body text is stale.",
            acceptance_criteria: ["Updated body is published"],
            evidence: ["#12"],
            labels: [],
          },
        ],
      }),
    ).toThrow("existing_issue_number");
  });

  it("accepts valid develop output", () => {
    const parsed = developOutputSchema.parse({
      status: "implemented",
      pull_request: {
        title: "Publish structured Arasaka artifacts",
        summary: "Moves PR and issue messaging into templates.",
        changes: ["Adds renderers", "Adds publishers"],
        verification: ["npm run typecheck"],
        assumptions: [],
      },
      issue_comment: {
        summary: "The issue has been implemented.",
        verification: ["npm run typecheck"],
        follow_ups: [],
      },
    });

    expect(parsed.status).toBe("implemented");
    if (parsed.status !== "implemented") {
      throw new Error("expected implemented develop output");
    }
    expect(parsed.pull_request.title).toContain("Arasaka");
  });

  it("accepts valid decomposition develop output", () => {
    const parsed = developOutputSchema.parse({
      status: "needs_decomposition",
      summary: "The change should be split into smaller tasks.",
      reason: "Workflow and verification changes should land separately.",
      child_issues: [
        {
          title: "Run tests before deploy",
          summary: "Ensure deploy waits for tests.",
          problem: "Deployment currently runs without test gating.",
          acceptance_criteria: ["Tests run before build", "Deployment stops on test failures"],
          evidence: [".github/workflows/deploy-pages.yml"],
          labels: [],
        },
      ],
    });

    expect(parsed.status).toBe("needs_decomposition");
    if (parsed.status !== "needs_decomposition") {
      throw new Error("expected decomposition develop output");
    }
    expect(parsed.child_issues).toHaveLength(1);
  });

  it("rejects implemented output without status", () => {
    expect(() =>
      developImplementedOutputSchema.parse({
        pull_request: {
          title: "Missing status",
          summary: "Invalid payload.",
          changes: ["One change"],
          verification: ["npm test"],
          assumptions: [],
        },
        issue_comment: {
          summary: "Invalid payload.",
          verification: ["npm test"],
          follow_ups: [],
        },
      }),
    ).toThrow();
  });

  it("requires at least one child issue for decomposition output", () => {
    expect(() =>
      developDecompositionOutputSchema.parse({
        status: "needs_decomposition",
        summary: "Split it.",
        reason: "Too large.",
        child_issues: [],
      }),
    ).toThrow();
  });

  it("accepts valid no-findings review output", () => {
    const parsed = reviewOutputSchema.parse({
      verdict: "no_findings",
      summary: "No actionable issues were found.",
      findings: [],
      residual_risks: [],
    });

    expect(parsed.verdict).toBe("no_findings");
  });
});
