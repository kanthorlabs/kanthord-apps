import type { WorkerBindingRecord, WorkerInstanceRecord } from "@/api/types";

export interface BindingInstances {
  readonly binding: WorkerBindingRecord;
  readonly expected: number;
  readonly live: number;
  readonly placementGap: boolean;
}

export function bindingInstances(
  bindings: readonly WorkerBindingRecord[],
  instances: readonly WorkerInstanceRecord[],
): readonly BindingInstances[] {
  return bindings.map((binding) => {
    const identity = `worker:kanthord:${binding.name}`;
    const live = instances.filter((instance) => instance.resource_identity === identity).length;
    const expected = binding.config.instance_count;
    return {
      binding,
      expected,
      live,
      placementGap: binding.config.placement !== "server" && live < expected,
    };
  });
}
