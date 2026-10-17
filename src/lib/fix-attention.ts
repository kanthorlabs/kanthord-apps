import type { Credential, NodeState, Project, SchedulerExecutionRecord, Work } from "@/api/types";

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
  readonly work: Work;
  readonly requires: readonly string[];
  readonly jobCount: number;
  readonly hint: TakerHint;
}

interface SpreadBase extends FixBase {
  readonly count: number;
  readonly projectCount: number;
}

export interface InvalidBinding {
  readonly binding: string;
  readonly project: string;
}

export interface AgentInvalidItem extends SpreadBase {
  readonly kind: "agent_invalid";
  readonly agent: string;
  readonly bindings: readonly InvalidBinding[];
  readonly issues: readonly string[];
}

export interface CredentialRefusedItem extends SpreadBase {
  readonly kind: "credential_refused";
  readonly credential: string;
  readonly credentials: readonly string[];
  readonly nodeName: string;
}

export interface RequestRejectedItem extends SpreadBase {
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
  const workerBindings = bindings.map((entry) => entry.binding);
  const stuckGroups = uncoveredJobsOf(jobs, snapshot.nodes, instances, workerBindings, catalog);
  for (const { facts, jobs: stuck } of stuckGroups) {
    const [oldest] = stuck
      .flatMap((job) => {
        const time = ulidTime(job.job_id);
        return time === null ? [] : [time];
      })
      .sort((left, right) => left - right);
    if (oldest === undefined) continue;
    if (context.now - oldest <= NO_TAKER_GRACE_MS) continue;
    const { state, work, requires } = facts;
    items.push({
      id: `no_taker:${project.id}:${state}:${work}:${requires.join(",")}`,
      kind: "no_taker",
      group: "fixes",
      project,
      at: oldest,
      subject: `${work === "implement" ? "Implement" : "Examine"} jobs in state ${state}`,
      cause: "No taker",
      state,
      work,
      requires,
      jobCount: stuck.length,
      hint: takerHintOf(facts, workerBindings, catalog),
    });
  }
  return items;
}

interface InvalidGroup {
  readonly project: Project;
  readonly agent: string;
  readonly issues: readonly string[];
  readonly bindings: InvalidBinding[];
  readonly projectIds: Set<string>;
}

interface InvalidView {
  readonly project: Project;
  readonly binding: string;
  readonly agent: string;
  readonly issues: readonly string[];
}

function invalidViewsOf(snapshots: readonly ProjectSnapshot[]): readonly InvalidView[] {
  return snapshots.flatMap((snapshot) =>
    (snapshot.bindings ?? []).flatMap((entry) =>
      (entry.agents ?? [])
        .filter((view) => !view.valid)
        .map((view) => ({
          project: snapshot.project,
          binding: entry.binding.name,
          agent: view.agent,
          issues: [...new Set(view.issues.map((issue) => issue.code))].sort(),
        })),
    ),
  );
}

function agentInvalidOf(snapshots: readonly ProjectSnapshot[]): readonly AgentInvalidItem[] {
  const groups = new Map<string, InvalidGroup>();
  for (const view of invalidViewsOf(snapshots)) {
    const key = `${view.agent}:${view.issues.join(",")}`;
    const group = groups.get(key) ?? {
      project: view.project,
      agent: view.agent,
      issues: view.issues,
      bindings: [],
      projectIds: new Set<string>(),
    };
    group.bindings.push({ binding: view.binding, project: view.project.name });
    group.projectIds.add(view.project.id);
    groups.set(key, group);
  }
  return [...groups].map(([key, group]) => ({
    id: `agent_invalid:${key}`,
    kind: "agent_invalid" as const,
    group: "fixes" as const,
    project: group.project,
    at: null,
    subject: group.agent,
    cause: "Invalid agent configuration",
    agent: group.agent,
    bindings: group.bindings,
    issues: group.issues,
    count: group.bindings.length,
    projectCount: group.projectIds.size,
  }));
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
    if (node.retired_at !== null || isTerminal(node.state)) return [];
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

interface RefusalGroup {
  readonly oldest: Refusal;
  readonly count: number;
  readonly projectCount: number;
}

function groupBy(
  refusals: readonly Refusal[],
  keysOf: (refusal: Refusal) => readonly string[],
): ReadonlyMap<string, RefusalGroup> {
  const members = new Map<string, Refusal[]>();
  for (const refusal of refusals) {
    for (const key of keysOf(refusal)) members.set(key, [...(members.get(key) ?? []), refusal]);
  }
  return new Map(
    [...members].map(([key, group]) => [
      key,
      {
        oldest: group.reduce((held, refusal) => (refusal.endedAt < held.endedAt ? refusal : held)),
        count: group.length,
        projectCount: new Set(group.map((refusal) => refusal.project.id)).size,
      },
    ]),
  );
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
  const unrotatedOf = (refusal: Refusal) =>
    refusal.credentials.filter((name) => !isRotatedAfter(credentials, name, refusal.endedAt));
  for (const [credential, { oldest: refusal, count, projectCount }] of groupBy(
    refusals,
    unrotatedOf,
  )) {
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
      count,
      projectCount,
    });
  }
  return items;
}

function requestRejectedOf(snapshots: readonly ProjectSnapshot[]): readonly RequestRejectedItem[] {
  const refusals = snapshots.flatMap((snapshot) => refusalsOf(snapshot, "bad_request"));
  return [...groupBy(refusals, (entry) => entry.agents)].map(
    ([agent, { oldest: refusal, count, projectCount }]) => ({
      id: `request_rejected:${agent}`,
      kind: "request_rejected" as const,
      group: "fixes" as const,
      project: refusal.project,
      at: refusal.endedAt,
      subject: agent,
      cause: "Provider rejected the request",
      agent,
      nodeName: refusal.nodeName,
      count,
      projectCount,
    }),
  );
}

export function fixItemsOf(
  snapshots: readonly ProjectSnapshot[],
  context: AttentionContext,
): readonly FixAttentionItem[] {
  return [
    ...snapshots.flatMap(projectPausedOf),
    ...snapshots.flatMap((snapshot) => noTakerOf(snapshot, context)),
    ...agentInvalidOf(snapshots),
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

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function spreadTextOf(item: FixAttentionItem): string | null {
  if (item.kind === "project_paused" || item.kind === "no_taker") return null;
  if (item.count === 1 && item.projectCount === 1) return null;
  const noun = item.kind === "agent_invalid" ? "binding" : "node";
  return `${plural(item.count, noun)} in ${plural(item.projectCount, "project")}`;
}
