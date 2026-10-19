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
import { useUnhealthyGuard } from "@/hooks/use-unhealthy-guard";
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

export type AgentEnableResult = "enabled" | "saved" | "refused";

export interface AgentEnableOutcome {
  readonly agentName: string;
  readonly result: AgentEnableResult;
  readonly revision: number | null;
  readonly reason: string | null;
}

export interface AgentEnableState {
  readonly provider: AgentProviderKind | null;
  readonly providerName: string;
  readonly agentNames: readonly string[];
  readonly agentsError: string | null;
  readonly blocked: string | null;
  readonly open: boolean;
  readonly rows: readonly AgentEnableRow[];
  readonly chosenNames: readonly string[];
  readonly modelIdentifier: string;
  readonly reasoningEffort: ReasoningEffort | "";
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly missing: readonly string[];
  readonly outcomes: readonly AgentEnableOutcome[];
  readonly submitting: boolean;
  readonly unhealthyCredential: string | null;
  readonly unhealthyHint: string | null;
  readonly start: () => void;
  readonly close: () => void;
  readonly toggleAgent: (agentName: string, on: boolean) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
  readonly submit: () => void;
  readonly confirmUnhealthy: () => void;
  readonly cancelUnhealthy: () => void;
}

interface EnableTarget {
  readonly agentName: string;
  readonly body: AgentEnablementPutBody;
  readonly savedRevision: number | null;
}

const NO_OUTCOMES: readonly AgentEnableOutcome[] = [];

const EMPTY_AGENTS = "No hosted worker declares an agent.";
const ALL_ENABLED = "Every agent of the hosted workers is enabled.";

function pendingAgents(agents: readonly AgentSummary[]): readonly AgentSummary[] {
  return agents.filter((agent) => agent.enablement?.state !== "enabled");
}

type SwitchOverrides = Readonly<Record<string, boolean>>;

const NO_SWITCHES: SwitchOverrides = {};

function isSwitchedOn(agent: AgentSummary, switches: SwitchOverrides): boolean {
  return switches[agent.agentName] ?? agent.enablement === null;
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

function outcomeOf(
  agentName: string,
  result: AgentEnableResult,
  revision: number | null,
  reason: string | null = null,
): AgentEnableOutcome {
  return { agentName, result, revision, reason };
}

async function enableSaved(agentName: string, savedRevision: number): Promise<AgentEnableOutcome> {
  try {
    const enabled = await enableAgentEnablement(agentName, savedRevision);
    return outcomeOf(agentName, "enabled", enabled.revision);
  } catch (cause) {
    return outcomeOf(agentName, "saved", savedRevision, asApiError(cause).message);
  }
}

async function enableAgent({
  agentName,
  body,
  savedRevision,
}: EnableTarget): Promise<AgentEnableOutcome> {
  if (savedRevision !== null) return enableSaved(agentName, savedRevision);
  let saved;
  try {
    saved = await putAgentEnablement(agentName, body);
  } catch (cause) {
    return outcomeOf(agentName, "refused", null, asApiError(cause).message);
  }
  if (saved.state === "enabled") return outcomeOf(agentName, "enabled", saved.revision);
  return enableSaved(agentName, saved.revision);
}

function blockOf(
  provider: AgentProviderKind | null,
  platform: string,
  agents: readonly AgentSummary[] | null,
): string | null {
  if (provider === null) return `An agent cannot use a credential of platform ${platform}.`;
  if (agents === null) return null;
  if (agents.length === 0) return EMPTY_AGENTS;
  return pendingAgents(agents).length === 0 ? ALL_ENABLED : null;
}

function successMessage(outcomes: readonly AgentEnableOutcome[]): string {
  return outcomes
    .map((outcome) => `Enabled ${outcome.agentName} at revision ${outcome.revision}.`)
    .join(" ");
}

export function useAgentEnable(credential: Credential, reload: () => void): AgentEnableState {
  const [open, setOpen] = useState(false);
  const [switches, setSwitches] = useState<SwitchOverrides>(NO_SWITCHES);
  const [modelIdentifier, setModelIdentifier] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | "">("");
  const [models, setModels] = useState<readonly AgentModel[] | null>(null);
  const [modelsFailure, setModelsFailure] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<readonly AgentEnableOutcome[]>(NO_OUTCOMES);
  const [submitting, setSubmitting] = useState(false);
  const agents = useResource(listAgents, []);
  const guard = useUnhealthyGuard();
  const checkCredential = guard.check;
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
    on: isSwitchedOn(agent, switches),
    replaces: agent.enablement?.revision ?? null,
  }));
  const chosen = pending.filter((agent) => isSwitchedOn(agent, switches));

  const start = useCallback(() => {
    setSwitches(NO_SWITCHES);
    setOutcomes(NO_OUTCOMES);
    setModels(null);
    setModelsFailure(null);
    setModelIdentifier("");
    setReasoningEffort("");
    setOpen(true);
    checkCredential(credential.name);
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
  }, [provider, credential.name, checkCredential]);

  const close = useCallback(() => setOpen(false), []);

  const toggleAgent = useCallback(
    (agentName: string, on: boolean) => setSwitches((current) => ({ ...current, [agentName]: on })),
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
    const enabledBefore = outcomes.filter((outcome) => outcome.result === "enabled");
    const targets = pendingAgents(agentList ?? [])
      .filter((agent) => isSwitchedOn(agent, switches))
      .filter((agent) => !enabledBefore.some((outcome) => outcome.agentName === agent.agentName))
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
        savedRevision:
          outcomes.find(
            (outcome) => outcome.agentName === agent.agentName && outcome.result === "saved",
          )?.revision ?? null,
      }));
    if (targets.length === 0) return;
    setSubmitting(true);
    void Promise.all(targets.map(enableAgent)).then((results) => {
      const all = [...enabledBefore, ...results];
      setSubmitting(false);
      reloadAgents();
      reload();
      if (all.every((outcome) => outcome.result === "enabled")) {
        setOutcomes(NO_OUTCOMES);
        setOpen(false);
        toast.success(successMessage(all));
        if (returnTo !== null) void navigate(returnTo);
        return;
      }
      setOutcomes(all);
    });
  }, [
    outcomes,
    submitting,
    provider,
    reasoningEffort,
    modelIdentifier,
    agentList,
    switches,
    providerName,
    credential.name,
    reloadAgents,
    reload,
    returnTo,
    navigate,
  ]);

  const runGuard = guard.run;
  const ready = missing.length === 0 && chosen.length > 0;
  const guardedSubmit = useCallback(() => {
    if (ready) runGuard(credential.name, submit);
  }, [ready, runGuard, credential.name, submit]);

  return {
    provider,
    providerName,
    agentNames: pending.map((agent) => agent.agentName),
    agentsError: agents.error?.message ?? null,
    blocked: blockOf(provider, credential.platform, agentList),
    open,
    rows,
    chosenNames: chosen.map((agent) => agent.agentName),
    modelIdentifier,
    reasoningEffort,
    models: modelOptions(modelIdentifier, models),
    reasoningEfforts: effortOptions(reasoningEffort, modelIdentifier, models),
    modelsFailure,
    missing,
    outcomes,
    submitting,
    unhealthyCredential: guard.credential,
    unhealthyHint: guard.hint,
    start,
    close,
    toggleAgent,
    selectModel,
    selectReasoningEffort,
    submit: guardedSubmit,
    confirmUnhealthy: guard.confirm,
    cancelUnhealthy: guard.cancel,
  };
}
