import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listCredentials } from "@/api/resources/credentials";
import { putAgentEnablement } from "@/api/resources/workers";
import { asApiError, useResource } from "@/hooks/use-resource";
import {
  EMPTY_ENABLEMENT,
  enablementBodyOf,
  providerKindOf,
  reasoningEffortOf,
  type EnablementDraft,
  type EnablementErrors,
} from "@/lib/enablement-draft";

export interface EnablementCreateState {
  readonly draft: EnablementDraft;
  readonly errors: EnablementErrors;
  readonly credentialNames: readonly string[];
  readonly credentialsError: string | null;
  readonly credentialsMissing: boolean;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly setName: (name: string) => void;
  readonly selectProvider: (value: string | null) => void;
  readonly selectCredential: (value: string | null) => void;
  readonly setModelIdentifier: (modelIdentifier: string) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
  readonly submit: () => void;
}

const NO_ERRORS: EnablementErrors = {};

export function useEnablementCreate(agentName: string, reload: () => void): EnablementCreateState {
  const [draft, setDraft] = useState<EnablementDraft>(EMPTY_ENABLEMENT);
  const [errors, setErrors] = useState<EnablementErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { provider } = draft;
  const credentials = useResource(
    () => (provider === "" ? Promise.resolve([]) : listCredentials(provider)),
    [provider],
  );

  const setName = useCallback((name: string) => setDraft((current) => ({ ...current, name })), []);

  const selectProvider = useCallback(
    (value: string | null) =>
      setDraft((current) => ({ ...current, provider: providerKindOf(value), credential: "" })),
    [],
  );

  const selectCredential = useCallback(
    (value: string | null) => setDraft((current) => ({ ...current, credential: value ?? "" })),
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
    const result = enablementBodyOf(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setFailure(null);
    setSubmitting(true);
    putAgentEnablement(agentName, result.body).then(
      (answer) => {
        setSubmitting(false);
        toast.success(`Enabled ${answer.agentName} at revision ${answer.revision}.`);
        reload();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, draft, agentName, reload]);

  const credentialNames = (credentials.data ?? []).map((credential) => credential.name);

  return {
    draft,
    errors,
    credentialNames,
    credentialsError: credentials.error?.message ?? null,
    credentialsMissing:
      credentials.data !== null && provider !== "" && credentialNames.length === 0,
    failure,
    submitting,
    setName,
    selectProvider,
    selectCredential,
    setModelIdentifier,
    selectReasoningEffort,
    submit,
  };
}
