import type { MissionNodeRecord, Project, WorkbenchActionOffer } from "@/api/types";

export function nodeChangeLineOf(
  offer: WorkbenchActionOffer,
  node: Pick<MissionNodeRecord, "state" | "attempt">,
): string | null {
  const { seen, target_id } = offer;
  if (!("state" in seen)) return `${target_id} changed since this offer.`;
  if (seen.state === node.state && seen.attempt === node.attempt) return null;
  return `${target_id} changed since this offer: ${seen.state}, attempt ${seen.attempt} → ${node.state}, attempt ${node.attempt}.`;
}

export function projectChangeLineOf(
  offer: WorkbenchActionOffer,
  project: Pick<Project, "paused_at">,
): string | null {
  const { seen } = offer;
  if ("paused" in seen && seen.paused === (project.paused_at !== null)) return null;
  return `${offer.target_id} changed since this offer.`;
}
