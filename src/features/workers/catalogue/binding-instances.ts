import type {
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerPlacement,
  WorkerRegistrationRecord,
} from "@/api/types";
import { effectiveInstanceCount } from "@/lib/instance-count";

export type BindingGap = "none" | WorkerPlacement;

export interface BindingInstances {
  readonly binding: WorkerBindingRecord;
  readonly expected: number;
  readonly live: number;
  readonly missing: number;
  readonly unregistered: readonly string[];
  readonly shortfall: boolean;
  readonly disabled: boolean;
  readonly placement: WorkerPlacement | null;
  readonly gap: BindingGap;
}

export function bindingInstances(
  bindings: readonly WorkerBindingRecord[],
  registrations: readonly WorkerRegistrationRecord[],
  catalog: readonly WorkerCatalogItem[],
): readonly BindingInstances[] {
  return bindings.map((binding) => {
    const own = registrations.filter(
      (registration) =>
        registration.project_id === binding.project_id &&
        registration.resource_identity === binding.resource_identity,
    );
    const live = own.length;
    const expected = effectiveInstanceCount(binding.config);
    const native = catalog.some(
      (item) => item.name === binding.config.worker && item.host === "kanthord",
    );
    const listed =
      native && "worker_instances" in binding.config ? binding.config.worker_instances : null;
    const placement = listed === null ? null : "worker";
    const unregistered =
      listed?.filter(
        (instance) => !own.some((registration) => registration.instance === instance),
      ) ?? [];
    const missing = listed === null ? Math.max(expected - live, 0) : unregistered.length;
    return {
      binding,
      expected,
      live,
      missing,
      unregistered,
      shortfall: missing > 0,
      disabled: expected === 0,
      placement,
      gap: placement === null || missing === 0 ? "none" : placement,
    };
  });
}
