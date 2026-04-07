import { z } from "zod";

export const issuePublicationSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  problem: z.string().min(1),
  acceptance_criteria: z.array(z.string().min(1)),
  evidence: z.array(z.string().min(1)),
  labels: z.array(z.string().min(1)),
});

export const queueIssueSchema = issuePublicationSchema
  .extend({
    action: z.enum(["create", "update"]),
    existing_issue_number: z.number().int().positive().optional(),
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

export type QueueOutput = z.infer<typeof queueOutputSchema>;
export type DevelopOutput = z.infer<typeof developOutputSchema>;
export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
