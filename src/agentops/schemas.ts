import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  task_type: z.enum([
    "epic",
    "story",
    "task",
    "bug",
    "spec",
    "design_review",
    "implementation",
    "validation",
    "approval"
  ]).default("task"),
  source: z.enum(["manual", "design_request", "github", "agent", "system"]).default("manual"),
  source_ref: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  parent_task_id: z.string().optional(),
  assigned_agent_id: z.string().optional(),
  owner_user_id: z.string().optional(),
  repo_owner: z.string().optional(),
  repo_name: z.string().optional(),
  repo_branch: z.string().optional(),
  idempotency_key: z.string().min(1).max(200).optional()
});

export const updateTaskSchema = createTaskSchema.partial().omit({ parent_task_id: true });

export const createTaskLinkSchema = z.object({
  to_task_id: z.string().min(1),
  link_type: z.enum([
    "parent_child",
    "blocks",
    "depends_on",
    "relates_to",
    "duplicates",
    "derived_from",
    "implements",
    "validates"
  ]),
  created_by: z.string().optional(),
  idempotency_key: z.string().min(1).max(200).optional()
});

export const transitionTaskSchema = z.object({
  transition: z.enum([
    "SUBMIT",
    "RUN_AGENT",
    "BLOCK",
    "UNBLOCK",
    "CALLBACK_SUCCESS",
    "CALLBACK_FAILED",
    "APPROVE_PLAN",
    "REVISE",
    "APPROVE_WRITE",
    "REJECT_WRITE",
    "PR_CREATED",
    "VALIDATION_PASSED",
    "VALIDATION_FAILED",
    "CANCEL"
  ]),
  actor: z.enum(["user", "agent", "system"]).default("user"),
  actor_id: z.string().optional(),
  note: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  idempotency_key: z.string().min(1).max(200).optional()
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskLinkInput = z.infer<typeof createTaskLinkSchema>;
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;
