import { useCallback, useState } from "react";

import { createWorkbenchSession } from "@/api/resources/workbench";
import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { reasoningEffortOf } from "@/lib/enablement-draft";
import {
  configurationOf,
  draftOf,
  type ConfigurationDraft,
  type ConfigurationErrors,
} from "@/lib/workbench-configuration";

export interface SessionCreateState {
  readonly draft: ConfigurationDraft;
  readonly errors: ConfigurationErrors;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly setModelIdentifier: (modelIdentifier: string) => void;
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

  const selectAgentProvider = useCallback(
    (value: string | null) => setDraft((current) => ({ ...current, agentProvider: value ?? "" })),
    [],
  );

  const setModelIdentifier = useCallback(
    (modelIdentifier: string) => setDraft((current) => ({ ...current, modelIdentifier })),
    [],
  );

  const selectReasoningEffort = useCallback(
    (value: string | null) =>
      setDraft((current) => ({ ...current, reasoningEffort: reasoningEffortOf(value) })),
    [],
  );

  const submit = useCallback(() => {
    if (submitting) return;
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
  }, [submitting, draft, agentName, onCreated]);

  return {
    draft,
    errors,
    failure,
    submitting,
    selectAgentProvider,
    setModelIdentifier,
    selectReasoningEffort,
    submit,
  };
}
