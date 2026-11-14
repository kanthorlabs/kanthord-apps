import type { MissionNodeRecord, Project, WorkbenchActionOffer } from "@/api/types";
import { ACTION_VERBS } from "./workbench-chat";

function changedLineOf(offer: WorkbenchActionOffer, now: string): string {
  return `${offer.target_id} changed since the card: it is now ${now}. Nothing ran.`;
}

export function readFailureLineOf(offer: WorkbenchActionOffer, message: string): string {
  return `${offer.target_id} was not read: ${message}`;
}

export function nodeChangeLineOf(
  offer: WorkbenchActionOffer,
  node: Pick<MissionNodeRecord, "state" | "attempt">,
): string | null {
  const { seen } = offer;
  if ("state" in seen && seen.state === node.state && seen.attempt === node.attempt) return null;
  return changedLineOf(offer, `${node.state} (attempt ${node.attempt})`);
}

export function projectChangeLineOf(
  offer: WorkbenchActionOffer,
  project: Pick<Project, "paused_at">,
): string | null {
  const { seen } = offer;
  const paused = project.paused_at !== null;
  if ("paused" in seen && seen.paused === paused) return null;
  return changedLineOf(offer, paused ? "paused" : "active");
}

export function revisionChangeLineOf(
  offer: WorkbenchActionOffer,
  revision: number | null,
): string | null {
  const { seen } = offer;
  if ("revision" in seen && seen.revision === revision) return null;
  return changedLineOf(offer, revision === null ? "without a revision" : `revision ${revision}`);
}

export function versionChangeLineOf(offer: WorkbenchActionOffer, version: number): string | null {
  const { seen } = offer;
  if ("version" in seen && seen.version === version) return null;
  return changedLineOf(offer, `binding set version ${version}`);
}

const DANGER_OPERATIONS: readonly string[] = ["mission.node.discard", "mission.node.override"];

export function actionVerbOf(operationId: string): string | null {
  return Object.entries(ACTION_VERBS).find(([id]) => id === operationId)?.[1] ?? null;
}

export function actionFactsOf(offer: WorkbenchActionOffer): readonly string[] {
  const { seen, target_id } = offer;
  if ("revision" in seen) return [`Offered at revision ${seen.revision}`];
  if ("version" in seen) return [`Offered at binding set version ${seen.version}`];
  if ("state" in seen) {
    return [`node: ${seen.name} (${target_id})`, `state: ${seen.state} · attempt ${seen.attempt}`];
  }
  return [`project: ${seen.name} (${target_id})`, `state: ${seen.paused ? "paused" : "active"}`];
}

export function isDangerOperation(operationId: string): boolean {
  return DANGER_OPERATIONS.includes(operationId);
}
