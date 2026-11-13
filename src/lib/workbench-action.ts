import type { MissionNodeRecord, Project, WorkbenchActionOffer } from "@/api/types";
import { ACTION_VERBS } from "./workbench-chat";

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

const DANGER_OPERATIONS: readonly string[] = ["mission.node.discard", "mission.node.override"];

export function actionVerbOf(operationId: string): string | null {
  return Object.entries(ACTION_VERBS).find(([id]) => id === operationId)?.[1] ?? null;
}

export function actionFactsOf(offer: WorkbenchActionOffer): readonly string[] {
  const { seen, target_id } = offer;
  if ("state" in seen)
    return [`node: ${target_id}`, `state: ${seen.state} · attempt ${seen.attempt}`];
  return [`project: ${target_id}`, `state: ${seen.paused ? "paused" : "active"}`];
}

export function isDangerOperation(operationId: string): boolean {
  return DANGER_OPERATIONS.includes(operationId);
}
