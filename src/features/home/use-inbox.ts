import { useCallback, useEffect, useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import type { InboxItem } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

import { type InboxScope, readInboxScope } from "./read-inbox";

export interface InboxState {
  readonly items: readonly InboxItem[];
  readonly open: number;
  readonly ready: boolean;
  readonly error: ApiError | null;
  readonly absent: boolean;
  readonly close: (linkUpdateId: string) => void;
  readonly retry: () => void;
}

interface Reads {
  readonly scope: InboxScope | null;
  readonly error: ApiError | null;
}

const NO_READS: Reads = { scope: null, error: null };
const NO_CLOSED: ReadonlySet<string> = new Set();

function stillReturned(closed: ReadonlySet<string>, scope: InboxScope): ReadonlySet<string> {
  const returned = new Set(scope.items.map((item) => item.link_update_id));
  const kept = [...closed].filter((id) => returned.has(id));
  return kept.length === closed.size ? closed : new Set(kept);
}

export function useInbox(updatedAt: number | null): InboxState {
  const [reads, setReads] = useState<Reads>(NO_READS);
  const [closed, setClosed] = useState<ReadonlySet<string>>(NO_CLOSED);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (updatedAt === null) return;
    let live = true;
    readInboxScope(null).then(
      (scope) => {
        if (!live) return;
        setReads({ scope, error: null });
        setClosed((current) => stillReturned(current, scope));
      },
      (cause: unknown) => {
        if (live) setReads((current) => ({ ...current, error: asApiError(cause) }));
      },
    );
    return () => {
      live = false;
    };
  }, [updatedAt, retries]);

  const { scope } = reads;
  const retry = useCallback(() => setRetries((current) => current + 1), []);

  const close = useCallback((linkUpdateId: string) => {
    setClosed((current) => new Set(current).add(linkUpdateId));
  }, []);

  const items = useMemo(
    () => (scope?.items ?? []).filter((item) => !closed.has(item.link_update_id)),
    [scope, closed],
  );
  const hidden = (scope?.items ?? []).filter((item) => closed.has(item.link_update_id)).length;

  return {
    items,
    open: Math.max(0, (scope?.open ?? 0) - hidden),
    ready: scope !== null || reads.error !== null,
    error: reads.error,
    absent: scope?.absent === true,
    close,
    retry,
  };
}
