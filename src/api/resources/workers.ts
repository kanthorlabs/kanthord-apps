import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  AgentDeclaration,
  AgentEnablement,
  AgentSummary,
  WorkerCatalogEntry,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "../types";

export async function listWorkerCatalog(): Promise<readonly WorkerCatalogItem[]> {
  return readAllPages<WorkerCatalogItem>("/api/worker/catalog");
}

export async function readWorkerCatalogEntry(workerName: string): Promise<WorkerCatalogEntry> {
  return request<WorkerCatalogEntry>(`/api/worker/catalog/${encodeURIComponent(workerName)}`);
}

export async function listWorkerInstances(
  projectId: string,
): Promise<readonly WorkerInstanceRecord[]> {
  return readAllPages<WorkerInstanceRecord>("/api/worker/instance", { projectId });
}

export async function listAgentEnablements(): Promise<readonly AgentEnablement[]> {
  return readAllPages<AgentEnablement>("/api/worker/agent/enablement");
}

export async function listAgents(): Promise<readonly AgentSummary[]> {
  const [catalog, enablements] = await Promise.all([listWorkerCatalog(), listAgentEnablements()]);
  const entries = await Promise.all(
    catalog
      .filter((item) => item.host === "kanthord")
      .map((item) => readWorkerCatalogEntry(item.name)),
  );
  const workersByAgent = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.host !== "kanthord") continue;
    workersByAgent.set(entry.agentName, [
      ...(workersByAgent.get(entry.agentName) ?? []),
      entry.name,
    ]);
  }
  return [...workersByAgent.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([agentName, workerNames]) => ({
      agentName,
      workerNames,
      enablement: enablements.find((enablement) => enablement.agentName === agentName) ?? null,
    }));
}

export async function readAgent(agentName: string): Promise<AgentDeclaration> {
  return request<AgentDeclaration>(`/api/worker/agent/${encodeURIComponent(agentName)}`);
}
