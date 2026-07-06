export type DesignRequest = {
  id: string;
  title: string;
  project: string;
  status: "open" | "in_review" | "approved" | "rejected" | "not_found";
  requirement: string;
  figmaUrl?: string;
  githubUrl?: string;
};

export type AgentDecision = "approve" | "revise" | "reject";
export type RiskLevel = "low" | "medium" | "high";

export type FrontendTask = {
  title: string;
  acceptance_criteria: string[];
};

export type AgentResult = {
  request_id: string;
  decision: AgentDecision;
  summary: string;
  risk_level: RiskLevel;
  frontend_tasks: FrontendTask[];
  validation: string[];
};
