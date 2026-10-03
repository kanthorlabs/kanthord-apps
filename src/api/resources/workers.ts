import { request } from "../client";
import type {
  AgentDeclaration,
  AgentSummary,
  Page,
  WorkerInstance,
  WorkerTemplate,
} from "../types";

const AGENT_PAGE_LIMIT = 1000;

export async function listTemplates(): Promise<readonly WorkerTemplate[]> {
  return request<readonly WorkerTemplate[]>("/v1/workers/templates");
}

export async function listInstances(projectId: string): Promise<readonly WorkerInstance[]> {
  return request<readonly WorkerInstance[]>(`/v1/projects/${projectId}/workers/instances`);
}

export async function listAgents(): Promise<readonly AgentSummary[]> {
  const agents: AgentSummary[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: String(AGENT_PAGE_LIMIT) });
    if (cursor !== null) query.set("cursor", cursor);
    const page: Page<AgentSummary> = await request<Page<AgentSummary>>(
      `/api/worker/agent?${query}`,
    );
    agents.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return agents;
}

export async function readAgent(agentName: string): Promise<AgentDeclaration> {
  return request<AgentDeclaration>(`/api/worker/agent/${encodeURIComponent(agentName)}`);
}
