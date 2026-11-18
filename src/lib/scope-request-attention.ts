import type { WorkbenchSessionListItem } from "@/api/types";

import { sessionTitle, workbenchSessionPath } from "./workbench-sessions";

export interface ScopeRequestItem {
  readonly id: string;
  readonly group: "decisions";
  readonly kind: "scope_request";
  readonly subject: string;
  readonly at: number;
  readonly sessionId: string;
  readonly count: number;
}

export function scopeRequestItemsOf(
  sessions: readonly WorkbenchSessionListItem[] | null,
): readonly ScopeRequestItem[] {
  return (sessions ?? []).flatMap((session): readonly ScopeRequestItem[] =>
    session.host_session_id === null && session.scope_requests > 0
      ? [
          {
            id: `scope_request:${session.id}`,
            group: "decisions",
            kind: "scope_request",
            subject: sessionTitle(session),
            at: session.modified,
            sessionId: session.id,
            count: session.scope_requests,
          },
        ]
      : [],
  );
}

export function scopeRequestChatPathOf(item: ScopeRequestItem): string {
  return workbenchSessionPath(item.sessionId);
}
