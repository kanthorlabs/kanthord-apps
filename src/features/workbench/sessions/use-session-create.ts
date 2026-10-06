import { useCallback, useState } from "react";

import { createWorkbenchSession } from "@/api/resources/workbench";
import { listAgentProviderModels } from "@/api/resources/workers";
import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { useAgentProviderModels } from "@/hooks/use-agent-provider-models";
import { asApiError } from "@/hooks/use-resource";
import { reasoningEffortOf } from "@/lib/enablement-draft";
import {
  configurationOf,
  draftOf,
  effortAfterModelChange,
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
  type ConfigurationDraft,
  type ConfigurationErrors,
} from "@/lib/workbench-configuration";

export interface SessionCreateState {
  readonly draft: ConfigurationDraft;
  readonly errors: ConfigurationErrors;
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
  readonly submit: () => void;
}

const NO_ERRORS: ConfigurationErrors = {};

export function useSessionCreate(
  agentName: string,
  enablement: AgentEnablement | null,
  onCreated: (session: WorkbenchSession) => void,
): SessionCreateState {
  const [draft, setDraft] = useState<ConfigurationDraft>(() => draftOf(enablement));
  const [errors, setErrors] = useState<ConfigurationErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const providerModels = useAgentProviderModels(agentName, draft.agentProvider);

  const selectAgentProvider = useCallback(
    (value: string | null) => {
      if (value === null || value === draft.agentProvider || switching) return;
      setFailure(null);
      setSwitching(true);
      listAgentProviderModels(agentName, value).then(
        (models) => {
          setSwitching(false);
          setDraft((current) => {
            const modelIdentifier = modelAfterProviderChange(current.modelIdentifier, models);
            return {
              agentProvider: value,
              modelIdentifier,
              reasoningEffort: effortAfterModelChange(
                current.reasoningEffort,
                modelIdentifier,
                models,
              ),
            };
          });
        },
        (cause: unknown) => {
          setSwitching(false);
          setFailure(asApiError(cause).message);
        },
      );
    },
    [agentName, draft.agentProvider, switching],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value === null) return;
      setDraft((current) => ({
        ...current,
        modelIdentifier: value,
        reasoningEffort: effortAfterModelChange(
          current.reasoningEffort,
          value,
          providerModels.models ?? [],
        ),
      }));
    },
    [providerModels.models],
  );

  const selectReasoningEffort = useCallback((value: string | null) => {
    if (value === null) return;
    setDraft((current) => ({ ...current, reasoningEffort: reasoningEffortOf(value) }));
  }, []);

  const submit = useCallback(() => {
    if (submitting || switching) return;
    const result = configurationOf(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setFailure(null);
    setSubmitting(true);
    createWorkbenchSession({ agentName, ...result.configuration }).then(
      (session) => {
        setSubmitting(false);
        onCreated(session);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, switching, draft, agentName, onCreated]);

  return {
    draft,
    errors,
    models: modelOptions(draft.modelIdentifier, providerModels.models),
    reasoningEfforts: effortOptions(
      draft.reasoningEffort,
      draft.modelIdentifier,
      providerModels.models,
    ),
    modelsFailure: providerModels.failure,
    failure,
    submitting,
    selectAgentProvider,
    selectModel,
    selectReasoningEffort,
    submit,
  };
}
