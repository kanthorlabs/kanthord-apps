import { useMemo } from "react";

import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { chatItemsOf } from "@/lib/workbench-chat";
import { useScrollToEnd } from "../use-scroll-to-end";
import { useChatActions } from "../use-chat-actions";
import { useChatConfiguration } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useSessionEvents } from "../use-session-events";
import { ApprovalCard } from "./approval-card";
import { ChatTranscript } from "./chat-transcript";
import { Composer } from "./composer";

interface ChatViewProps {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
}

export function ChatView({ session, enablement }: ChatViewProps) {
  const events = useSessionEvents(session.id, session.entries, session.runActive);
  const actions = useChatActions(session.id, events.patchSnapshot);
  const configuration = useChatConfiguration(
    session.id,
    session.agentName,
    session.configuration,
    enablement,
  );
  const { snapshot } = events;
  const composer = useComposer(snapshot.runActive || actions.busy, actions.send);
  const items = useMemo(() => chatItemsOf(events.entries, snapshot), [events.entries, snapshot]);
  useScrollToEnd(items, snapshot.pendingApproval);
  const failures = [actions.failure, configuration.failure, configuration.modelsFailure].filter(
    (failure): failure is string => failure !== null,
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold">{session.agentName}</h2>
        <Badge variant={snapshot.runActive ? "default" : "outline"}>
          {snapshot.runActive ? "Running" : "Idle"}
        </Badge>
        <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">
          {session.id}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ChatTranscript items={items} />
        {snapshot.pendingApproval !== null && (
          <ApprovalCard
            approval={snapshot.pendingApproval}
            busy={actions.busy}
            onDecide={(approved) => {
              if (snapshot.pendingApproval !== null) {
                actions.approve(snapshot.pendingApproval.toolCallId, approved);
              }
            }}
          />
        )}
        {snapshot.errorMessage !== null && (
          <Alert variant="destructive">
            <AlertTitle>The run failed.</AlertTitle>
            <AlertDescription>{snapshot.errorMessage}</AlertDescription>
          </Alert>
        )}
        {events.failure !== null && (
          <p role="status" className="text-sm text-muted-foreground">
            The connection to the session failed: {events.failure} Trying again.
          </p>
        )}
        {failures.map((failure) => (
          <Alert key={failure} variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ))}
      </div>
      <div className="sticky bottom-0 bg-background pt-2">
        <Composer
          composer={composer}
          configuration={configuration}
          runActive={snapshot.runActive}
          onStop={actions.abort}
        />
      </div>
    </div>
  );
}
