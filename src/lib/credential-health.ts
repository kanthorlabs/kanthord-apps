import type { HealthEntry } from "@/api/types";

export type HealthBadgeVariant = "default" | "destructive" | "outline";

export function healthLabel(entry: HealthEntry | undefined): string {
  return entry === undefined ? "not in report" : entry.status;
}

export function healthVariant(entry: HealthEntry | undefined): HealthBadgeVariant {
  if (entry === undefined) return "outline";
  if (entry.status === "healthy") return "default";
  if (entry.status === "unhealthy") return "destructive";
  return "outline";
}
