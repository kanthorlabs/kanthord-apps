import { ChoiceField } from "@/components/choice-field";
import type { ConfigurationDraftState } from "@/hooks/use-configuration-draft";
import type { ConfigurationErrors } from "@/lib/workbench-configuration";

interface ConfigurationFieldsProps {
  readonly idPrefix: string;
  readonly agentProviderNames: readonly string[];
  readonly configuration: ConfigurationDraftState;
  readonly errors: ConfigurationErrors;
}

export function ConfigurationFields({
  idPrefix,
  agentProviderNames,
  configuration,
  errors,
}: ConfigurationFieldsProps) {
  const { draft } = configuration;
  return (
    <>
      <ChoiceField
        id={`${idPrefix}-agent-provider`}
        label="Agent Provider"
        value={draft.agentProvider}
        options={agentProviderNames}
        error={errors["agentProvider"]}
        onChange={configuration.selectAgentProvider}
      />
      <ChoiceField
        id={`${idPrefix}-model`}
        label="Model Identifier"
        value={draft.modelIdentifier}
        options={configuration.models}
        error={errors["modelIdentifier"]}
        onChange={configuration.selectModel}
      />
      <ChoiceField
        id={`${idPrefix}-reasoning-effort`}
        label="Reasoning Effort"
        value={draft.reasoningEffort}
        options={configuration.reasoningEfforts}
        error={errors["reasoningEffort"]}
        onChange={configuration.selectReasoningEffort}
      />
    </>
  );
}
