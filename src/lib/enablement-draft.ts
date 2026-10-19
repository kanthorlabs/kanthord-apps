import type { AgentEnablementPutBody, AgentModel, Credential, ReasoningEffort } from "@/api/types";
import { providerOfCredential } from "./agent-provider-draft";
import { REASONING_EFFORTS } from "./binding-draft";

export interface EnablementDraft {
  readonly name: string;
  readonly credential: string;
  readonly modelIdentifier: string;
  readonly reasoningEffort: ReasoningEffort | "";
}

export type EnablementErrors = Readonly<Record<string, string>>;

export type EnablementResult =
  | { readonly ok: true; readonly body: AgentEnablementPutBody }
  | { readonly ok: false; readonly errors: EnablementErrors };

export const EMPTY_ENABLEMENT: EnablementDraft = {
  name: "",
  credential: "",
  modelIdentifier: "",
  reasoningEffort: "",
};

const REQUIRED = "Enter a value.";
const UNCHOSEN = "Choose a value.";

export function reasoningEffortOf(value: string | null): ReasoningEffort | "" {
  return REASONING_EFFORTS.find((effort) => effort === value) ?? "";
}

const DEFAULT_EFFORT: ReasoningEffort = "medium";

export function enablementEffortOf(
  current: ReasoningEffort | "",
  modelIdentifier: string,
  models: readonly AgentModel[],
): ReasoningEffort | "" {
  const efforts = models.find(
    (model) => model.model_identifier === modelIdentifier,
  )?.reasoning_efforts;
  if (efforts === undefined) return "";
  if (current !== "" && efforts.includes(current)) return current;
  return efforts.includes(DEFAULT_EFFORT) ? DEFAULT_EFFORT : "";
}

export function enablementBodyOf(
  draft: EnablementDraft,
  credentials: readonly Credential[],
): EnablementResult {
  const name = draft.name.trim();
  const provider = providerOfCredential(credentials, draft.credential);
  const modelIdentifier = draft.modelIdentifier.trim();
  const errors: Record<string, string> = {};
  if (name === "") errors["name"] = REQUIRED;
  if (provider === null) errors["credential"] = UNCHOSEN;
  if (modelIdentifier === "") errors["modelIdentifier"] = REQUIRED;
  if (draft.reasoningEffort === "") errors["reasoningEffort"] = UNCHOSEN;
  if (provider === null || draft.reasoningEffort === "" || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      agent_providers: [{ name, provider, credential: draft.credential }],
      default_configuration: {
        agent_provider: name,
        model_identifier: modelIdentifier,
        reasoning_effort: draft.reasoningEffort,
      },
      fallback_configurations: [],
    },
  };
}
