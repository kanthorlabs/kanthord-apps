import { ChoiceField } from "@/components/choice-field";
import { SearchChoiceField } from "@/components/search-choice-field";
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
      <SearchChoiceField
        id={`${idPrefix}-agent-provider`}
        label="Agent Provider"
        value={draft.agentProvider}
        options={agentProviderNames}
        error={errors["agentProvider"]}
        placeholder="Search agent providers"
        emptyText="No agent provider matches."
        onChange={configuration.selectAgentProvider}
      />
      <SearchChoiceField
        id={`${idPrefix}-model`}
        label="Model Identifier"
        value={draft.modelIdentifier}
        options={configuration.models}
        error={errors["modelIdentifier"]}
        placeholder="Search models"
        emptyText="No model matches."
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
