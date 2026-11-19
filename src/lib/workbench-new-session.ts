import type { WorkbenchConfiguration } from "@/api/types";
import { reasoningEffortOf } from "./enablement-draft";
import { configurationOf } from "./workbench-configuration";

export const NEW_SESSION_PATH = "/workbench/new";

const FIELD_LABELS: Readonly<Record<string, string>> = {
  agentProvider: "agent provider",
  modelIdentifier: "model",
  reasoningEffort: "reasoning effort",
};

export type NewSessionRequest =
  | {
      readonly ok: true;
      readonly agentName: string;
      readonly agentDisplayName: string | null;
      readonly variantId: string | null;
      readonly configuration: WorkbenchConfiguration;
    }
  | { readonly ok: false; readonly message: string };

export interface FirstSendFailure {
  readonly draft: string;
  readonly code: string;
  readonly message: string;
}

export function newSessionPath(
  agentName: string,
  configuration: WorkbenchConfiguration,
  agentDisplayName: string | null = null,
  variantId: string | null = null,
): string {
  const params = new URLSearchParams({
    agent_name: agentName,
    agent_provider: configuration.agent_provider,
    model_identifier: configuration.model_identifier,
    reasoning_effort: configuration.reasoning_effort,
  });
  if (agentDisplayName !== null) params.set("display_name", agentDisplayName);
  if (variantId !== null) params.set("variant_id", variantId);
  return `${NEW_SESSION_PATH}?${params}`;
}

export function invalidFieldsText(errors: Readonly<Record<string, string>>): string {
  return Object.keys(errors)
    .map((key) => FIELD_LABELS[key] ?? key)
    .join(", ");
}

export function newSessionRequestOf(params: URLSearchParams): NewSessionRequest {
  const agentName = params.get("agent_name") ?? "";
  if (agentName === "") return { ok: false, message: "The address of this page names no agent." };
  const result = configurationOf({
    agentProvider: params.get("agent_provider") ?? "",
    modelIdentifier: params.get("model_identifier") ?? "",
    reasoningEffort: reasoningEffortOf(params.get("reasoning_effort")),
  });
  if (result.ok) {
    const variantId = params.get("variant_id") ?? "";
    return {
      ok: true,
      agentName,
      agentDisplayName: params.get("display_name"),
      variantId: variantId === "" ? null : variantId,
      configuration: result.configuration,
    };
  }
  return {
    ok: false,
    message: `The address of this page holds no valid ${invalidFieldsText(result.errors)}.`,
  };
}

export function firstSendFailureOf(state: unknown): FirstSendFailure | null {
  if (typeof state !== "object" || state === null) return null;
  const { firstSendFailure } = state as Record<string, unknown>;
  if (typeof firstSendFailure !== "object" || firstSendFailure === null) return null;
  const { draft, code, message } = firstSendFailure as Record<string, unknown>;
  if (typeof draft !== "string" || typeof code !== "string" || typeof message !== "string") {
    return null;
  }
  return { draft, code, message };
}
