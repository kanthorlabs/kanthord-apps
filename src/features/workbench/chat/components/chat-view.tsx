import { type ReactNode, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { agentWorking, chatItemsOf } from "@/lib/workbench-chat";
import { type FirstSendFailure, newSessionPath } from "@/lib/workbench-new-session";
import { useScrollToEnd } from "../use-scroll-to-end";
import { useChatActions } from "../use-chat-actions";
import { useChatConfiguration } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useElapsedSeconds } from "../use-elapsed-seconds";
import { useSessionEvents } from "../use-session-events";
import { AgentWorking } from "./agent-working";
import { ApprovalCard } from "./approval-card";
import { ChatTranscript } from "./chat-transcript";
import { InlineError } from "./inline-error";
import { ResumeCommandButton } from "./resume-command-button";
import { Composer } from "./composer";

interface ChatViewProps {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
  readonly ownerName: string;
  readonly agentDisplayName: string;
  readonly firstSendFailure?: FirstSendFailure | null;
  readonly streamEnd?: ReactNode;
  readonly approvalLine?: ReactNode | null;
  readonly onNew?: () => void;
}

export function ChatView({
  session,
  enablement,
  ownerName,
  agentDisplayName,
  firstSendFailure = null,
  streamEnd = null,
  approvalLine = null,
  onNew,
}: ChatViewProps) {
  const events = useSessionEvents(session.id, session.entries, session.run_active);
  const actions = useChatActions(
    session.id,
    events.patchSnapshot,
    firstSendFailure === null
      ? null
      : { cause: "send", code: firstSendFailure.code, message: firstSendFailure.message },
  );
  const configuration = useChatConfiguration(
    session.id,
    session.agent_name,
    session.configuration,
    enablement,
  );
  const { snapshot } = events;
  const navigate = useNavigate();
  const currentConfiguration = configuration.configuration;
  const openNewChat = useCallback(
    () => navigate(newSessionPath(session.agent_name, currentConfiguration)),
    [navigate, session.agent_name, currentConfiguration],
  );
  const composer = useComposer(snapshot.run_active || actions.busy, actions.send, {
    agentName: session.agent_name,
    onNew: onNew ?? openNewChat,
    initialDraft: firstSendFailure?.draft,
  });
  const items = useMemo(() => chatItemsOf(events.entries, snapshot), [events.entries, snapshot]);
  const working = agentWorking(items, snapshot);
  const elapsed = useElapsedSeconds(snapshot.run_active);
  useScrollToEnd(items, snapshot.pending_approval);
  const approvalFailure = actions.failure?.cause === "approve" ? actions.failure : null;
  const composerFailures = [
    actions.failure !== null && actions.failure.cause !== "approve" ? actions.failure : null,
    configuration.failure === null ? null : { code: null, message: configuration.failure },
    configuration.modelsFailure === null
      ? null
      : { code: null, message: configuration.modelsFailure },
  ].filter((failure) => failure !== null);

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
        <ChatTranscript
          items={items}
          authors={{ ownerName, agentName: session.agent_name, agentDisplayName }}
          runError={snapshot.error_message}
        />
        {working && <AgentWorking seconds={elapsed} />}
        {snapshot.pending_approval !== null &&
          (approvalLine ?? (
            <ApprovalCard
              approval={snapshot.pending_approval}
              busy={actions.busy}
              failure={approvalFailure}
              onDecide={(approved) => {
                if (snapshot.pending_approval !== null) {
                  actions.approve(snapshot.pending_approval.tool_call_id, approved);
                }
              }}
            />
          ))}
        {events.failure !== null && (
          <p role="status" className="text-sm text-muted-foreground">
            The connection to the session failed: {events.failure} Trying again.
          </p>
        )}
        {streamEnd}
      </div>
      <div className="sticky bottom-0 bg-background pt-2">
        <Composer
          composer={composer}
          configuration={configuration}
          runActive={snapshot.run_active}
          onStop={actions.abort}
        />
        {composerFailures.map((failure) => (
          <InlineError key={failure.message} code={failure.code} message={failure.message} />
        ))}
      </div>
    </div>
  );
}
