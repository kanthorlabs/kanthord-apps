import { useLocation, useParams, useSearchParams } from "react-router-dom";

import {
  firstSendFailureOf,
  type NewSessionRequest,
  newSessionRequestOf,
} from "@/lib/workbench-new-session";
import { InlineError } from "./components/inline-error";
import { NewSessionChat } from "./components/new-session-chat";
import { SessionChat } from "./components/session-chat";
import { useMentionAgents } from "./use-mention-agents";
import { useNewSessionVariant } from "./use-new-session-variant";

type ValidRequest = Extract<NewSessionRequest, { ok: true }>;

function VariantNewSession({
  request,
  variantId,
}: {
  readonly request: ValidRequest;
  readonly variantId: string;
}) {
  const { variant, failure } = useNewSessionVariant(variantId);
  const { displayNameOf } = useMentionAgents();
  return (
    <NewSessionChat
      agentName={request.agentName}
      agentDisplayName={variant?.display_name ?? null}
      configuration={request.configuration}
      variant={{
        id: variantId,
        baseDisplayName: displayNameOf(request.agentName),
        failure,
      }}
    />
  );
}

function NewSessionScreen() {
  const [params] = useSearchParams();
  const request = newSessionRequestOf(params);

  if (!request.ok) return <InlineError code={null} message={request.message} />;
  if (request.variantId !== null) {
    return <VariantNewSession request={request} variantId={request.variantId} />;
  }
  return (
    <NewSessionChat
      agentName={request.agentName}
      agentDisplayName={request.agentDisplayName}
      configuration={request.configuration}
    />
  );
}

function SessionScreen({ sessionId }: { sessionId: string }) {
  const { state } = useLocation();
  return <SessionChat sessionId={sessionId} firstSendFailure={firstSendFailureOf(state)} />;
}

export function ChatScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return sessionId === undefined ? <NewSessionScreen /> : <SessionScreen sessionId={sessionId} />;
}
