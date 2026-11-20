import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session/session-context";
import type { ActionCardItem } from "@/lib/workbench-chat";
import type { FirstSendFailure } from "@/lib/workbench-new-session";
import { hostSessionIdOf, workbenchSessionPath } from "@/lib/workbench-sessions";
import { useWorkbenchSession } from "../use-workbench-session";
import { ChatView } from "./chat-view";

interface SessionChatProps {
  readonly sessionId: string;
  readonly firstSendFailure?: FirstSendFailure | null;
  readonly streamEnd?: ReactNode;
  readonly approvalLine?: ReactNode | null;
  readonly onPendingApproval?: (toolCallId: string | null) => void;
  readonly actionLineOf?: (item: ActionCardItem) => ReactNode | null;
  readonly onNew?: () => void;
  readonly onForked?: (forkSessionId: string) => void;
}

export function SessionChat({
  sessionId,
  firstSendFailure = null,
  streamEnd = null,
  approvalLine = null,
  onPendingApproval,
  actionLineOf,
  onNew,
  onForked,
}: SessionChatProps) {
  const { session } = useSession();
  if (session === null) throw new Error("The chat requires a signed-in session");
  const { data: view, error, loading, reload } = useWorkbenchSession(sessionId);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hostSessionId = error === null ? null : hostSessionIdOf(error);
  if (hostSessionId !== null) return <Navigate to={workbenchSessionPath(hostSessionId)} replace />;

  if (error !== null || view === null) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{error?.message}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
        {streamEnd}
      </div>
    );
  }

  return (
    <ChatView
      key={view.session.id}
      session={view.session}
      enablement={view.enablement}
      ownerName={session.identity.name}
      firstSendFailure={firstSendFailure}
      streamEnd={streamEnd}
      approvalLine={approvalLine}
      onPendingApproval={onPendingApproval}
      actionLineOf={actionLineOf}
      onNew={onNew}
      onForked={onForked}
    />
  );
}
