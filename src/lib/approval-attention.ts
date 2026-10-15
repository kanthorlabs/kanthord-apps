import type { WorkbenchSessionListItem } from "@/api/types";

import { sessionTitle, workbenchSessionPath } from "./workbench-sessions";

export interface ToolApprovalItem {
  readonly id: string;
  readonly group: "decisions";
  readonly kind: "tool_approval";
  readonly subject: string;
  readonly at: number;
  readonly sessionId: string;
  readonly agent: string;
  readonly operationId: string;
}

export function approvalItemsOf(
  sessions: readonly WorkbenchSessionListItem[] | null,
): readonly ToolApprovalItem[] {
  return (sessions ?? []).flatMap((session): readonly ToolApprovalItem[] =>
    session.run_active && session.pending_approval !== null
      ? [
          {
            id: `tool_approval:${session.id}`,
            group: "decisions",
            kind: "tool_approval",
            subject: sessionTitle(session),
            at: session.modified,
            sessionId: session.id,
            agent: session.agent_name,
            operationId: session.pending_approval.operation_id,
          },
        ]
      : [],
  );
}

export function approvalFactOf(item: ToolApprovalItem): string {
  return `operation ${item.operationId}`;
}

export function approvalChatPathOf(item: ToolApprovalItem): string {
  return workbenchSessionPath(item.sessionId);
}
