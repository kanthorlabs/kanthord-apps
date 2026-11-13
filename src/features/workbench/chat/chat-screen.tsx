import { useLocation, useParams, useSearchParams } from "react-router-dom";

import { listAgents } from "@/api/resources/workers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session/session-context";
import { useResource } from "@/hooks/use-resource";
import { firstSendFailureOf, newSessionRequestOf } from "@/lib/workbench-new-session";
import { ChatView } from "./components/chat-view";
import { InlineError } from "./components/inline-error";
import { NewSessionChat } from "./components/new-session-chat";
import { useWorkbenchSession } from "./use-workbench-session";

function LoadingChat() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function NewSessionScreen() {
  const [params] = useSearchParams();
  const request = newSessionRequestOf(params);
  const { data: agents, error, loading, reload } = useResource(listAgents, []);

  if (!request.ok) return <InlineError code={null} message={request.message} />;
  if (loading) return <LoadingChat />;
  if (error !== null || agents === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  const displayName =
    agents.find((agent) => agent.agentName === request.agentName)?.displayName ?? request.agentName;
  return (
    <NewSessionChat
      agentName={request.agentName}
      agentDisplayName={displayName}
      configuration={request.configuration}
    />
  );
}

function SessionScreen({ sessionId }: { sessionId: string }) {
  const { session } = useSession();
  if (session === null) throw new Error("The chat requires a signed-in session");
  const { state } = useLocation();
  const { data: view, error, loading, reload } = useWorkbenchSession(sessionId);

  if (loading) return <LoadingChat />;

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

  return (
    <ChatView
      key={view.session.id}
      session={view.session}
      enablement={view.enablement}
      ownerName={session.identity.name}
      agentDisplayName={view.agentDisplayName}
      firstSendFailure={firstSendFailureOf(state)}
    />
  );
}

export function ChatScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return sessionId === undefined ? <NewSessionScreen /> : <SessionScreen sessionId={sessionId} />;
}
