import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import type { PromptSettings, PromptTarget, SystemLayerOverride } from "../types";

const PROMPT_PATH = "/api/agent/prompt";
const ABSENT_REVISION = 0;

function revisionOf(expectedRevision: number): { expected_revision?: number } {
  return expectedRevision === ABSENT_REVISION ? {} : { expected_revision: expectedRevision };
}

export async function readPromptSettings(target: PromptTarget): Promise<PromptSettings> {
  const query = new URLSearchParams({
    scope: target.scope,
    ...(target.agent_name === undefined ? {} : { agent_name: target.agent_name }),
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
      agent_name: agentName,
      ...revisionOf(expectedRevision),
      system_layer: systemLayer,
    },
    headers: { "idempotency-key": newUlid() },
  });
}

export async function putPromptText(
  target: PromptTarget,
  expectedRevision: number,
  customText: string,
): Promise<PromptSettings> {
  return request<PromptSettings>(PROMPT_PATH, {
    method: "PUT",
    body: { ...target, ...revisionOf(expectedRevision), custom_text: customText },
    headers: { "idempotency-key": newUlid() },
  });
}
