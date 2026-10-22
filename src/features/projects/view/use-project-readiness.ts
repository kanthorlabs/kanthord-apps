import { useMemo } from "react";

import { listAllCredentials } from "@/api/resources/credentials";
import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listWorkerBindings, readBindingSet } from "@/api/resources/projects";
import { listWorkerInstances } from "@/api/resources/worker-instances";
import { listAgents, listWorkerRegistrations } from "@/api/resources/workers";
import type {
  AgentSummary,
  BindingSet,
  Credential,
  MissionNodeRecord,
  Project,
  WorkerBindingConfig,
  WorkerBindingRecord,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { settle, type ReadFault } from "@/features/overview/read-overview-snapshot";
import { useResource } from "@/hooks/use-resource";
import { enableAgentsPath } from "@/lib/credential-sections";
import { effectiveInstanceCount } from "@/lib/instance-count";

import { projectTabPath } from "./use-project-tab";

export type ReadinessState = "done" | "open";

export interface ReadinessLink {
  readonly label: string;
  readonly path: string;
}

export interface ReadinessItem {
  readonly key: string;
  readonly title: string;
  readonly state: ReadinessState;
  readonly detail: string;
  readonly names: readonly string[];
  readonly after?: string;
  readonly link: ReadinessLink | null;
}

export interface ProjectReadiness {
  readonly loading: boolean;
  readonly openItems: readonly ReadinessItem[];
  readonly doneItems: readonly ReadinessItem[];
  readonly faults: readonly ReadFault[];
  readonly reload: () => void;
}

interface ReadinessFacts {
  readonly bindingSet: BindingSet | null;
  readonly workerBindings: readonly WorkerBindingRecord[] | null;
  readonly registrations: readonly WorkerRegistrationRecord[] | null;
  readonly instances: readonly WorkerInstanceListItem[] | null;
  readonly agents: readonly AgentSummary[] | null;
  readonly llmCredentials: readonly Credential[] | null;
  readonly nodes: readonly MissionNodeRecord[] | null;
}

interface ReadinessRead {
  readonly facts: ReadinessFacts;
  readonly faults: readonly ReadFault[];
}

interface WorkerEntry {
  readonly name: string;
  readonly config: WorkerBindingConfig;
}

const NO_ITEMS: readonly ReadinessItem[] = [];
const NO_WORKER_BINDING = "The project holds no worker binding.";
const NO_FAULTS: readonly ReadFault[] = [];

async function readReadiness(project: Project): Promise<ReadinessRead> {
  const [bindingSet, workerBindings, registrations, instances, agents, llmCredentials, mission] =
    await Promise.all([
      settle(project, "binding set", () => readBindingSet(project.id), null),
      settle(project, "worker bindings", () => listWorkerBindings(project.id), null),
      settle(project, "worker registrations", () => listWorkerRegistrations(project.id), null),
      settle(project, "worker instances", () => listWorkerInstances(null), null),
      settle(project, "agents", listAgents, null),
      settle(project, "LLM credentials", () => listAllCredentials("llm", "server"), null),
      settle(project, "mission", () => readMission(project.id), null),
    ]);
  const missionId = mission.data?.id ?? null;
  const nodes =
    missionId === null
      ? { data: null, fault: null }
      : await settle(project, "node list", () => listMissionNodes(missionId), null);
  return {
    facts: {
      bindingSet: bindingSet.data,
      workerBindings: workerBindings.data,
      registrations: registrations.data,
      instances: instances.data,
      agents: agents.data,
      llmCredentials: llmCredentials.data,
      nodes: nodes.data,
    },
    faults: [
      bindingSet.fault,
      workerBindings.fault,
      registrations.fault,
      instances.fault,
      agents.fault,
      llmCredentials.fault,
      mission.fault,
      nodes.fault,
    ].flatMap((fault) => (fault === null ? [] : [fault])),
  };
}

function workerEntriesOf(bindingSet: BindingSet | null): readonly WorkerEntry[] {
  return Object.entries(bindingSet?.bindings ?? {}).flatMap(([name, entry]) =>
    entry.kind === "worker" ? [{ name, config: entry.config }] : [],
  );
}

function repositoryNamesOf(bindingSet: BindingSet | null): readonly string[] {
  return Object.entries(bindingSet?.bindings ?? {}).flatMap(([name, entry]) =>
    entry.kind === "repository" ? [name] : [],
  );
}

function hasLiveRegistration(entry: WorkerEntry, facts: ReadinessFacts): boolean {
  const record = facts.workerBindings?.find(
    (binding) => binding.name === entry.name && binding.removed_at === null,
  );
  return (
    record !== undefined &&
    (facts.registrations ?? []).some(
      (registration) =>
        registration.registered &&
        !registration.draining &&
        registration.resource_identity === record.resource_identity,
    )
  );
}

function bindingItems(project: Project, facts: ReadinessFacts): readonly ReadinessItem[] {
  const link = { label: "Open bindings", path: projectTabPath(project.id, "bindings") };
  const repositories = repositoryNamesOf(facts.bindingSet);
  const workers = workerEntriesOf(facts.bindingSet).map((entry) => entry.name);
  return [
    {
      key: "repository_binding",
      title: "Repository binding",
      state: repositories.length > 0 ? "done" : "open",
      detail: repositories.length > 0 ? "Bound:" : "The project holds no repository binding.",
      names: repositories,
      link,
    },
    {
      key: "worker_bindings",
      title: "Worker bindings",
      state: workers.length > 0 ? "done" : "open",
      detail: workers.length > 0 ? "Bound:" : NO_WORKER_BINDING,
      names: workers,
      link,
    },
  ];
}

function listedInstancesOf(entries: readonly WorkerEntry[]): readonly string[] {
  return [
    ...new Set(
      entries.flatMap((entry) =>
        entry.config.placement === "worker" ? (entry.config.worker_instances ?? []) : [],
      ),
    ),
  ];
}

function disconnectedOf(
  listed: readonly string[],
  instances: readonly WorkerInstanceListItem[],
): readonly string[] {
  return listed.filter(
    (name) => !instances.some((instance) => instance.name === name && instance.connection !== null),
  );
}

type InstanceDetail = Pick<ReadinessItem, "detail" | "names" | "after">;

function instanceDetailOf(
  listed: readonly string[],
  instances: readonly WorkerInstanceListItem[] | null,
): InstanceDetail | null {
  if (listed.length === 0) return null;
  if (instances === null) return { detail: "The worker instances were not read.", names: [] };
  const disconnected = disconnectedOf(listed, instances);
  if (disconnected.length === 0) return null;
  return disconnected.length === 1
    ? {
        detail: "Instance",
        names: disconnected,
        after: "is not connected. Start kanthord serve worker with its configuration.",
      }
    : {
        detail: "Instances",
        names: disconnected,
        after: "are not connected. Start kanthord serve worker with the configuration of each.",
      };
}

function registrationItem(project: Project, facts: ReadinessFacts): ReadinessItem {
  const entries = workerEntriesOf(facts.bindingSet);
  const active = entries.filter((entry) => effectiveInstanceCount(entry.config) > 0);
  const lacking = active
    .filter((entry) => !hasLiveRegistration(entry, facts))
    .map((entry) => entry.name);
  const read = facts.workerBindings !== null && facts.registrations !== null;
  const instanceDetail = instanceDetailOf(listedInstancesOf(active), facts.instances);
  const link = {
    label: "Open workers",
    path: `/workers?project=${encodeURIComponent(project.id)}`,
  };
  if (instanceDetail !== null)
    return {
      key: "live_registrations",
      title: "Live registrations",
      state: "open",
      ...instanceDetail,
      link,
    };
  return {
    key: "live_registrations",
    title: "Live registrations",
    state: read && active.length > 0 && lacking.length === 0 ? "done" : "open",
    detail:
      entries.length === 0
        ? NO_WORKER_BINDING
        : active.length === 0
          ? "No worker binding asks for an instance."
          : lacking.length === 0
            ? "Each worker binding runs a live registration."
            : "No live registration:",
    names: active.length === 0 ? [] : lacking,
    link,
  };
}

function agentItem(facts: ReadinessFacts): ReadinessItem {
  const workers = new Set(workerEntriesOf(facts.bindingSet).map((entry) => entry.config.worker));
  const needed = (facts.agents ?? []).filter((agent) =>
    agent.workerNames.some((worker) => workers.has(worker)),
  );
  const disabled = needed
    .filter((agent) => agent.enablement?.state !== "enabled")
    .map((agent) => agent.agentName);
  const [first] = disabled;
  const sheetPath = enableAgentsPath(facts.llmCredentials);
  return {
    key: "enabled_agents",
    title: "Enabled agents",
    state: facts.agents !== null && workers.size > 0 && disabled.length === 0 ? "done" : "open",
    detail:
      workers.size === 0
        ? NO_WORKER_BINDING
        : needed.length === 0
          ? "The worker bindings name no hosted agent."
          : disabled.length === 0
            ? "Enabled:"
            : "Not enabled:",
    names: disabled.length === 0 ? needed.map((agent) => agent.agentName) : disabled,
    link:
      first === undefined
        ? { label: "Open agents", path: "/agents" }
        : sheetPath !== null
          ? { label: "Enable agents", path: sheetPath }
          : { label: `Enable ${first}`, path: `/agents/${encodeURIComponent(first)}#enablement` },
  };
}

function planItem(project: Project, facts: ReadinessFacts): ReadinessItem {
  const count = facts.nodes?.length ?? 0;
  return {
    key: "plan_import",
    title: "Plan import",
    state: count > 0 ? "done" : "open",
    detail:
      count > 0
        ? `The mission holds ${count} ${count === 1 ? "node" : "nodes"}.`
        : "The mission holds no node. Import a plan from the Mission tab.",
    names: [],
    link: { label: "Open mission", path: projectTabPath(project.id, "mission") },
  };
}

function pauseItem(project: Project): ReadinessItem {
  const active = project.paused_at === null;
  return {
    key: "project_active",
    title: "Project active",
    state: active ? "done" : "open",
    detail: active
      ? "The project runs its nodes."
      : "The project is paused. Resume it with the Resume button above.",
    names: [],
    link: null,
  };
}

function readinessItemsOf(project: Project, facts: ReadinessFacts): readonly ReadinessItem[] {
  return [
    ...bindingItems(project, facts),
    registrationItem(project, facts),
    agentItem(facts),
    planItem(project, facts),
    pauseItem(project),
  ];
}

export function useProjectReadiness(project: Project): ProjectReadiness {
  const { data, loading, reload } = useResource(
    () => readReadiness(project),
    [project.id, project.binding_set_version],
  );
  const items = useMemo(
    () => (data === null ? NO_ITEMS : readinessItemsOf(project, data.facts)),
    [project, data],
  );
  const openItems = useMemo(() => items.filter((item) => item.state === "open"), [items]);
  const doneItems = useMemo(() => items.filter((item) => item.state === "done"), [items]);
  return {
    loading: data === null && loading,
    openItems,
    doneItems,
    faults: data?.faults ?? NO_FAULTS,
    reload,
  };
}
