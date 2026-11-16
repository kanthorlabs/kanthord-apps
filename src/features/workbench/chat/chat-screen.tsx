import { useLocation, useParams, useSearchParams } from "react-router-dom";

import { firstSendFailureOf, newSessionRequestOf } from "@/lib/workbench-new-session";
import { InlineError } from "./components/inline-error";
import { NewSessionChat } from "./components/new-session-chat";
import { SessionChat } from "./components/session-chat";

function NewSessionScreen() {
  const [params] = useSearchParams();
  const request = newSessionRequestOf(params);

  if (!request.ok) return <InlineError code={null} message={request.message} />;
  return <NewSessionChat agentName={request.agentName} configuration={request.configuration} />;
}

function SessionScreen({ sessionId }: { sessionId: string }) {
  const { state } = useLocation();
  return <SessionChat sessionId={sessionId} firstSendFailure={firstSendFailureOf(state)} />;
}

export function ChatScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return sessionId === undefined ? <NewSessionScreen /> : <SessionScreen sessionId={sessionId} />;
}
