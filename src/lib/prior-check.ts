import type { HealthEntry, ResourceStatus } from "@/api/types";

export interface PriorCheck {
  readonly entry: HealthEntry;
  readonly checkedAt: number;
}

export interface PriorCheckState {
  readonly priorCheck: PriorCheck;
}

const STATUSES: readonly ResourceStatus[] = ["healthy", "unhealthy", "unknown"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function priorCheckOf(state: unknown): PriorCheck | null {
  if (!isRecord(state) || !isRecord(state.priorCheck)) return null;
  const { entry, checkedAt } = state.priorCheck;
  if (typeof checkedAt !== "number" || !isRecord(entry)) return null;
  const { status, capability } = entry;
  if (typeof capability !== "string") return null;
  if (!STATUSES.some((known) => known === status)) return null;
  return { entry: { status: status as ResourceStatus, capability }, checkedAt };
}
