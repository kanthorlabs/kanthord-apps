import { useMemo } from "react";

import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { agentWorking, chatItemsOf } from "@/lib/workbench-chat";
import { useScrollToEnd } from "../use-scroll-to-end";
import { useChatActions } from "../use-chat-actions";
import { useChatConfiguration } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useElapsedSeconds } from "../use-elapsed-seconds";
import { useSessionEvents } from "../use-session-events";
import { AgentWorking } from "./agent-working";
import { ApprovalCard } from "./approval-card";
import { ChatTranscript } from "./chat-transcript";
import { ResumeCommandButton } from "./resume-command-button";
import { Composer } from "./composer";

interface ChatViewProps {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
}

export function ChatView({ session, enablement }: ChatViewProps) {
  const events = useSessionEvents(session.id, session.entries, session.run_active);
  const actions = useChatActions(session.id, events.patchSnapshot);
  const configuration = useChatConfiguration(
    session.id,
    session.agent_name,
    session.configuration,
    enablement,
  );
  const { snapshot } = events;
  const composer = useComposer(snapshot.run_active || actions.busy, actions.send);
  const items = useMemo(() => chatItemsOf(events.entries, snapshot), [events.entries, snapshot]);
  const working = agentWorking(items, snapshot);
  const elapsed = useElapsedSeconds(snapshot.run_active);
  useScrollToEnd(items, snapshot.pending_approval);
  const failures = [actions.failure, configuration.failure, configuration.modelsFailure].filter(
    (failure): failure is string => failure !== null,
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold">{session.agent_name}</h2>
        <Badge variant={snapshot.run_active ? "default" : "outline"}>
          {snapshot.run_active ? "Running" : "Idle"}
        </Badge>
        <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">
          {session.id}
        </span>
        <ResumeCommandButton command={session.resume_command} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ChatTranscript items={items} />
        {working && <AgentWorking seconds={elapsed} />}
        {snapshot.pending_approval !== null && (
          <ApprovalCard
            approval={snapshot.pending_approval}
            busy={actions.busy}
            onDecide={(approved) => {
              if (snapshot.pending_approval !== null) {
                actions.approve(snapshot.pending_approval.tool_call_id, approved);
              }
            }}
          />
        )}
        {snapshot.error_message !== null && (
          <Alert variant="destructive">
            <AlertTitle>The run failed.</AlertTitle>
            <AlertDescription>{snapshot.error_message}</AlertDescription>
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
          runActive={snapshot.run_active}
          onStop={actions.abort}
        />
      </div>
    </div>
  );
}
