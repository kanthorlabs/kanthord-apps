import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  AgentCooldown,
  AgentDeclaration,
  AgentEnablement,
  AgentEnablementPutBody,
  AgentListItem,
  AgentModel,
  AgentPromptScope,
  AgentProviderAddBody,
  AgentProviderKind,
  AgentSummary,
  PlacementStatus,
  PromptResolveAnswer,
  WorkerCatalogEntry,
  WorkerCatalogItem,
  WorkerRegistrationRecord,
} from "../types";

function enablementPath(agentName: string): string {
  return `/api/agent/enablement/${encodeURIComponent(agentName)}`;
}

export async function listAgentCooldowns(): Promise<readonly AgentCooldown[]> {
  return (await request<{ readonly items: readonly AgentCooldown[] }>("/api/agent/cooldown")).items;
}

export async function listWorkerCatalog(): Promise<readonly WorkerCatalogItem[]> {
  return readAllPages<WorkerCatalogItem>("/api/worker/catalog");
}

export async function readWorkerCatalogEntry(workerName: string): Promise<WorkerCatalogEntry> {
  return request<WorkerCatalogEntry>(`/api/worker/catalog/${encodeURIComponent(workerName)}`);
}

export async function listWorkerRegistrations(
  projectId: string,
): Promise<readonly WorkerRegistrationRecord[]> {
  return readAllPages<WorkerRegistrationRecord>("/api/worker/registration", {
    project_id: projectId,
  });
}

export async function listAllWorkerRegistrations(): Promise<readonly WorkerRegistrationRecord[]> {
  return readAllPages<WorkerRegistrationRecord>("/api/worker/registration");
}

export async function listWorkerPlacements(): Promise<readonly PlacementStatus[]> {
  return (await request<{ readonly items: readonly PlacementStatus[] }>("/api/worker/placement"))
    .items;
}

export async function listAgentEnablements(): Promise<readonly AgentEnablement[]> {
  return readAllPages<AgentEnablement>("/api/agent/enablement");
}

export async function readAgentEnablement(agentName: string): Promise<AgentEnablement> {
  return request<AgentEnablement>(enablementPath(agentName));
}

export async function listAgents(): Promise<readonly AgentSummary[]> {
  const items = await readAllPages<AgentListItem>("/api/agent");
  return items.map((item) => ({
    agentName: item.agent_name,
    displayName: item.display_name,
    workerNames: item.worker_names,
    consumers: item.consumers,
    toolCounts: item.tool_counts,
    enablement: item.enablement,
  }));
}

export async function readAgent(
  agentName: string,
  scope: AgentPromptScope | null = null,
): Promise<AgentDeclaration> {
  const query =
    scope === null
      ? ""
      : `?${new URLSearchParams({ project_id: scope.projectId, binding_id: scope.bindingId })}`;
  return request<AgentDeclaration>(`/api/agent/${encodeURIComponent(agentName)}${query}`);
}

export async function resolveAgentPrompt(
  executionId: string,
  agentName: string,
): Promise<PromptResolveAnswer> {
  const query = new URLSearchParams({ execution_id: executionId, agent_name: agentName });
  return request<PromptResolveAnswer>(`/api/agent/prompt/resolve?${query}`);
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
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function addAgentProvider(
  agentName: string,
  body: AgentProviderAddBody,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(`${enablementPath(agentName)}/provider`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newIdempotencyKey() },
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
      headers: { "idempotency-key": newIdempotencyKey() },
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
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function disableAgentEnablement(
  agentName: string,
  expectedRevision: number,
): Promise<AgentEnablement> {
  return request<AgentEnablement>(`${enablementPath(agentName)}/disable`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}
