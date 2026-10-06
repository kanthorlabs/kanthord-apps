import type { WorkbenchSessionListItem } from "@/api/types";

export function sessionsNewestFirst(
  items: readonly WorkbenchSessionListItem[],
): readonly WorkbenchSessionListItem[] {
  return [...items].sort((left, right) => right.modified - left.modified);
}

export function sessionTitle(item: WorkbenchSessionListItem): string {
  if (item.name !== null && item.name !== "") return item.name;
  return item.firstMessage === "" ? "Empty Session" : item.firstMessage;
}
