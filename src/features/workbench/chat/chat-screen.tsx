import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatView } from "./components/chat-view";
import { useWorkbenchSession } from "./use-workbench-session";

export function ChatScreen() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
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
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return <ChatView key={view.session.id} session={view.session} enablement={view.enablement} />;
}
