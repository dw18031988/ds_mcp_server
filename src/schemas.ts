import { z } from "zod";

export const frontendTaskSchema = z.object({
  title: z.string().min(1),
  acceptance_criteria: z.array(z.string().min(1)).min(1)
});

export const agentResultSchema = z.object({
  request_id: z.string().min(1),
  decision: z.enum(["approve", "revise", "reject"]),
  summary: z.string().min(1),
  risk_level: z.enum(["low", "medium", "high"]),
  frontend_tasks: z.array(frontendTaskSchema).min(1),
  validation: z.array(z.string().min(1)).min(1)
});

export const githubCreateBranchSchema = z.object({
  branch: z.string().min(1),
  from_branch: z.string().min(1).optional()
});

export const githubUpsertFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  branch: z.string().min(1),
  message: z.string().min(1)
});

export const githubCreatePullRequestSchema = z.object({
  title: z.string().min(1),
  head: z.string().min(1),
  base: z.string().min(1).optional(),
  body: z.string().optional(),
  draft: z.boolean().optional()
});

export const githubCommentPullRequestSchema = z.object({
  body: z.string().min(1)
});

export type AgentResultInput = z.infer<typeof agentResultSchema>;
