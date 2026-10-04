import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  AgentDeclaration,
  AgentSummary,
  Page,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "../types";

const AGENT_PAGE_LIMIT = 1000;

export async function listWorkerCatalog(): Promise<readonly WorkerCatalogItem[]> {
  return readAllPages<WorkerCatalogItem>("/api/worker/catalog");
}

export async function listWorkerInstances(
  projectId: string,
): Promise<readonly WorkerInstanceRecord[]> {
  return readAllPages<WorkerInstanceRecord>("/api/worker/instance", { projectId });
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
