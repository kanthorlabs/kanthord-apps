import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session/session-context";
import type { FirstSendFailure } from "@/lib/workbench-new-session";
import { useWorkbenchSession } from "../use-workbench-session";
import { ChatView } from "./chat-view";

interface SessionChatProps {
  readonly sessionId: string;
  readonly firstSendFailure?: FirstSendFailure | null;
  readonly streamEnd?: ReactNode;
  readonly approvalLine?: ReactNode | null;
  readonly onNew?: () => void;
}

export function SessionChat({
  sessionId,
  firstSendFailure = null,
  streamEnd = null,
  approvalLine = null,
  onNew,
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
      agentDisplayName={view.agentDisplayName}
      firstSendFailure={firstSendFailure}
      streamEnd={streamEnd}
      approvalLine={approvalLine}
      onNew={onNew}
    />
  );
}
