import type { WorkbenchInvite, WorkbenchProjectRef } from "@/api/types";
import type { ChatItem } from "./workbench-chat";

const NAME_MAX_CHARACTERS = 64;
export const MAX_INVITE_PROJECTS = 50;
const NO_FORK_TITLE = "an earlier conversation";

export function inviteeNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && [...trimmed].length <= NAME_MAX_CHARACTERS;
}

export function projectCountValid(count: number): boolean {
  return count >= 1 && count <= MAX_INVITE_PROJECTS;
}

export function projectRefLabel(project: WorkbenchProjectRef): string {
  return project.name ?? project.id;
}

export function projectLabelOf(
  projects: readonly { readonly id: string; readonly name: string }[],
  id: string,
): string {
  return projects.find((project) => project.id === id)?.name ?? id;
}

export function lockedProjectsOf(
  projectIds: readonly string[] | null,
  invites: readonly WorkbenchInvite[],
): readonly WorkbenchProjectRef[] | null {
  if (projectIds === null) return null;
  const known = new Map(invites.flatMap((invite) => invite.projects).map((ref) => [ref.id, ref]));
  return projectIds.map((id) => known.get(id) ?? { id, name: null });
}

export function forkTitleOf(forkedFrom: string | null, items: readonly ChatItem[]): string | null {
  if (forkedFrom === null) return null;
  const fork = items.find((item) => item.kind === "fork");
  return fork === undefined || fork.source_title === "" ? NO_FORK_TITLE : fork.source_title;
}

export function inviteLinkOf(
  origin: string,
  basePath: string,
  inviteToken: string,
  inviteeName: string,
): string {
  const base = basePath === "/" ? "" : basePath;
  return `${origin}${base}/join/${inviteToken}#name=${encodeURIComponent(inviteeName)}`;
}
