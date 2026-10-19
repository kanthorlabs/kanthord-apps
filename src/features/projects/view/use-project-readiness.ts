import { useMemo } from "react";

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listWorkerBindings, readBindingSet } from "@/api/resources/projects";
import { listAgents, listWorkerInstances } from "@/api/resources/workers";
import type {
  AgentSummary,
  BindingSet,
  MissionNodeRecord,
  Project,
  WorkerBindingConfig,
  WorkerBindingRecord,
  WorkerInstanceRecord,
} from "@/api/types";
import { settle, type ReadFault } from "@/features/overview/read-overview-snapshot";
import { useResource } from "@/hooks/use-resource";

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
  readonly link: ReadinessLink | null;
}

export interface ProjectReadiness {
  readonly loading: boolean;
  readonly items: readonly ReadinessItem[];
  readonly faults: readonly ReadFault[];
  readonly reload: () => void;
}

interface ReadinessFacts {
  readonly bindingSet: BindingSet | null;
  readonly workerBindings: readonly WorkerBindingRecord[] | null;
  readonly instances: readonly WorkerInstanceRecord[] | null;
  readonly agents: readonly AgentSummary[] | null;
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
  const [bindingSet, workerBindings, instances, agents, mission] = await Promise.all([
    settle(project, "binding set", () => readBindingSet(project.id), null),
    settle(project, "worker bindings", () => listWorkerBindings(project.id), null),
    settle(project, "worker instances", () => listWorkerInstances(project.id), null),
    settle(project, "agents", listAgents, null),
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
      instances: instances.data,
      agents: agents.data,
      nodes: nodes.data,
    },
    faults: [
      bindingSet.fault,
      workerBindings.fault,
      instances.fault,
      agents.fault,
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

function hasLiveInstance(entry: WorkerEntry, facts: ReadinessFacts): boolean {
  const record = facts.workerBindings?.find(
    (binding) => binding.name === entry.name && binding.removed_at === null,
  );
  return (
    record !== undefined &&
    (facts.instances ?? []).some(
      (instance) =>
        instance.registered &&
        !instance.draining &&
        instance.resource_identity === record.resource_identity,
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

function instanceItem(project: Project, facts: ReadinessFacts): ReadinessItem {
  const entries = workerEntriesOf(facts.bindingSet);
  const active = entries.filter((entry) => entry.config.instance_count > 0);
  const lacking = active
    .filter((entry) => !hasLiveInstance(entry, facts))
    .map((entry) => entry.name);
  const read = facts.workerBindings !== null && facts.instances !== null;
  return {
    key: "live_instances",
    title: "Live instances",
    state: read && active.length > 0 && lacking.length === 0 ? "done" : "open",
    detail:
      entries.length === 0
        ? NO_WORKER_BINDING
        : active.length === 0
          ? "No worker binding asks for an instance."
          : lacking.length === 0
            ? "Each worker binding runs a live instance."
            : "No live instance:",
    names: active.length === 0 ? [] : lacking,
    link: { label: "Open workers", path: `/workers?project=${encodeURIComponent(project.id)}` },
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
    instanceItem(project, facts),
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
  return { loading: data === null && loading, items, faults: data?.faults ?? NO_FAULTS, reload };
}
