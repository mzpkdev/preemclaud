import { describe, expect, it } from "bun:test";
import {
  developOutputSchema,
  developImplementedOutputSchema,
  queueOutputSchema,
  reviewOutputSchema,
  maintainOutputSchema,
} from "./contracts.ts";

describe("structured publication contracts", () => {
  it("accepts valid queue output", () => {
    const parsed = queueOutputSchema.parse({
      issues: [
        {
          action: "create",
          title: "Add queue publisher tests",
          description: "Queue issues are not validated after publication.",
          context: "The queue publisher creates GitHub issues but has no post-publish validation, so malformed output silently produces broken issues.",
          affected_files: [
            { path: "arasaka/src/publish/queue.ts", line: 64, note: "publication entry point" },
          ],
          requirements: ["Renderer tests cover issue body output"],
          verification_commands: ["bun test"],
          not_in_scope: ["Do not modify the review publisher"],
          evidence: [
            { location: "arasaka/src/publish/queue.ts:64", observation: "no post-publish validation" },
          ],
          labels: ["auto-generated"],
          priority: "P1",
        },
      ],
    });

    expect(parsed.issues).toHaveLength(1);
  });

  it("accepts queue output with a filled template body", () => {
    const parsed = queueOutputSchema.parse({
      issues: [
        {
          action: "create",
          title: "Fix login timeout",
          description: "Login request has no timeout handling, causing hangs on slow connections.",
          context: "Users on slow connections experience indefinite hangs because the login fetch has no timeout.",
          affected_files: [
            { path: "src/auth/login.ts", line: 30, note: "missing timeout parameter" },
          ],
          requirements: ["Timeout is configurable"],
          verification_commands: ["bun test src/auth/login.test.ts"],
          not_in_scope: ["Do not change the auth flow"],
          evidence: [
            { location: "src/auth/login.ts:30", observation: "no timeout on fetch call" },
          ],
          labels: ["bug"],
          priority: "P1",
          body: "## Bug Report\n\n**Description**\nLogin hangs on slow connections.\n\n**Steps to Reproduce**\n1. Throttle network\n2. Attempt login\n",
        },
      ],
    });

    expect(parsed.issues[0]!.body).toContain("Bug Report");
  });

  it("accepts queue output without body (fallback to default template)", () => {
    const parsed = queueOutputSchema.parse({
      issues: [
        {
          action: "create",
          title: "Add tests",
          description: "No tests exist for the core module.",
          context: "The core module has zero test coverage, making regressions invisible.",
          affected_files: [
            { path: "src/index.ts", note: "untested entry point" },
          ],
          requirements: ["`bun test` exits clean"],
          verification_commands: ["bun test"],
          not_in_scope: ["Do not refactor existing code"],
          evidence: [
            { location: "src/index.ts", observation: "zero test coverage" },
          ],
          labels: [],
          priority: "P2",
        },
      ],
    });

    expect(parsed.issues[0]!.body).toBeUndefined();
  });

  it("accepts queue output with depends_on", () => {
    const parsed = queueOutputSchema.parse({
      issues: [
        {
          action: "create",
          title: "Add integration tests",
          description: "Integration tests are missing for the publish pipeline.",
          context: "Unit tests exist but no integration tests verify end-to-end issue creation against the GitHub API.",
          affected_files: [
            { path: "src/publish/queue.test.ts", note: "new integration test file" },
          ],
          requirements: ["Integration tests pass"],
          verification_commands: ["bun test src/publish/"],
          not_in_scope: ["Do not modify production code"],
          evidence: [
            { location: "src/publish/queue.ts", observation: "no integration test coverage" },
          ],
          labels: ["tech debt"],
          priority: "P1",
          depends_on: [42, 57],
        },
      ],
    });

    expect(parsed.issues[0]!.depends_on).toEqual([42, 57]);
  });

  it("rejects queue updates without a target issue number", () => {
    expect(() =>
      queueOutputSchema.parse({
        issues: [
          {
            action: "update",
            title: "Refresh an existing issue",
            description: "Issue body text is stale and needs tighter requirements.",
            context: "The existing issue references files that have been removed and needs updated requirements.",
            affected_files: [
              { path: "src/config.ts", note: "referenced in stale issue" },
            ],
            requirements: ["Updated body is published"],
            verification_commands: ["gh issue view 12 --json body"],
            not_in_scope: ["Do not change the issue title"],
            evidence: [
              { location: "#12", observation: "body references removed files" },
            ],
            labels: [],
            priority: "P0",
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

  it("accepts develop output with a filled PR template body", () => {
    const parsed = developOutputSchema.parse({
      status: "implemented",
      pull_request: {
        title: "Fix login timeout",
        summary: "Adds timeout handling to login flow.",
        changes: ["Adds configurable timeout"],
        verification: ["bun test"],
        assumptions: [],
        body: "## Summary\n\nAdds timeout handling.\n\n## Test Plan\n\n- [x] Unit tests pass\n",
      },
      issue_comment: {
        summary: "Implemented timeout handling.",
        verification: ["bun test"],
        follow_ups: [],
      },
    });

    expect(parsed.pull_request.body).toContain("Summary");
  });

  it("accepts develop output without body (fallback to default template)", () => {
    const parsed = developOutputSchema.parse({
      status: "implemented",
      pull_request: {
        title: "Fix login timeout",
        summary: "Adds timeout handling.",
        changes: ["Adds timeout"],
        verification: ["bun test"],
        assumptions: [],
      },
      issue_comment: {
        summary: "Implemented.",
        verification: ["bun test"],
        follow_ups: [],
      },
    });

    expect(parsed.pull_request.body).toBeUndefined();
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

  it("accepts valid no-findings review output", () => {
    const parsed = reviewOutputSchema.parse({
      verdict: "no_findings",
      summary: "No actionable issues were found.",
      findings: [],
      residual_risks: [],
    });

    expect(parsed.verdict).toBe("no_findings");
  });

  it("accepts valid maintain output with warn_stale action", () => {
    const parsed = maintainOutputSchema.parse({
      actions: [
        {
          type: "warn_stale",
          entity: "issue",
          number: 5,
          title: "Old feature request",
          reason: "No activity for 45 days",
          comment: "This issue has been inactive. Please respond to keep it open.",
          labels_to_add: ["stale"],
        },
      ],
      summary: "One stale issue flagged for review.",
    });

    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0]!.type).toBe("warn_stale");
  });

  it("rejects warn_stale without comment", () => {
    expect(() =>
      maintainOutputSchema.parse({
        actions: [
          {
            type: "warn_stale",
            entity: "issue",
            number: 5,
            title: "Old feature request",
            reason: "No activity for 45 days",
            labels_to_add: ["stale"],
          },
        ],
        summary: "One stale issue flagged.",
      }),
    ).toThrow("comment is required");
  });

  it("rejects add_labels without labels_to_add", () => {
    expect(() =>
      maintainOutputSchema.parse({
        actions: [
          {
            type: "add_labels",
            entity: "issue",
            number: 10,
            title: "Unlabeled issue",
            reason: "Issue has no labels",
          },
        ],
        summary: "One issue needs labels.",
      }),
    ).toThrow("labels_to_add is required");
  });

  it("accepts empty maintain actions array", () => {
    const parsed = maintainOutputSchema.parse({
      actions: [],
      summary: "No maintenance actions warranted.",
    });

    expect(parsed.actions).toHaveLength(0);
  });

  it("accepts valid report_failure action without number", () => {
    const parsed = maintainOutputSchema.parse({
      actions: [
        {
          type: "report_failure",
          entity: "issue",
          title: "Deploy workflow failed",
          reason: "Build step exited with code 1",
          comment: "The deploy-pages workflow failed due to a TypeScript compilation error.",
          run_id: 12345678,
          run_url: "https://github.com/owner/repo/actions/runs/12345678",
          workflow_name: "deploy-pages",
        },
      ],
      summary: "One CI failure reported.",
    });

    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0]!.type).toBe("report_failure");
    expect(parsed.actions[0]!.number).toBeUndefined();
  });

  it("rejects report_failure without run_id", () => {
    expect(() =>
      maintainOutputSchema.parse({
        actions: [
          {
            type: "report_failure",
            entity: "issue",
            title: "Deploy workflow failed",
            reason: "Build step exited with code 1",
            comment: "Compilation error.",
            run_url: "https://github.com/owner/repo/actions/runs/123",
            workflow_name: "deploy-pages",
          },
        ],
        summary: "One CI failure.",
      }),
    ).toThrow("run_id is required");
  });

  it("rejects report_failure without comment", () => {
    expect(() =>
      maintainOutputSchema.parse({
        actions: [
          {
            type: "report_failure",
            entity: "issue",
            title: "Deploy workflow failed",
            reason: "Build step exited with code 1",
            run_id: 12345678,
            run_url: "https://github.com/owner/repo/actions/runs/12345678",
            workflow_name: "deploy-pages",
          },
        ],
        summary: "One CI failure.",
      }),
    ).toThrow("comment is required");
  });

  it("rejects non-report_failure action without number", () => {
    expect(() =>
      maintainOutputSchema.parse({
        actions: [
          {
            type: "close_stale",
            entity: "issue",
            title: "Old issue",
            reason: "No activity",
            comment: "Closing.",
          },
        ],
        summary: "Closing stale issue.",
      }),
    ).toThrow("number is required");
  });
});
