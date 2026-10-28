import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { listAllCredentials } from "@/api/resources/credentials";
import { addAgentProvider, listAgentEnablements } from "@/api/resources/workers";
import type { AgentEnablement, AgentProviderKind } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { credentialLabel } from "@/lib/credential-label";
import {
  agentProviderBodyOf,
  type AgentProviderDraft,
  type AgentProviderErrors,
  EMPTY_AGENT_PROVIDER,
  missingAgentProviderFields,
  nameAfterCredentialPick,
  providerNameOfCredential,
  providerOfCredential,
  unusedProviderCredentials,
} from "@/lib/agent-provider-draft";

export interface AgentProviderAddState {
  readonly open: boolean;
  readonly draft: AgentProviderDraft;
  readonly errors: AgentProviderErrors;
  readonly credentialNames: readonly string[];
  readonly credentialLabelOf: (name: string) => string;
  readonly credentialsError: string | null;
  readonly credentialsExhausted: boolean;
  readonly provider: AgentProviderKind | null;
  readonly missing: readonly string[];
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly setName: (name: string) => void;
  readonly selectCredential: (value: string | null) => void;
  readonly submit: () => void;
}

const NO_ERRORS: AgentProviderErrors = {};

export function useAgentProviderAdd(
  agentName: string,
  enablement: AgentEnablement,
  reload: () => void,
): AgentProviderAddState {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AgentProviderDraft>(EMPTY_AGENT_PROVIDER);
  const [errors, setErrors] = useState<AgentProviderErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const credentials = useResource(
    () => (open ? listAllCredentials("llm") : Promise.resolve([])),
    [open],
  );
  const usable = unusedProviderCredentials(credentials.data ?? [], enablement);
  const prefilledName = useRef<string | null>(null);
  const enablements = useResource(
    () => (open ? listAgentEnablements() : Promise.resolve([])),
    [open],
  );

  const start = useCallback(() => {
    prefilledName.current = null;
    setDraft(EMPTY_AGENT_PROVIDER);
    setErrors(NO_ERRORS);
    setFailure(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const setName = useCallback((name: string) => setDraft((current) => ({ ...current, name })), []);

  const selectCredential = useCallback(
    (value: string | null) => {
      const credential = value ?? "";
      const knownName = providerNameOfCredential(
        enablements.data ?? [],
        credential,
        enablement.agent_providers.map((provider) => provider.name),
      );
      const previousPrefill = prefilledName.current;
      prefilledName.current = knownName;
      setDraft((current) => ({
        ...current,
        credential,
        name: nameAfterCredentialPick(current.name, previousPrefill, knownName),
      }));
    },
    [enablements.data, enablement.agent_providers],
  );

  const submit = useCallback(() => {
    if (submitting) return;
    const result = agentProviderBodyOf(draft, enablement, usable);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setFailure(null);
    setSubmitting(true);
    addAgentProvider(agentName, result.body).then(
      (answer) => {
        setSubmitting(false);
        setOpen(false);
        toast.success(
          `Added ${result.body.name} to ${answer.agent_name} at revision ${answer.revision}.`,
        );
        reload();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, draft, enablement, usable, agentName, reload]);

  return {
    open,
    draft,
    errors,
    credentialNames: usable.map((credential) => credential.name),
    credentialLabelOf: (name) => {
      const platform = usable.find((credential) => credential.name === name)?.platform;
      return platform === undefined ? name : credentialLabel(name, platform);
    },
    credentialsError: credentials.error?.message ?? null,
    credentialsExhausted: credentials.data !== null && open && usable.length === 0,
    provider: providerOfCredential(usable, draft.credential),
    missing: missingAgentProviderFields(draft),
    failure,
    submitting,
    start,
    close,
    setName,
    selectCredential,
    submit,
  };
}
