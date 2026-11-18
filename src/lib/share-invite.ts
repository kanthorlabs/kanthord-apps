import type {
  GrantableOperation,
  GrantedOperation,
  GuardClass,
  WorkbenchInvite,
  WorkbenchProjectRef,
} from "@/api/types";
import type { GuestLine } from "./guest-chat";
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

export type GrantGuardClass = Extract<GuardClass, "reversible" | "judged">;

export interface GrantGroup {
  readonly guardClass: GrantGuardClass;
  readonly label: string;
  readonly line: (name: string) => string;
  readonly operations: readonly GrantableOperation[];
}

export type GroupCheckState = "all" | "some" | "none";

const GRANT_GROUP_TEXTS: readonly Pick<GrantGroup, "guardClass" | "label" | "line">[] = [
  {
    guardClass: "reversible",
    label: "Reversible acts",
    line: () => "Run at once. One opposite call undoes each act.",
  },
  {
    guardClass: "judged",
    label: "Judged acts",
    line: (name) => `Run when the Guard finds that ${name}'s message directs them.`,
  },
];

export function grantGroupsOf(grantable: readonly GrantableOperation[]): readonly GrantGroup[] {
  return GRANT_GROUP_TEXTS.map((group) => ({
    ...group,
    operations: grantable.filter((operation) => operation.guard_class === group.guardClass),
  })).filter((group) => group.operations.length > 0);
}

export function groupCheckStateOf(
  operations: readonly GrantableOperation[],
  checked: readonly string[],
): GroupCheckState {
  const count = operations.filter((operation) => checked.includes(operation.operation_id)).length;
  if (count === 0) return "none";
  return count === operations.length ? "all" : "some";
}

export function withGroupChecked(
  checked: readonly string[],
  operations: readonly GrantableOperation[],
  on: boolean,
): readonly string[] {
  const ids = operations.map((operation) => operation.operation_id);
  const others = checked.filter((id) => !ids.includes(id));
  return on ? [...others, ...ids] : others;
}

export function withOperationChecked(
  checked: readonly string[],
  operationId: string,
  on: boolean,
): readonly string[] {
  const others = checked.filter((id) => id !== operationId);
  return on ? [...others, operationId] : others;
}

export function grantSummaryOf(granted: readonly GrantedOperation[]): string | null {
  if (granted.length === 0) return null;
  const parts = GRANT_GROUP_TEXTS.map(
    ({ guardClass }) =>
      [
        guardClass,
        granted.filter((operation) => operation.guard_class === guardClass).length,
      ] as const,
  )
    .filter(([, count]) => count > 0)
    .map(([guardClass, count]) => `${count} ${guardClass}`);
  return `Without approval: ${parts.join(", ")}`;
}

export function refusedIdsOf(details: unknown): readonly string[] {
  return Array.isArray(details)
    ? details.filter((item): item is string => typeof item === "string")
    : [];
}

export function withRefusedIds(line: GuestLine, details: unknown): GuestLine {
  const ids = refusedIdsOf(details);
  if (ids.length === 0) return line;
  return { code: line.code, message: `${line.message} Refused: ${ids.join(", ")}.` };
}
