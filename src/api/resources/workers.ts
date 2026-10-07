import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  AgentProviderAddBody,
  AgentDeclaration,
  AgentEnablement,
  AgentEnablementPutBody,
  AgentModel,
  AgentProviderKind,
  AgentSummary,
  WorkerCatalogEntry,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "../types";

function enablementPath(agentName: string): string {
  return `/api/agent/enablement/${encodeURIComponent(agentName)}`;
}

export async function listWorkerCatalog(): Promise<readonly WorkerCatalogItem[]> {
  return readAllPages<WorkerCatalogItem>("/api/worker/catalog");
}

export async function readWorkerCatalogEntry(workerName: string): Promise<WorkerCatalogEntry> {
  return request<WorkerCatalogEntry>(`/api/worker/catalog/${encodeURIComponent(workerName)}`);
}

export async function listWorkerInstances(
  projectId: string,
): Promise<readonly WorkerInstanceRecord[]> {
  return readAllPages<WorkerInstanceRecord>("/api/worker/instance", { project_id: projectId });
}

export async function listAgentEnablements(): Promise<readonly AgentEnablement[]> {
  return readAllPages<AgentEnablement>("/api/agent/enablement");
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
    workersByAgent.set(entry.agent_name, [
      ...(workersByAgent.get(entry.agent_name) ?? []),
      entry.name,
    ]);
  }
  return [...workersByAgent.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([agentName, workerNames]) => ({
      agentName,
      workerNames,
      enablement: enablements.find((enablement) => enablement.agent_name === agentName) ?? null,
    }));
}

export async function readAgent(agentName: string): Promise<AgentDeclaration> {
  return request<AgentDeclaration>(`/api/agent/${encodeURIComponent(agentName)}`);
}

export async function listAgentProviderModels(
  agentName: string,
  providerName: string,
): Promise<readonly AgentModel[]> {
  const answer = await request<{ items: readonly AgentModel[] }>(
    `${enablementPath(agentName)}/provider/${encodeURIComponent(providerName)}/model`,
  );
  return answer.items;
}

export async function listCredentialModels(
  provider: AgentProviderKind,
  credential: string,
): Promise<readonly AgentModel[]> {
  const query = new URLSearchParams({ provider, credential });
  const answer = await request<{ items: readonly AgentModel[] }>(`/api/agent/model?${query}`);
  return answer.items;
}

export async function putAgentEnablement(
  agentName: string,
  body: AgentEnablementPutBody,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(enablementPath(agentName), {
    method: "PUT",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function addAgentProvider(
  agentName: string,
  body: AgentProviderAddBody,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(`${enablementPath(agentName)}/provider`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function removeAgentProvider(
  agentName: string,
  providerName: string,
  expectedRevision: number,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(
    `${enablementPath(agentName)}/provider/${encodeURIComponent(providerName)}`,
    {
      method: "DELETE",
      body: { expected_revision: expectedRevision },
      headers: { "idempotency-key": newUlid() },
    },
  );
}

export async function enableAgentEnablement(
  agentName: string,
  expectedRevision: number,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(`${enablementPath(agentName)}/enable`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newUlid() },
  });
}

export async function disableAgentEnablement(
  agentName: string,
  expectedRevision: number,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(`${enablementPath(agentName)}/disable`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newUlid() },
  });
}
