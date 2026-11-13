import { isRouteAbsent } from "@/api/errors";
import { listInboxItems } from "@/api/resources/mission";
import type { InboxItem } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

const PAGE_LIMIT = 100;

export interface InboxScope {
  readonly projectId: string | null;
  readonly items: readonly InboxItem[];
  readonly nextCursor: string | null;
  readonly open: number;
  readonly snoozed: number;
  readonly absent: boolean;
}

async function readPages(projectId: string | null, pages: number): Promise<InboxScope> {
  const items: InboxItem[] = [];
  let cursor: string | null = null;
  let open = 0;
  let snoozed = 0;
  for (let page = 0; page < pages; page += 1) {
    const list = await listInboxItems({ state: "open", projectId, limit: PAGE_LIMIT, cursor });
    items.push(...list.items);
    ({ open, snoozed } = list.counts);
    cursor = list.next_cursor;
    if (cursor === null) break;
  }
  return { projectId, items, nextCursor: cursor, open, snoozed, absent: false };
}

export async function readInboxScope(projectId: string | null, pages: number): Promise<InboxScope> {
  try {
    return await readPages(projectId, pages);
  } catch (cause: unknown) {
    if (!isRouteAbsent(asApiError(cause))) throw cause;
    return { projectId, items: [], nextCursor: null, open: 0, snoozed: 0, absent: true };
  }
}
