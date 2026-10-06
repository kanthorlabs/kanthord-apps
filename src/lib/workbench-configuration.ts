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
  const fallback = enablement?.defaultConfiguration;
  return {
    agentProvider: fallback?.agentProvider ?? "",
    modelIdentifier: fallback?.modelIdentifier ?? "",
    reasoningEffort: fallback?.reasoningEffort ?? "",
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
      agentProvider: draft.agentProvider,
      modelIdentifier,
      reasoningEffort: draft.reasoningEffort,
    },
  };
}

export function modelOptions(
  current: string,
  models: readonly AgentModel[] | null,
): readonly string[] {
  if (models === null) return current === "" ? [] : [current];
  return models.map((model) => model.modelIdentifier);
}

export function effortOptions(
  current: ReasoningEffort | "",
  modelIdentifier: string,
  models: readonly AgentModel[] | null,
): readonly string[] {
  const listed = models?.find((model) => model.modelIdentifier === modelIdentifier);
  if (listed === undefined) return current === "" ? [] : [current];
  return listed.reasoningEfforts;
}

export function modelAfterProviderChange(models: readonly AgentModel[]): string {
  return models[0]?.modelIdentifier ?? "";
}

export function effortAfterModelChange<T extends ReasoningEffort | "">(
  current: T,
  modelIdentifier: string,
  models: readonly AgentModel[],
): T | ReasoningEffort {
  const listed = models.find((model) => model.modelIdentifier === modelIdentifier);
  if (listed === undefined || listed.reasoningEfforts.some((effort) => effort === current)) {
    return current;
  }
  return listed.reasoningEfforts[0] ?? current;
}
