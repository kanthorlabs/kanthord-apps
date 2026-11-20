import { useCallback, useEffect, useRef, useState } from "react";

import type { DeckQueueEntry } from "@/lib/home-deck";
import type { OverviewState } from "./use-overview";

interface ApprovalQueueRefreshInput {
  readonly overview: OverviewState;
  readonly queued: DeckQueueEntry | null;
}

export function useApprovalQueueRefresh({ overview, queued }: ApprovalQueueRefreshInput) {
  const [toolCallId, setToolCallId] = useState<string | null>(null);
  const refreshed = useRef<string | null>(null);
  const ready = overview.status === "ready" && overview.loaded;
  const isQueued = queued !== null;
  const { refresh } = overview;

  useEffect(() => {
    if (toolCallId === null || !ready || isQueued || refreshed.current === toolCallId) return;
    refreshed.current = toolCallId;
    refresh();
  }, [toolCallId, ready, isQueued, refresh]);

  return useCallback((pending: string | null) => setToolCallId(pending), []);
}
