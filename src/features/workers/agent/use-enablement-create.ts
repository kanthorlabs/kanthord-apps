import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials } from "@/api/resources/credentials";
import { putAgentEnablement } from "@/api/resources/workers";
import type { AgentProviderKind } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { agentProviderCredentials, providerOfCredential } from "@/lib/agent-provider-draft";
import { credentialLabel } from "@/lib/credential-label";
import {
  EMPTY_ENABLEMENT,
  enablementBodyOf,
  reasoningEffortOf,
  type EnablementDraft,
  type EnablementErrors,
} from "@/lib/enablement-draft";

export interface EnablementCreateState {
  readonly draft: EnablementDraft;
  readonly errors: EnablementErrors;
  readonly credentialNames: readonly string[];
  readonly credentialLabelOf: (name: string) => string;
  readonly provider: AgentProviderKind | null;
  readonly credentialsError: string | null;
  readonly credentialsMissing: boolean;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly setName: (name: string) => void;
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
  const credentials = useResource(() => listAllCredentials("llm"), []);
  const usable = agentProviderCredentials(credentials.data ?? []);

  const setName = useCallback((name: string) => setDraft((current) => ({ ...current, name })), []);

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
    const result = enablementBodyOf(draft, usable);
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
  }, [submitting, draft, usable, agentName, reload]);

  return {
    draft,
    errors,
    credentialNames: usable.map((credential) => credential.name),
    credentialLabelOf: (name) => {
      const platform = usable.find((credential) => credential.name === name)?.platform;
      return platform === undefined ? name : credentialLabel(name, platform);
    },
    provider: providerOfCredential(usable, draft.credential),
    credentialsError: credentials.error?.message ?? null,
    credentialsMissing: credentials.data !== null && usable.length === 0,
    failure,
    submitting,
    setName,
    selectCredential,
    setModelIdentifier,
    selectReasoningEffort,
    submit,
  };
}
