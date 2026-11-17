import type { ChatItem } from "./workbench-chat";

const NAME_MAX_CHARACTERS = 64;
const NO_FORK_TITLE = "an earlier conversation";

export function inviteeNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed !== "" && [...trimmed].length <= NAME_MAX_CHARACTERS;
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
