import type { BindingSetEntry, MissionPlanEntry } from "@/api/types";

export type BindingChangeKind = "create" | "revise" | "replace" | "disable" | "remove";

const REPOSITORY_ADDRESS = /^git@github\.com:([^/\s:]+)\/([^/\s:]+)\.git$/;

export function isAvailable(entry: BindingSetEntry): boolean {
  return entry.kind === "worker" ? entry.config.instanceCount > 0 : entry.config.available;
}

export function resourceIdentityOf(name: string, entry: BindingSetEntry): string | null {
  if (entry.kind === "worker") return `worker:${name}`;
  if (entry.kind === "repository") {
    const match = REPOSITORY_ADDRESS.exec(entry.config.address);
    return match === null ? null : `repository:github:${match[1]}/${match[2]}`;
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

export function unavailableOf(entry: BindingSetEntry): BindingSetEntry {
  if (entry.kind === "worker") return { ...entry, config: { ...entry.config, instanceCount: 0 } };
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
