import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import type { InboxItem } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { mergedInboxItemsOf } from "@/lib/inbox-attention";

import { type InboxScope, readInboxScope } from "./read-inbox";

const ALL_KEY = "all";

export interface InboxState {
  readonly items: readonly InboxItem[];
  readonly open: number;
  readonly snoozed: number;
  readonly hasMore: boolean;
  readonly ready: boolean;
  readonly error: ApiError | null;
  readonly absent: boolean;
  readonly loadMore: () => void;
  readonly close: (linkUpdateId: string) => void;
}

interface Reads {
  readonly all: InboxScope | null;
  readonly scoped: InboxScope | null;
  readonly error: ApiError | null;
}

const NO_READS: Reads = { all: null, scoped: null, error: null };
const NO_CLOSED: ReadonlySet<string> = new Set();

function stillReturned(
  closed: ReadonlySet<string>,
  scopes: readonly (InboxScope | null)[],
): ReadonlySet<string> {
  const returned = new Set(
    scopes.flatMap((scope) => (scope?.items ?? []).map((item) => item.link_update_id)),
  );
  const kept = [...closed].filter((id) => returned.has(id));
  return kept.length === closed.size ? closed : new Set(kept);
}

export function useInbox(projectId: string | null, updatedAt: number | null): InboxState {
  const [reads, setReads] = useState<Reads>(NO_READS);
  const [closed, setClosed] = useState<ReadonlySet<string>>(NO_CLOSED);
  const [pages, setPages] = useState<Readonly<Record<string, number>>>({});
  const allPages = pages[ALL_KEY] ?? 1;
  const scopedPages = projectId === null ? 1 : (pages[projectId] ?? 1);

  useEffect(() => {
    if (updatedAt === null) return;
    let live = true;
    Promise.all([
      readInboxScope(null, allPages),
      projectId === null ? null : readInboxScope(projectId, scopedPages),
    ]).then(
      ([all, scoped]) => {
        if (!live) return;
        setReads({ all, scoped, error: null });
        setClosed((current) => stillReturned(current, [all, scoped]));
      },
      (cause: unknown) => {
        if (live) setReads((current) => ({ ...current, error: asApiError(cause) }));
      },
    );
    return () => {
      live = false;
    };
  }, [projectId, updatedAt, allPages, scopedPages]);

  const scoped = reads.scoped?.projectId === projectId ? reads.scoped : null;
  const scope = projectId === null ? reads.all : scoped;
  const scopeKey = projectId ?? ALL_KEY;
  const loadMore = useCallback(() => {
    setPages((current) => ({ ...current, [scopeKey]: (current[scopeKey] ?? 1) + 1 }));
  }, [scopeKey]);

  const close = useCallback((linkUpdateId: string) => {
    setClosed((current) => new Set(current).add(linkUpdateId));
  }, []);

  const items = useMemo(
    () =>
      mergedInboxItemsOf([reads.all?.items ?? [], scoped?.items ?? []]).filter(
        (item) => !closed.has(item.link_update_id),
      ),
    [reads.all, scoped, closed],
  );
  const hidden = (scope?.items ?? []).filter((item) => closed.has(item.link_update_id)).length;

  return {
    items,
    open: Math.max(0, (scope?.open ?? 0) - hidden),
    snoozed: scope?.snoozed ?? 0,
    hasMore: (scope?.nextCursor ?? null) !== null,
    ready: reads.all !== null || reads.error !== null,
    error: reads.error,
    absent: reads.all?.absent === true,
    loadMore,
    close,
  };
}
