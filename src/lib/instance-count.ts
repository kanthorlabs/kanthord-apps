import type { WorkerBindingConfig } from "@/api/types";

export function effectiveInstanceCount(config: WorkerBindingConfig): number {
  return config.placement === "worker"
    ? (config.worker_instances?.length ?? 0)
    : (config.instance_count ?? 0);
}
