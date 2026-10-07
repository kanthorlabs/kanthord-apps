import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import type { PromptSettings, PromptTarget, SystemLayerOverride } from "../types";

const PROMPT_PATH = "/api/agent/prompt";
const ABSENT_REVISION = 0;

function revisionOf(expectedRevision: number): { expectedRevision?: number } {
  return expectedRevision === ABSENT_REVISION ? {} : { expectedRevision };
}

export async function readPromptSettings(target: PromptTarget): Promise<PromptSettings> {
  const query = new URLSearchParams({
    scope: target.scope,
    ...(target.agentName === undefined ? {} : { agentName: target.agentName }),
  });
  return request<PromptSettings>(`${PROMPT_PATH}?${query}`);
}

export async function switchPromptSource(
  target: PromptTarget,
  expectedRevision: number,
  name: string,
  enabled: boolean,
): Promise<PromptSettings> {
  return request<PromptSettings>(`${PROMPT_PATH}/switch`, {
    method: "POST",
    body: { ...target, ...revisionOf(expectedRevision), switch: name, enabled },
    headers: { "idempotency-key": newUlid() },
  });
}

export async function setSystemLayerOverride(
  agentName: string,
  expectedRevision: number,
  systemLayer: SystemLayerOverride,
): Promise<PromptSettings> {
  return request<PromptSettings>(`${PROMPT_PATH}/switch`, {
    method: "POST",
    body: {
      scope: "agent",
      agentName,
      ...revisionOf(expectedRevision),
      system_layer: systemLayer,
    },
    headers: { "idempotency-key": newUlid() },
  });
}
