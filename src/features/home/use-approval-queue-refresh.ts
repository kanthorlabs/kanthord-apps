import { useCallback, useEffect, useRef, useState } from "react";

interface ApprovalQueueRefreshInput {
  readonly ready: boolean;
  readonly queued: boolean;
  readonly refresh: () => void;
}

export function useApprovalQueueRefresh({ ready, queued, refresh }: ApprovalQueueRefreshInput) {
  const [toolCallId, setToolCallId] = useState<string | null>(null);
  const refreshed = useRef<string | null>(null);

  useEffect(() => {
    if (toolCallId === null || !ready || queued || refreshed.current === toolCallId) return;
    refreshed.current = toolCallId;
    refresh();
  }, [toolCallId, ready, queued, refresh]);

  return useCallback((pending: string | null) => setToolCallId(pending), []);
}
