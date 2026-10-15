import type { SchedulerExecutionRecord } from "@/api/types";

type Claimant = SchedulerExecutionRecord["claimant"];

export function bindingNameOf(claimant: Claimant): string {
  return claimant.resource_identity.slice(claimant.resource_identity.lastIndexOf(":") + 1);
}
