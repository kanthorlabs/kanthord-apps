import type { HealthEntry } from "@/api/types";

export type HealthBadgeVariant = "default" | "destructive" | "outline";

export function healthLabel(entry: HealthEntry): string {
  return entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
}

export function healthVariant(entry: HealthEntry): HealthBadgeVariant {
  if (entry.status === "healthy") return "default";
  if (entry.status === "unhealthy") return "destructive";
  return "outline";
}
