import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  enableAgentEnablement,
  listAgents,
  listCredentialModels,
  putAgentEnablement,
} from "@/api/resources/workers";
import type {
  AgentEnablementPutBody,
  AgentModel,
  AgentProviderKind,
  AgentSummary,
  Credential,
  ReasoningEffort,
} from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { providerNameOfCredential, providerOfCredential } from "@/lib/agent-provider-draft";
import { enablementEffortOf, reasoningEffortOf } from "@/lib/enablement-draft";
import { returnToOf } from "@/lib/return-to";
import {
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
} from "@/lib/workbench-configuration";

export interface AgentEnableRow {
  readonly agentName: string;
  readonly on: boolean;
  readonly replaces: number | null;
}

export interface AgentEnableOutcome {
  readonly agentName: string;
  readonly message: string;
  readonly ok: boolean;
}

export interface AgentEnableState {
  readonly provider: AgentProviderKind | null;
  readonly providerName: string;
  readonly agentNames: readonly string[];
  readonly agentsError: string | null;
  readonly blocked: string | null;
  readonly open: boolean;
  readonly rows: readonly AgentEnableRow[];
  readonly anyOn: boolean;
  readonly modelIdentifier: string;
  readonly reasoningEffort: ReasoningEffort | "";
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly missing: readonly string[];
  readonly outcomes: readonly AgentEnableOutcome[];
  readonly submitting: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly toggleAgent: (agentName: string, on: boolean) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
  readonly submit: () => void;
}

interface EnableTarget {
  readonly agentName: string;
  readonly body: AgentEnablementPutBody;
}

const NO_OUTCOMES: readonly AgentEnableOutcome[] = [];

function pendingAgents(agents: readonly AgentSummary[]): readonly AgentSummary[] {
  return agents.filter((agent) => agent.enablement?.state !== "enabled");
}

function enableBodyOf(
  agent: AgentSummary,
  name: string,
  provider: AgentProviderKind,
  credential: string,
  modelIdentifier: string,
  reasoningEffort: ReasoningEffort,
): AgentEnablementPutBody {
  return {
    ...(agent.enablement === null ? {} : { expected_revision: agent.enablement.revision }),
    agent_providers: [{ name, provider, credential }],
    default_configuration: {
      agent_provider: name,
      model_identifier: modelIdentifier,
      reasoning_effort: reasoningEffort,
    },
    fallback_configurations: [],
  };
}

async function enableAgent({ agentName, body }: EnableTarget): Promise<AgentEnableOutcome> {
  let saved;
  try {
    saved = await putAgentEnablement(agentName, body);
  } catch (cause) {
    return {
      agentName,
      ok: false,
      message: `${agentName} was not enabled. ${asApiError(cause).message}`,
    };
  }
  if (saved.state === "enabled") {
    return { agentName, ok: true, message: `Enabled ${agentName} at revision ${saved.revision}.` };
  }
  try {
    const enabled = await enableAgentEnablement(agentName, saved.revision);
    return {
      agentName,
      ok: true,
      message: `Enabled ${agentName} at revision ${enabled.revision}.`,
    };
  } catch (cause) {
    return {
      agentName,
      ok: false,
      message: `Saved the configuration of ${agentName} at revision ${saved.revision}, but ${agentName} stays disabled. ${asApiError(cause).message}`,
    };
  }
}

export function useAgentEnable(credential: Credential, reload: () => void): AgentEnableState {
  const [open, setOpen] = useState(false);
  const [switchedOff, setSwitchedOff] = useState<readonly string[]>([]);
  const [modelIdentifier, setModelIdentifier] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | "">("");
  const [models, setModels] = useState<readonly AgentModel[] | null>(null);
  const [modelsFailure, setModelsFailure] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<readonly AgentEnableOutcome[]>(NO_OUTCOMES);
  const [submitting, setSubmitting] = useState(false);
  const agents = useResource(listAgents, []);
  const agentList = agents.data;
  const reloadAgents = agents.reload;
  const navigate = useNavigate();
  const returnTo = returnToOf(useLocation().state);
  const provider = providerOfCredential([credential], credential.name);
  const pending = pendingAgents(agentList ?? []);
  const enablements = (agentList ?? []).flatMap((agent) =>
    agent.enablement === null ? [] : [agent.enablement],
  );
  const providerName = providerNameOfCredential(enablements, credential.name) ?? credential.name;
  const rows = pending.map((agent) => ({
    agentName: agent.agentName,
    on: !switchedOff.includes(agent.agentName),
    replaces: agent.enablement?.revision ?? null,
  }));
  const chosen = pending.filter((agent) => !switchedOff.includes(agent.agentName));

  const start = useCallback(() => {
    setSwitchedOff([]);
    setOutcomes(NO_OUTCOMES);
    setModels(null);
    setModelsFailure(null);
    setModelIdentifier("");
    setReasoningEffort("");
    setOpen(true);
    if (provider === null) return;
    listCredentialModels(provider, credential.name).then(
      (listed) => {
        const first = modelAfterProviderChange(listed);
        setModels(listed);
        setModelIdentifier(first);
        setReasoningEffort(enablementEffortOf("", first, listed));
      },
      (cause: unknown) => setModelsFailure(asApiError(cause).message),
    );
  }, [provider, credential.name]);

  const close = useCallback(() => setOpen(false), []);

  const toggleAgent = useCallback(
    (agentName: string, on: boolean) =>
      setSwitchedOff((current) =>
        on ? current.filter((name) => name !== agentName) : [...current, agentName],
      ),
    [],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value === null) return;
      setModelIdentifier(value);
      setReasoningEffort((current) => enablementEffortOf(current, value, models ?? []));
    },
    [models],
  );

  const selectReasoningEffort = useCallback(
    (value: string | null) => setReasoningEffort(reasoningEffortOf(value)),
    [],
  );

  const missing = [
    ...(modelIdentifier === "" ? ["Model identifier"] : []),
    ...(reasoningEffort === "" ? ["Reasoning effort"] : []),
  ];

  const submit = useCallback(() => {
    if (submitting || provider === null || reasoningEffort === "" || modelIdentifier === "") return;
    const targets = pendingAgents(agentList ?? [])
      .filter((agent) => !switchedOff.includes(agent.agentName))
      .map((agent) => ({
        agentName: agent.agentName,
        body: enableBodyOf(
          agent,
          providerName,
          provider,
          credential.name,
          modelIdentifier,
          reasoningEffort,
        ),
      }));
    if (targets.length === 0) return;
    setOutcomes(NO_OUTCOMES);
    setSubmitting(true);
    void Promise.all(targets.map(enableAgent)).then((results) => {
      setSubmitting(false);
      reloadAgents();
      reload();
      if (results.every((result) => result.ok)) {
        setOpen(false);
        toast.success(results.map((result) => result.message).join(" "));
        if (returnTo !== null) void navigate(returnTo);
        return;
      }
      setOutcomes(results);
    });
  }, [
    submitting,
    provider,
    reasoningEffort,
    modelIdentifier,
    agentList,
    switchedOff,
    providerName,
    credential.name,
    reloadAgents,
    reload,
    returnTo,
    navigate,
  ]);

  return {
    provider,
    providerName,
    agentNames: pending.map((agent) => agent.agentName),
    agentsError: agents.error?.message ?? null,
    blocked:
      provider === null
        ? `An agent cannot use a credential of platform ${credential.platform}.`
        : agents.data !== null && pending.length === 0
          ? "Every agent of the hosted workers is enabled."
          : null,
    open,
    rows,
    anyOn: chosen.length > 0,
    modelIdentifier,
    reasoningEffort,
    models: modelOptions(modelIdentifier, models),
    reasoningEfforts: effortOptions(reasoningEffort, modelIdentifier, models),
    modelsFailure,
    missing,
    outcomes,
    submitting,
    start,
    close,
    toggleAgent,
    selectModel,
    selectReasoningEffort,
    submit,
  };
}
