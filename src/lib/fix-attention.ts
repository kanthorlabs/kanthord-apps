import type { Credential, NodeState, Project, SchedulerExecutionRecord } from "@/api/types";

import type { AttentionContext, ItemBase, ProjectSnapshot } from "./attention";
import { takerHintOf, uncoveredJobsOf, type TakerHint } from "./claim-takers";
import { endTimeOf } from "./execution-stop";
import { isTerminal } from "./node-state";
import { ulidTime } from "./ulid";

const NO_TAKER_GRACE_MS = 60_000;

interface FixBase extends ItemBase {
  readonly group: "fixes";
  readonly cause: string;
}

export interface ProjectPausedItem extends FixBase {
  readonly kind: "project_paused";
}

export interface NoTakerItem extends FixBase {
  readonly kind: "no_taker";
  readonly state: NodeState;
  readonly jobCount: number;
  readonly hint: TakerHint;
}

export interface AgentInvalidItem extends FixBase {
  readonly kind: "agent_invalid";
  readonly agent: string;
  readonly binding: string;
  readonly issues: readonly string[];
}

export interface CredentialRefusedItem extends FixBase {
  readonly kind: "credential_refused";
  readonly credential: string;
  readonly credentials: readonly string[];
  readonly nodeName: string;
}

export interface RequestRejectedItem extends FixBase {
  readonly kind: "request_rejected";
  readonly agent: string;
  readonly nodeName: string;
}

export type FixAttentionItem =
  ProjectPausedItem | NoTakerItem | AgentInvalidItem | CredentialRefusedItem | RequestRejectedItem;

interface Refusal {
  readonly project: Project;
  readonly nodeName: string;
  readonly endedAt: number;
  readonly credentials: readonly string[];
  readonly agents: readonly string[];
}

function projectPausedOf(snapshot: ProjectSnapshot): readonly FixAttentionItem[] {
  const { project } = snapshot;
  if (project.paused_at === null) return [];
  return [
    {
      id: `project_paused:${project.id}`,
      kind: "project_paused",
      group: "fixes",
      project,
      at: project.paused_at,
      subject: project.name,
      cause: "Project paused",
    },
  ];
}

function noTakerOf(snapshot: ProjectSnapshot, context: AttentionContext): readonly NoTakerItem[] {
  const { project, jobs, instances, bindings } = snapshot;
  const { catalog } = context;
  if (project.paused_at !== null) return [];
  if (jobs === null || instances === null || bindings === null || catalog === null) return [];
  const items: NoTakerItem[] = [];
  for (const [state, stuck] of uncoveredJobsOf(jobs, snapshot.nodes, instances, catalog)) {
    const times = stuck.flatMap((job) => {
      const time = ulidTime(job.job_id);
      return time === null ? [] : [time];
    });
    if (times.length === 0) continue;
    const oldest = Math.min(...times);
    if (context.now - oldest <= NO_TAKER_GRACE_MS) continue;
    items.push({
      id: `no_taker:${project.id}:${state}`,
      kind: "no_taker",
      group: "fixes",
      project,
      at: oldest,
      subject: `Jobs in state ${state}`,
      cause: "No taker",
      state,
      jobCount: stuck.length,
      hint: takerHintOf(
        state,
        bindings.map((entry) => entry.binding),
        catalog,
      ),
    });
  }
  return items;
}

function agentInvalidOf(snapshot: ProjectSnapshot): readonly AgentInvalidItem[] {
  return (snapshot.bindings ?? []).flatMap((entry) =>
    (entry.agents ?? [])
      .filter((view) => !view.valid)
      .map((view) => ({
        id: `agent_invalid:${snapshot.project.id}:${entry.binding.id}:${view.agent}`,
        kind: "agent_invalid" as const,
        group: "fixes" as const,
        project: snapshot.project,
        at: null,
        subject: `${view.agent} in ${entry.binding.name}`,
        cause: "Invalid agent configuration",
        agent: view.agent,
        binding: entry.binding.name,
        issues: view.issues.map((issue) => issue.code),
      })),
  );
}

function latestEndedOf(
  executions: readonly SchedulerExecutionRecord[],
  nodeId: string,
): { readonly execution: SchedulerExecutionRecord; readonly endedAt: number } | null {
  let latest: { readonly execution: SchedulerExecutionRecord; readonly endedAt: number } | null =
    null;
  for (const execution of executions) {
    const endedAt = endTimeOf(execution);
    if (execution.node_id !== nodeId || endedAt === null) continue;
    if (latest === null || endedAt > latest.endedAt) latest = { execution, endedAt };
  }
  return latest;
}

function refusalsOf(
  snapshot: ProjectSnapshot,
  code: "unauthorized" | "bad_request",
): readonly Refusal[] {
  const { executions } = snapshot;
  if (executions === null) return [];
  return snapshot.nodes.flatMap((node): readonly Refusal[] => {
    if (node.kind === "task" || node.retired_at !== null || isTerminal(node.state)) return [];
    const latest = latestEndedOf(executions, node.id);
    const stop = latest?.execution.stop ?? null;
    if (latest === null || stop?.reason !== "provider_failed" || stop.code !== code) return [];
    const selections = latest.execution.agent_selections;
    return [
      {
        project: snapshot.project,
        nodeName: node.content.name,
        endedAt: latest.endedAt,
        credentials: [...new Set(selections.map((selection) => selection.credential))],
        agents: [...new Set(selections.map((selection) => selection.agent_name))],
      },
    ];
  });
}

function oldestBy(
  refusals: readonly Refusal[],
  keysOf: (refusal: Refusal) => readonly string[],
): ReadonlyMap<string, Refusal> {
  const oldest = new Map<string, Refusal>();
  for (const refusal of refusals) {
    for (const key of keysOf(refusal)) {
      const held = oldest.get(key);
      if (held === undefined || refusal.endedAt < held.endedAt) oldest.set(key, refusal);
    }
  }
  return oldest;
}

function isRotatedAfter(
  credentials: readonly Credential[],
  name: string,
  endedAt: number,
): boolean {
  const credential = credentials.find((item) => item.name === name);
  return (
    credential?.revisions.some(
      (revision) => revision.ended_at === null && revision.created_at > endedAt,
    ) ?? false
  );
}

function credentialRefusedOf(
  snapshots: readonly ProjectSnapshot[],
  context: AttentionContext,
): readonly CredentialRefusedItem[] {
  const { credentials } = context;
  if (credentials === null) return [];
  const refusals = snapshots.flatMap((snapshot) => refusalsOf(snapshot, "unauthorized"));
  const items: CredentialRefusedItem[] = [];
  for (const [credential, refusal] of oldestBy(refusals, (entry) => entry.credentials)) {
    if (isRotatedAfter(credentials, credential, refusal.endedAt)) continue;
    items.push({
      id: `credential_refused:${credential}`,
      kind: "credential_refused",
      group: "fixes",
      project: refusal.project,
      at: refusal.endedAt,
      subject: credential,
      cause: "Credential refused",
      credential,
      credentials: refusal.credentials,
      nodeName: refusal.nodeName,
    });
  }
  return items;
}

function requestRejectedOf(snapshots: readonly ProjectSnapshot[]): readonly RequestRejectedItem[] {
  const refusals = snapshots.flatMap((snapshot) => refusalsOf(snapshot, "bad_request"));
  return [...oldestBy(refusals, (entry) => entry.agents)].map(([agent, refusal]) => ({
    id: `request_rejected:${agent}`,
    kind: "request_rejected" as const,
    group: "fixes" as const,
    project: refusal.project,
    at: refusal.endedAt,
    subject: agent,
    cause: "Provider rejected the request",
    agent,
    nodeName: refusal.nodeName,
  }));
}

export function fixItemsOf(
  snapshots: readonly ProjectSnapshot[],
  context: AttentionContext,
): readonly FixAttentionItem[] {
  return [
    ...snapshots.flatMap(projectPausedOf),
    ...snapshots.flatMap((snapshot) => noTakerOf(snapshot, context)),
    ...snapshots.flatMap(agentInvalidOf),
    ...credentialRefusedOf(snapshots, context),
    ...requestRejectedOf(snapshots),
  ];
}

export interface FixTarget {
  readonly path: string;
  readonly label: string;
}

export function fixTargetOf(item: FixAttentionItem): FixTarget {
  const project = `/projects/${encodeURIComponent(item.project.id)}`;
  if (item.kind === "project_paused") return { path: project, label: "Open project" };
  if (item.kind === "no_taker") return { path: `${project}?tab=bindings`, label: "Open bindings" };
  if (item.kind === "credential_refused") {
    return { path: `/llm/${encodeURIComponent(item.credential)}`, label: "Open credential" };
  }
  return { path: `/agents/${encodeURIComponent(item.agent)}`, label: "Open agent" };
}
