export type AuditAction =
  | "ds_submit_agent_result"
  | "github_create_branch"
  | "github_upsert_file"
  | "github_create_pr"
  | "github_comment_pr";

export type AuditEvent = {
  action: AuditAction;
  source: "mcp" | "rest" | "github-client";
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string;
  pr_number?: number;
  request_id?: string;
  status: "success" | "failure";
  message?: string;
  timestamp?: string;
};

export function writeAuditEvent(event: AuditEvent): void {
  const payload = {
    level: "audit",
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event
  };

  console.info(JSON.stringify(payload));
}
