import {
  AGENT_PROVIDER_KINDS,
  type AgentEnablementPutBody,
  type AgentProviderKind,
  type ReasoningEffort,
} from "@/api/types";
import { REASONING_EFFORTS } from "./binding-draft";

export interface EnablementDraft {
  readonly name: string;
  readonly provider: AgentProviderKind | "";
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
  provider: "",
  credential: "",
  modelIdentifier: "",
  reasoningEffort: "",
};

const REQUIRED = "Enter a value.";
const UNCHOSEN = "Choose a value.";

export function providerKindOf(value: string | null): AgentProviderKind | "" {
  return AGENT_PROVIDER_KINDS.find((kind) => kind === value) ?? "";
}

export function reasoningEffortOf(value: string | null): ReasoningEffort | "" {
  return REASONING_EFFORTS.find((effort) => effort === value) ?? "";
}

export function enablementBodyOf(draft: EnablementDraft): EnablementResult {
  const name = draft.name.trim();
  const modelIdentifier = draft.modelIdentifier.trim();
  const errors: Record<string, string> = {};
  if (name === "") errors["name"] = REQUIRED;
  if (draft.provider === "") errors["provider"] = UNCHOSEN;
  if (draft.credential === "") errors["credential"] = UNCHOSEN;
  if (modelIdentifier === "") errors["modelIdentifier"] = REQUIRED;
  if (draft.reasoningEffort === "") errors["reasoningEffort"] = UNCHOSEN;
  if (draft.provider === "" || draft.reasoningEffort === "" || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      agentProviders: [{ name, provider: draft.provider, credential: draft.credential }],
      defaultConfiguration: {
        agentProvider: name,
        modelIdentifier,
        reasoningEffort: draft.reasoningEffort,
      },
    },
  };
}
