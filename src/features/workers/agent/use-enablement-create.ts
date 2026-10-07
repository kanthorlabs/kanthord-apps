import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials } from "@/api/resources/credentials";
import { listCredentialModels, putAgentEnablement } from "@/api/resources/workers";
import type { AgentModel } from "@/api/types";
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
import {
  effortAfterModelChange,
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
} from "@/lib/workbench-configuration";

export interface EnablementCreateState {
  readonly draft: EnablementDraft;
  readonly errors: EnablementErrors;
  readonly credentialNames: readonly string[];
  readonly credentialLabelOf: (name: string) => string;
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly credentialsError: string | null;
  readonly credentialsMissing: boolean;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly setName: (name: string) => void;
  readonly selectCredential: (value: string | null) => void;
  readonly selectModel: (value: string | null) => void;
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
  const [models, setModels] = useState<readonly AgentModel[] | null>(null);
  const [modelsFailure, setModelsFailure] = useState<string | null>(null);

  const setName = useCallback((name: string) => setDraft((current) => ({ ...current, name })), []);

  const selectCredential = useCallback(
    (value: string | null) => {
      const credential = value ?? "";
      setDraft((current) => ({ ...current, credential, modelIdentifier: "" }));
      setModels(null);
      setModelsFailure(null);
      const provider = providerOfCredential(usable, credential);
      if (provider === null) return;
      listCredentialModels(provider, credential).then(
        (listed) => {
          setDraft((current) => {
            if (current.credential !== credential) return current;
            const modelIdentifier = modelAfterProviderChange(listed);
            return {
              ...current,
              modelIdentifier,
              reasoningEffort: effortAfterModelChange(
                current.reasoningEffort,
                modelIdentifier,
                listed,
              ),
            };
          });
          setModels(listed);
        },
        (cause: unknown) => setModelsFailure(asApiError(cause).message),
      );
    },
    [usable],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value === null) return;
      setDraft((current) => ({
        ...current,
        modelIdentifier: value,
        reasoningEffort: effortAfterModelChange(current.reasoningEffort, value, models ?? []),
      }));
    },
    [models],
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
        toast.success(`Enabled ${answer.agent_name} at revision ${answer.revision}.`);
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
    models: modelOptions(draft.modelIdentifier, models),
    reasoningEfforts: effortOptions(draft.reasoningEffort, draft.modelIdentifier, models),
    modelsFailure,
    credentialsError: credentials.error?.message ?? null,
    credentialsMissing: credentials.data !== null && usable.length === 0,
    failure,
    submitting,
    setName,
    selectCredential,
    selectModel,
    selectReasoningEffort,
    submit,
  };
}
