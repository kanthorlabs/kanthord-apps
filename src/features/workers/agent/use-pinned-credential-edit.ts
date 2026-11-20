import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials } from "@/api/resources/credentials";
import { putAgentEnablement } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import {
  agentProviderCredentials,
  type AgentProviderErrors,
  credentialOfDefaultProvider,
  pinnedCredentialBodyOf,
} from "@/lib/agent-provider-draft";
import { credentialLabel } from "@/lib/credential-label";

export interface PinnedCredentialEditState {
  readonly credential: string;
  readonly credentialNames: readonly string[];
  readonly credentialLabelOf: (name: string) => string;
  readonly credentialsError: string | null;
  readonly errors: AgentProviderErrors;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly selectCredential: (value: string | null) => void;
  readonly submit: () => void;
}

const NO_ERRORS: AgentProviderErrors = {};

export function usePinnedCredentialEdit(
  agentName: string,
  enablement: AgentEnablement,
  pinnedModelIdentifier: string,
  onSaved: () => void,
): PinnedCredentialEditState {
  const [credential, setCredential] = useState(() => credentialOfDefaultProvider(enablement));
  const [errors, setErrors] = useState<AgentProviderErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const credentials = useResource(() => listAllCredentials("llm"), []);
  const usable = agentProviderCredentials(credentials.data ?? []);

  const selectCredential = useCallback((value: string | null) => {
    setCredential(value ?? "");
    setErrors(NO_ERRORS);
  }, []);

  const submit = useCallback(() => {
    if (submitting || credential === "") return;
    const result = pinnedCredentialBodyOf(enablement, credential, pinnedModelIdentifier, usable);
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
        toast.success(
          `Saved the credential of ${answer.agent_name} at revision ${answer.revision}.`,
        );
        onSaved();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, credential, agentName, enablement, pinnedModelIdentifier, usable, onSaved]);

  return {
    credential,
    credentialNames: usable.map((item) => item.name),
    credentialLabelOf: (name) => {
      const platform = usable.find((item) => item.name === name)?.platform;
      return platform === undefined ? name : credentialLabel(name, platform);
    },
    credentialsError: credentials.error?.message ?? null,
    errors,
    failure,
    submitting,
    selectCredential,
    submit,
  };
}
