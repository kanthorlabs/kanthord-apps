import type { BindingSetEntry, MissionPlanEntry, WorkerBindingConfig } from "@/api/types";
import { effectiveInstanceCount } from "./instance-count";

export type BindingChangeKind = "create" | "revise" | "replace" | "disable" | "remove";

const REPOSITORY_ADDRESS = /^git@([A-Za-z0-9][A-Za-z0-9.-]*):([^/\s:]+)\/([^/\s:]+)\.git(?![\s\S])/;

export function isAvailable(entry: BindingSetEntry): boolean {
  return entry.kind === "worker"
    ? effectiveInstanceCount(entry.config) > 0
    : entry.config.available;
}

export function resourceIdentityOf(name: string, entry: BindingSetEntry): string | null {
  if (entry.kind === "worker") return `worker:${name}`;
  if (entry.kind === "repository") {
    const match = REPOSITORY_ADDRESS.exec(entry.config.address);
    return match === null ? null : `repository:github:${match[2]}/${match[3]}`;
  }
  try {
    return `storage:s3:${new URL(entry.config.endpoint).host}/${entry.config.bucket}`;
  } catch {
    return null;
  }
}

export function classifyChange(
  name: string,
  before: BindingSetEntry | undefined,
  after: BindingSetEntry | null,
): BindingChangeKind {
  if (before === undefined) return "create";
  if (after === null) return "remove";
  if (resourceIdentityOf(name, before) !== resourceIdentityOf(name, after)) return "replace";
  if (isAvailable(before) && !isAvailable(after)) return "disable";
  return "revise";
}

export function isGuarded(kind: BindingChangeKind): boolean {
  return kind === "replace" || kind === "disable" || kind === "remove";
}

function unavailableWorkerOf(config: WorkerBindingConfig): WorkerBindingConfig {
  return "worker_instances" in config
    ? { ...config, worker_instances: [] }
    : { ...config, instance_count: 0 };
}

function listedInstancesOf(entry: BindingSetEntry | undefined): readonly string[] {
  return entry?.kind === "worker" && "worker_instances" in entry.config
    ? entry.config.worker_instances
    : [];
}

function instanceSentence(verb: string, names: readonly string[]): readonly string[] {
  if (names.length === 0) return [];
  return [`${verb} ${names.length === 1 ? "instance" : "instances"} ${names.join(", ")}.`];
}

export function instanceChangeSummaryOf(
  before: BindingSetEntry | undefined,
  after: BindingSetEntry,
): string {
  const previous = listedInstancesOf(before);
  const next = listedInstancesOf(after);
  return [
    ...instanceSentence(
      "Adds",
      next.filter((name) => !previous.includes(name)),
    ),
    ...instanceSentence(
      "Removes",
      previous.filter((name) => !next.includes(name)),
    ),
  ].join(" ");
}

export function unavailableOf(entry: BindingSetEntry): BindingSetEntry {
  if (entry.kind === "worker") return { ...entry, config: unavailableWorkerOf(entry.config) };
  if (entry.kind === "repository") {
    return { ...entry, config: { ...entry.config, available: false } };
  }
  return { ...entry, config: { ...entry.config, available: false } };
}

export function nextBindings(
  current: Readonly<Record<string, BindingSetEntry>>,
  name: string,
  entry: BindingSetEntry | null,
): Readonly<Record<string, BindingSetEntry>> {
  const next = { ...current };
  if (entry === null) delete next[name];
  else next[name] = entry;
  return next;
}

export function nodesNaming(
  entries: readonly MissionPlanEntry[],
  name: string,
): readonly MissionPlanEntry[] {
  return entries.filter((entry) => entry.bindings.includes(name));
}
