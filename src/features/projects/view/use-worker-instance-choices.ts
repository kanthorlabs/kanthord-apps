import { listWorkerInstances } from "@/api/resources/worker-instances";
import type { WorkerInstanceListItem } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface InstanceOption {
  readonly name: string;
  readonly state: string;
}

export function instanceOptionsOf(
  live: readonly WorkerInstanceListItem[],
  selected: readonly string[],
): readonly InstanceOption[] {
  const listed = live.map((instance) => ({
    name: instance.name,
    state: instance.connection === null ? "Not connected" : "Connected",
  }));
  const missing = selected
    .filter((name) => !live.some((instance) => instance.name === name))
    .map((name) => ({ name, state: "Not found" }));
  return [...listed, ...missing];
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
