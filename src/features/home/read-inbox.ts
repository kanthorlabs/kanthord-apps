import { isRouteAbsent } from "@/api/errors";
import { listInboxItems } from "@/api/resources/mission";
import type { InboxItem } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

const PAGE_LIMIT = 100;
const MAX_PAGES = 1000;

export interface InboxScope {
  readonly projectId: string | null;
  readonly items: readonly InboxItem[];
  readonly open: number;
  readonly absent: boolean;
}

async function readPages(projectId: string | null): Promise<InboxScope> {
  const items: InboxItem[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const list = await listInboxItems({ state: "open", projectId, limit: PAGE_LIMIT, cursor });
    items.push(...list.items);
    cursor = list.next_cursor;
    if (cursor === null) return { projectId, items, open: list.counts.open, absent: false };
    if (seen.has(cursor)) throw new Error("The Inbox read returned the same cursor twice.");
    seen.add(cursor);
  }
  throw new Error(`The Inbox holds more than ${MAX_PAGES * PAGE_LIMIT} open threads.`);
}

export async function readInboxScope(projectId: string | null): Promise<InboxScope> {
  try {
    return await readPages(projectId);
  } catch (cause: unknown) {
    if (!isRouteAbsent(asApiError(cause))) throw cause;
    return { projectId, items: [], open: 0, absent: true };
  }
}
