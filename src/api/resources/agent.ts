import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import type {
  AgentDeclaration,
  AgentVariant,
  AgentVariantCreateBody,
  AgentVariantItem,
  AgentVariantUpdateBody,
} from "../types";

const VARIANT_ROOT = "/api/agent/variant";

function variantPath(variantId: string): string {
  return `${VARIANT_ROOT}/${encodeURIComponent(variantId)}`;
}

function idempotencyHeader(): Record<string, string> {
  return { "idempotency-key": newIdempotencyKey() };
}

export async function listAgentVariants(): Promise<readonly AgentVariantItem[]> {
  return (await request<{ readonly items: readonly AgentVariantItem[] }>(VARIANT_ROOT)).items;
}

export async function readAgentVariant(variantId: string): Promise<AgentVariant> {
  return request<AgentVariant>(variantPath(variantId));
}

export async function createAgentVariant(body: AgentVariantCreateBody): Promise<AgentVariant> {
  return request<AgentVariant>(VARIANT_ROOT, {
    method: "POST",
    body,
    headers: idempotencyHeader(),
  });
}

export async function updateAgentVariant(
  variantId: string,
  body: AgentVariantUpdateBody,
): Promise<AgentVariant> {
  return request<AgentVariant>(variantPath(variantId), {
    method: "PUT",
    body,
    headers: idempotencyHeader(),
  });
}

export async function deleteAgentVariant(
  variantId: string,
  expectedRevision: number,
): Promise<void> {
  await request<unknown>(variantPath(variantId), {
    method: "DELETE",
    body: { expected_revision: expectedRevision },
    headers: idempotencyHeader(),
  });
}

export async function readAgentVariantPrompt(
  agentName: string,
  variantId: string,
): Promise<AgentDeclaration> {
  const query = new URLSearchParams({ variant_id: variantId });
  return request<AgentDeclaration>(`/api/agent/${encodeURIComponent(agentName)}?${query}`);
}
