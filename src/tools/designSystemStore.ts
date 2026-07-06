import type { AgentResult, DesignRequest } from "../types.js";

const mockRequests = new Map<string, DesignRequest>([
  [
    "DSR-001",
    {
      id: "DSR-001",
      title: "Review InvoiceCard mobile layout",
      project: "rental_home",
      status: "open",
      requirement:
        "Check mobile overflow, token consistency, component API impact, accessibility risk, and frontend implementation tasks.",
      figmaUrl: "",
      githubUrl: ""
    }
  ]
]);

const submittedResults = new Map<string, AgentResult>();

export async function getDesignRequest(requestId: string): Promise<DesignRequest> {
  const request = mockRequests.get(requestId);

  if (!request) {
    return {
      id: requestId,
      title: "Not found",
      project: "",
      status: "not_found",
      requirement: ""
    };
  }

  return request;
}

export async function submitAgentResult(result: AgentResult): Promise<{ stored: boolean }> {
  submittedResults.set(result.request_id, result);
  return { stored: true };
}

export async function listSubmittedResults(): Promise<AgentResult[]> {
  return Array.from(submittedResults.values());
}
