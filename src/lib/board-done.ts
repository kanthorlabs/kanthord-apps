import type { Project } from "@/api/types";

import type { AttentionItem } from "./attention";
import { boardProjectsOf } from "./board-items";
import { BOARD_TAB, type BoardTabId } from "./board-tabs";

export const DONE_ACT = {
  Resume: "resume",
  Unblock: "unblock",
  Override: "override",
  Discard: "discard",
  Decide: "decide",
  RemoveDependency: "remove_dependency",
  ResumeProject: "resume_project",
} as const;

export type DoneActId = (typeof DONE_ACT)[keyof typeof DONE_ACT];

export type ActedAct =
  | { readonly id: Exclude<DoneActId, "remove_dependency"> }
  | { readonly id: "remove_dependency"; readonly dependency: string };

export type DoneAct = ActedAct & { readonly tab: BoardTabId };

export interface DoneEntry {
  readonly itemId: string;
  readonly subject: string;
  readonly tab: BoardTabId;
  readonly projects: readonly Project[];
  readonly text: string;
  readonly sentAt: string;
}

const CLOCK_FROM = 11;
const CLOCK_TO = 16;

function textOf(subject: string, act: ActedAct): string {
  switch (act.id) {
    case "resume":
      return `Resumed ${subject}.`;
    case "unblock":
      return `Unblocked ${subject}.`;
    case "override":
      return `Overrode ${subject}.`;
    case "discard":
      return `Discarded ${subject}.`;
    case "decide":
      return `Decided the proposals of ${subject}.`;
    case "remove_dependency":
      return `Removed the dependency of ${subject} on ${act.dependency}.`;
    case "resume_project":
      return `Resumed project ${subject}.`;
  }
}

export function doneEntryOf(item: AttentionItem, act: DoneAct, at: number): DoneEntry {
  return {
    itemId: item.id,
    subject: item.subject,
    tab: act.tab,
    projects: boardProjectsOf(item),
    text: textOf(item.subject, act),
    sentAt: `Sent at ${new Date(at).toISOString().slice(CLOCK_FROM, CLOCK_TO)} UTC`,
  };
}

export function doneInView(
  entries: readonly DoneEntry[],
  tab: BoardTabId,
  projectId: string | null,
): readonly DoneEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.tab === tab &&
        (tab === BOARD_TAB.Tool ||
          projectId === null ||
          entry.projects.some((project) => project.id === projectId)),
    )
    .reverse();
}
