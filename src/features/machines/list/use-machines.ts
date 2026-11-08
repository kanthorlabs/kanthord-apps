import { listWorkerMachines } from "@/api/resources/worker-machines";
import type { WorkerMachineListItem } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useMachines(): Resource<readonly WorkerMachineListItem[]> {
  return useResource(() => listWorkerMachines(), []);
}
