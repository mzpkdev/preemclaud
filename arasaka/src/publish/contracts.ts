import { z } from "zod";

export const priorityValues = ["P0", "P1", "P2", "P3"] as const;
export type Priority = (typeof priorityValues)[number];

export const affectedFileSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  note: z.string().min(1),
});

export const evidenceSchema = z.object({
  location: z.string().min(1),
  observation: z.string().min(1),
});

export const issuePublicationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  context: z.string().min(1),
  affected_files: z.array(affectedFileSchema),
  requirements: z.array(z.string().min(1)),
  verification_commands: z.array(z.string().min(1)),
  not_in_scope: z.array(z.string().min(1)),
  evidence: z.array(evidenceSchema),
  labels: z.array(z.string().min(1)),
  priority: z.enum(priorityValues),
  body: z.string().min(1).optional(),
});

export const queueIssueSchema = issuePublicationSchema
  .extend({
    action: z.enum(["create", "update"]),
    existing_issue_number: z.number().int().positive().optional(),
    depends_on: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "update" && value.existing_issue_number === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "existing_issue_number is required when action is update",
      });
    }
  });

export const queueOutputSchema = z.object({
  issues: z.array(queueIssueSchema),
});

export const developImplementedOutputSchema = z.object({
  status: z.literal("implemented"),
  pull_request: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    changes: z.array(z.string().min(1)),
    verification: z.array(z.string().min(1)),
    assumptions: z.array(z.string().min(1)),
    body: z.string().min(1).optional(),
  }),
  issue_comment: z.object({
    summary: z.string().min(1),
    verification: z.array(z.string().min(1)),
    follow_ups: z.array(z.string().min(1)),
  }),
});

export const developOutputSchema = developImplementedOutputSchema;

export const reviewFindingSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  file: z.string().min(1),
  line: z.number().int().positive(),
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const reviewOutputSchema = z.object({
  verdict: z.enum(["findings", "no_findings"]),
  summary: z.string().min(1),
  findings: z.array(reviewFindingSchema),
  residual_risks: z.array(z.string().min(1)),
});

export const maintainActionSchema = z
  .object({
    type: z.enum([
      "warn_stale",
      "close_stale",
      "reply_question",
      "add_labels",
      "report_failure",
    ]),
    entity: z.enum(["issue", "pull_request"]),
    number: z.number().int().positive().optional(),
    title: z.string().min(1),
    reason: z.string().min(1),
    comment: z.string().optional(),
    labels_to_add: z.array(z.string().min(1)).optional(),
    labels_to_remove: z.array(z.string().min(1)).optional(),
    run_id: z.number().int().positive().optional(),
    run_url: z.string().min(1).optional(),
    workflow_name: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type !== "report_failure" && value.number === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "number is required for non-report_failure actions",
      });
    }
    if (
      (value.type === "warn_stale" ||
        value.type === "close_stale" ||
        value.type === "reply_question" ||
        value.type === "report_failure") &&
      !value.comment
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `comment is required for ${value.type} actions`,
      });
    }
    if (
      (value.type === "warn_stale" || value.type === "add_labels") &&
      (!value.labels_to_add || value.labels_to_add.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `labels_to_add is required for ${value.type} actions`,
      });
    }
    if (value.type === "report_failure") {
      if (!value.run_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "run_id is required for report_failure actions",
        });
      }
      if (!value.run_url) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "run_url is required for report_failure actions",
        });
      }
      if (!value.workflow_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "workflow_name is required for report_failure actions",
        });
      }
    }
  });

export const maintainOutputSchema = z.object({
  actions: z.array(maintainActionSchema),
  summary: z.string().min(1),
});

export type QueueOutput = z.infer<typeof queueOutputSchema>;
export type DevelopOutput = z.infer<typeof developOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type MaintainOutput = z.infer<typeof maintainOutputSchema>;
export type MaintainAction = z.infer<typeof maintainActionSchema>;
