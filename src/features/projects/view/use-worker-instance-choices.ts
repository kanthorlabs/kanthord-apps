import { listWorkerInstances } from "@/api/resources/worker-instances";
import type { WorkerInstanceListItem } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export interface InstanceOption {
  readonly name: string;
  readonly placement: string;
}

export function instanceOptionsOf(
  live: readonly WorkerInstanceListItem[],
  selected: readonly string[],
): readonly InstanceOption[] {
  const listed = live.map((instance) => ({ name: instance.name, placement: instance.placement }));
  const missing = selected
    .filter((name) => !live.some((instance) => instance.name === name))
    .map((name) => ({ name, placement: "Not found" }));
  return [...listed, ...missing];
}

export function instancesRemoved(saved: readonly string[], selected: readonly string[]): boolean {
  return saved.some((name) => !selected.includes(name));
}

const NO_INSTANCES: readonly WorkerInstanceListItem[] = [];

export function useWorkerInstanceChoices(
  workerName: string,
  active: boolean,
): Resource<readonly WorkerInstanceListItem[]> {
  return useResource(
    () =>
      active && workerName !== "" ? listWorkerInstances(workerName) : Promise.resolve(NO_INSTANCES),
    [workerName, active],
  );
}
