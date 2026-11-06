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
  readonly error: ApiError | null;
  readonly loadMore: () => void;
}

interface Reads {
  readonly all: InboxScope | null;
  readonly scoped: InboxScope | null;
  readonly error: ApiError | null;
}

const NO_READS: Reads = { all: null, scoped: null, error: null };

export function useInbox(projectId: string | null, updatedAt: number | null): InboxState {
  const [reads, setReads] = useState<Reads>(NO_READS);
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
        if (live) setReads({ all, scoped, error: null });
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

  const items = useMemo(
    () => mergedInboxItemsOf([reads.all?.items ?? [], scoped?.items ?? []]),
    [reads.all, scoped],
  );

  return {
    items,
    open: scope?.open ?? 0,
    snoozed: scope?.snoozed ?? 0,
    hasMore: (scope?.nextCursor ?? null) !== null,
    error: reads.error,
    loadMore,
  };
}
