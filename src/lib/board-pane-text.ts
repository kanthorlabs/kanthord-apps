import { BOARD_TAB, type BoardTab } from "./board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "./board-width";
import { relativeAge } from "./relative-age";

const ALL_PROJECTS_NOTE = "Counts all projects.";

export interface BoardNotice {
  readonly text: string;
  readonly itemId: string | null;
}

export function ageTextOf(at: number | null, now: number): string {
  return at === null ? "age unknown" : relativeAge(at, now);
}

export function emptyLineOf(tab: BoardTab, projectName: string | null): string {
  return `Nothing waits in ${tab.name}${projectName === null ? "" : ` in ${projectName}`}.`;
}

export function tabVerbOf(tab: BoardTab, widthClass: BoardWidth, filtered: boolean): string {
  const what = widthClass === BOARD_WIDTH.Medium ? ` ${tab.what}` : "";
  const note = filtered && tab.id === BOARD_TAB.Tool ? ` ${ALL_PROJECTS_NOTE}` : "";
  return `${tab.verb}${what}${note}`;
}

export function goneTextOf(subject: string | null): string {
  return subject === null
    ? "The link points to an item that does not wait now."
    : `${subject} left the list at the last refresh. An act elsewhere or a change outside KanthorD resolved it.`;
}

export function healthMessageOf(components: readonly string[], failure: string | null): string {
  return failure === null
    ? `${components.join(", ")}. Operate the host.`
    : `The liveness of the daemon could not be read: ${failure}`;
}

export function noticeTextOf(notice: BoardNotice | null, selectedId: string | null): string | null {
  return notice?.itemId === selectedId ? (notice?.text ?? null) : null;
}

export function dependencySeparatorOf(index: number, count: number): string {
  if (index === 0) return "";
  return index === count - 1 ? " and " : ", ";
}

export function discardedVerbOf(count: number): string {
  return count > 1 ? "are" : "is";
}
