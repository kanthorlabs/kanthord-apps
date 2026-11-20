import { useEffect } from "react";

import type { WorkbenchRunSnapshot } from "@/api/types";

export function usePendingApprovalReport(
  snapshot: WorkbenchRunSnapshot,
  onPendingApproval: ((toolCallId: string | null) => void) | undefined,
): void {
  const pendingToolCallId = snapshot.pending_approval?.tool_call_id ?? null;
  useEffect(() => {
    onPendingApproval?.(pendingToolCallId);
  }, [onPendingApproval, pendingToolCallId]);
}
