import type {
  AgentEnablement,
  AgentModel,
  ReasoningEffort,
  WorkbenchConfiguration,
} from "@/api/types";

export interface ConfigurationDraft {
  readonly agentProvider: string;
  readonly modelIdentifier: string;
  readonly reasoningEffort: ReasoningEffort | "";
}

export type ConfigurationErrors = Readonly<Record<string, string>>;

export type ConfigurationResult =
  | { readonly ok: true; readonly configuration: WorkbenchConfiguration }
  | { readonly ok: false; readonly errors: ConfigurationErrors };

const REQUIRED = "Enter a value.";
const UNCHOSEN = "Choose a value.";

export function draftOf(enablement: AgentEnablement | null): ConfigurationDraft {
  const fallback = enablement?.default_configuration;
  return {
    agentProvider: fallback?.agent_provider ?? "",
    modelIdentifier: fallback?.model_identifier ?? "",
    reasoningEffort: fallback?.reasoning_effort ?? "",
  };
}

export function configurationOf(draft: ConfigurationDraft): ConfigurationResult {
  const modelIdentifier = draft.modelIdentifier.trim();
  const errors: Record<string, string> = {};
  if (draft.agentProvider === "") errors["agentProvider"] = UNCHOSEN;
  if (modelIdentifier === "") errors["modelIdentifier"] = REQUIRED;
  if (draft.reasoningEffort === "") errors["reasoningEffort"] = UNCHOSEN;
  if (draft.reasoningEffort === "" || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    configuration: {
      agent_provider: draft.agentProvider,
      model_identifier: modelIdentifier,
      reasoning_effort: draft.reasoningEffort,
    },
  };
}

export function modelOptions(
  current: string,
  models: readonly AgentModel[] | null,
): readonly string[] {
  if (models === null) return current === "" ? [] : [current];
  return models.map((model) => model.model_identifier);
}

export function effortOptions(
  current: ReasoningEffort | "",
  modelIdentifier: string,
  models: readonly AgentModel[] | null,
): readonly string[] {
  const listed = models?.find((model) => model.model_identifier === modelIdentifier);
  if (listed === undefined) return current === "" ? [] : [current];
  return listed.reasoning_efforts;
}

export function modelAfterProviderChange(models: readonly AgentModel[]): string {
  return models[0]?.model_identifier ?? "";
}

export function effortAfterModelChange<T extends ReasoningEffort | "">(
  current: T,
  modelIdentifier: string,
  models: readonly AgentModel[],
): T | ReasoningEffort {
  const listed = models.find((model) => model.model_identifier === modelIdentifier);
  if (listed === undefined || listed.reasoning_efforts.some((effort) => effort === current)) {
    return current;
  }
  return listed.reasoning_efforts[0] ?? current;
}
