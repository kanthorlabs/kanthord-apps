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
  Approve: "approve",
  Reject: "reject",
  Rotate: "rotate",
  Onboarding: "onboarding",
} as const;

export type DoneActId = (typeof DONE_ACT)[keyof typeof DONE_ACT];

export type ActedAct =
  | { readonly id: Exclude<DoneActId, "remove_dependency" | "rotate"> }
  | { readonly id: "remove_dependency"; readonly dependency: string }
  | {
      readonly id: "rotate";
      readonly revision: number;
      readonly holders: readonly string[];
      readonly paused: number;
    };

export type DoneAct = ActedAct & { readonly tab: BoardTabId };

export interface DoneGoTo {
  readonly label: string;
  readonly tab: BoardTabId;
}

export interface DoneEntry {
  readonly itemId: string;
  readonly subject: string;
  readonly tab: BoardTabId;
  readonly projects: readonly Project[];
  readonly text: string;
  readonly sentAt: string;
  readonly note?: string;
  readonly goTo?: DoneGoTo;
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
    case "approve":
      return `Approved ${subject}.`;
    case "reject":
      return `Rejected ${subject}.`;
    case "rotate":
      return `Rotated ${subject} to revision ${act.revision}.`;
    case "onboarding":
      return `Onboarding of ${subject} started.`;
  }
}

function rotateNoteOf(act: Extract<ActedAct, { id: "rotate" }>): string | undefined {
  const holders = act.holders.length === 0 ? "" : `Also rotated on ${act.holders.join(", ")}. `;
  const nodes =
    act.paused === 0
      ? ""
      : `${act.paused} paused ${act.paused === 1 ? "node" : "nodes"} in Resume can run again.`;
  const note = `${holders}${nodes}`.trim();
  return note === "" ? undefined : note;
}

function extrasOf(act: ActedAct): Pick<DoneEntry, "note" | "goTo"> {
  if (act.id !== "rotate") return {};
  const note = rotateNoteOf(act);
  return {
    ...(note === undefined ? {} : { note }),
    goTo: { label: "Go to Resume", tab: BOARD_TAB.Resume },
  };
}

export function doneEntryOf(item: AttentionItem, act: DoneAct, at: number): DoneEntry {
  return {
    itemId: item.id,
    subject: item.subject,
    tab: act.tab,
    projects: boardProjectsOf(item),
    text: textOf(item.subject, act),
    sentAt: `Sent at ${new Date(at).toISOString().slice(CLOCK_FROM, CLOCK_TO)} UTC`,
    ...extrasOf(act),
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
