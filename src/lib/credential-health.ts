import type { HealthEntry } from "@/api/types";

export type HealthBadgeVariant = "default" | "destructive" | "outline";

export function healthLabel(entry: HealthEntry | undefined): string {
  if (entry === undefined) return "Not in report";
  return entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
}

export function healthVariant(entry: HealthEntry | undefined): HealthBadgeVariant {
  if (entry === undefined) return "outline";
  if (entry.status === "healthy") return "default";
  if (entry.status === "unhealthy") return "destructive";
  return "outline";
}
