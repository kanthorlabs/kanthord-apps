import type { WorkerBindingConfig } from "@/api/types";

export function effectiveInstanceCount(config: WorkerBindingConfig): number {
  return "worker_instances" in config ? config.worker_instances.length : config.instance_count;
}
