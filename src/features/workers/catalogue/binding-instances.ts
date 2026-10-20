import type { WorkerBindingRecord, WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";

export type BindingGap = "none" | "server" | "worker";

export interface BindingInstances {
  readonly binding: WorkerBindingRecord;
  readonly expected: number;
  readonly live: number;
  readonly missing: number;
  readonly shortfall: boolean;
  readonly disabled: boolean;
  readonly placement: "server" | "worker" | null;
  readonly gap: BindingGap;
}

export function bindingInstances(
  bindings: readonly WorkerBindingRecord[],
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): readonly BindingInstances[] {
  return bindings.map((binding) => {
    const live = instances.filter(
      (instance) =>
        instance.project_id === binding.project_id &&
        instance.resource_identity === binding.resource_identity,
    ).length;
    const expected = binding.config.instance_count;
    const missing = Math.max(expected - live, 0);
    const native = catalog.some(
      (item) => item.name === binding.config.worker && item.host === "kanthord",
    );
    const placement = native ? (binding.config.placement ?? null) : null;
    return {
      binding,
      expected,
      live,
      missing,
      shortfall: missing > 0,
      disabled: expected === 0,
      placement,
      gap: placement === null || missing === 0 ? "none" : placement,
    };
  });
}
