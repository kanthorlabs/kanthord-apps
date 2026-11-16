import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import {
  type ActionCardItem,
  agentWorking,
  chatItemsOf,
  memberOf,
  runRequestOf,
} from "@/lib/workbench-chat";
import { type FirstSendFailure, newSessionPath } from "@/lib/workbench-new-session";
import { workbenchSessionPath } from "@/lib/workbench-sessions";
import { addresseeOf, configurationTargetOf, leadingMentionOf } from "@/lib/workbench-mention";
import { newCommandHintOf } from "../slash-commands";
import { useScrollToEnd } from "../use-scroll-to-end";
import { useChatActions } from "../use-chat-actions";
import { useChatConfiguration } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useElapsedSeconds } from "../use-elapsed-seconds";
import { useMentionAgents } from "../use-mention-agents";
import { useSessionEvents } from "../use-session-events";
import { useStopConfirm } from "../use-stop-confirm";
import { AgentWorking } from "./agent-working";
import { ApprovalCard } from "./approval-card";
import { AutoModeSwitch } from "./auto-mode-switch";
import { ChatTranscript } from "./chat-transcript";
import { InlineError } from "./inline-error";
import { ResumeCommandButton } from "./resume-command-button";
import { Composer } from "./composer";
import { QueuedMessages } from "./queued-messages";
import { RunLine } from "./run-line";
import { SummarizingLine } from "./summarizing-line";

interface ChatViewProps {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
  readonly ownerName: string;
  readonly firstSendFailure?: FirstSendFailure | null;
  readonly streamEnd?: ReactNode;
  readonly approvalLine?: ReactNode | null;
  readonly actionLineOf?: (item: ActionCardItem) => ReactNode | null;
  readonly onNew?: () => void;
  readonly onForked?: (forkSessionId: string) => void;
}

export function ChatView({
  session,
  enablement,
  ownerName,
  firstSendFailure = null,
  streamEnd = null,
  approvalLine = null,
  actionLineOf,
  onNew,
  onForked,
}: ChatViewProps) {
  const events = useSessionEvents(session.id, session.entries, session.members, session.run_active);
  const mentionAgents = useMentionAgents();
  const mentionNames = useMemo(
    () => mentionAgents.agents.map((agent) => agent.displayName),
    [mentionAgents.agents],
  );
  const mentionOf = useCallback(
    (text: string) =>
      leadingMentionOf(text, [
        ...events.members.map((member) => member.display_name),
        ...mentionNames,
      ]),
    [events.members, mentionNames],
  );
  const navigate = useNavigate();
  const openHost = useCallback(
    (hostSessionId: string) => navigate(workbenchSessionPath(hostSessionId), { replace: true }),
    [navigate],
  );
  const openFork = useCallback(
    (forkSessionId: string) => navigate(workbenchSessionPath(forkSessionId)),
    [navigate],
  );
  const actions = useChatActions(
    session.id,
    events.patchSnapshot,
    firstSendFailure === null
      ? null
      : { cause: "send", code: firstSendFailure.code, message: firstSendFailure.message },
    mentionOf,
    openHost,
    onForked ?? openFork,
  );
  const { snapshot, patchSnapshot } = events;
  const onAutoMode = useCallback(
    (enabled: boolean) => patchSnapshot({ auto_mode: enabled }),
    [patchSnapshot],
  );
  const newChat = useRef<() => void>(() => undefined);
  const handleNew = useCallback(() => newChat.current(), []);
  const composer = useComposer(actions.busy, actions.send, {
    agentName: session.agent_name,
    onNew: handleNew,
    fork: actions.fork,
    initialDraft: firstSendFailure?.draft,
    mentionNames,
  });
  const addressee = useMemo(
    () => addresseeOf(composer.draft, events.members, events.entries, mentionNames),
    [composer.draft, events.members, events.entries, mentionNames],
  );
  const host = useMemo(
    () => ({
      sessionId: session.id,
      agentName: session.agent_name,
      configuration: session.configuration,
      enablement,
    }),
    [session.id, session.agent_name, session.configuration, enablement],
  );
  const hostDisplayName = memberOf(events.members, session.id).display_name;
  const target = configurationTargetOf(addressee, host, mentionAgents.agents);
  const shown = target ?? host;
  const configuration = useChatConfiguration(shown);
  const openNewChat = useCallback(
    () => navigate(newSessionPath(session.agent_name, session.configuration, hostDisplayName)),
    [navigate, session.agent_name, session.configuration, hostDisplayName],
  );
  useEffect(() => {
    newChat.current = onNew ?? openNewChat;
  });
  const { bindRefill } = actions;
  useEffect(() => bindRefill(composer.refill), [bindRefill, composer.refill]);
  const queueCount = snapshot.queue.length;
  const stopConfirm = useStopConfirm({
    runActive: snapshot.run_active,
    queueCount,
    actions,
    composer,
  });
  const { members } = events;
  const items = useMemo(
    () => chatItemsOf(events.entries, snapshot, members, session.forked_from),
    [events.entries, snapshot, members, session.forked_from],
  );
  const working = agentWorking(items, snapshot);
  const elapsed = useElapsedSeconds(snapshot.run_active, runRequestOf(items)?.id ?? null);
  useScrollToEnd(items, snapshot.pending_approval);
  const approvalFailure =
    actions.failure?.cause === "approve" &&
    actions.failure.toolCallId === snapshot.pending_approval?.tool_call_id
      ? actions.failure
      : null;
  const queueFailure = actions.failure?.cause === "queue" ? actions.failure : null;
  const composerFailures = [
    actions.failure !== null &&
    actions.failure.cause !== "approve" &&
    actions.failure.cause !== "queue"
      ? actions.failure
      : null,
    configuration.failure === null ? null : { code: null, message: configuration.failure },
    configuration.modelsFailure === null
      ? null
      : { code: null, message: configuration.modelsFailure },
    mentionAgents.failure === null ? null : { code: null, message: mentionAgents.failure },
  ].filter((failure) => failure !== null);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-lg font-semibold">{hostDisplayName} conversation</h2>
        <Badge variant={snapshot.run_active ? "default" : "outline"}>
          {snapshot.run_active ? "Running" : "Idle"}
        </Badge>
        <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">
          {session.id}
        </span>
        <ResumeCommandButton command={session.resume_command} />
        <div role="group" aria-label="Members" className="flex flex-wrap gap-1">
          {members.map((member) => (
            <Badge key={member.session_id} variant="secondary">
              {member.display_name}
            </Badge>
          ))}
        </div>
        <AutoModeSwitch
          sessionId={session.id}
          enabled={snapshot.auto_mode}
          disabled={!events.snapshotLoaded}
          onEnabled={onAutoMode}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ChatTranscript
          items={items}
          authors={{ ownerName }}
          runError={snapshot.error_message}
          actionLineOf={actionLineOf}
          sessionId={session.id}
          canRun
          runLine={
            <RunLine
              runActive={snapshot.run_active}
              request={runRequestOf(items)}
              ownerName={ownerName}
              busy={actions.busy}
              onStop={stopConfirm.stop}
            />
          }
        />
        {working && <AgentWorking seconds={elapsed} />}
        {snapshot.pending_approval !== null &&
          (approvalLine ?? (
            <ApprovalCard
              approval={snapshot.pending_approval}
              agentDisplayName={
                memberOf(members, snapshot.pending_approval.session_id).display_name
              }
              busy={actions.busy}
              failure={approvalFailure}
              onDecide={(approved) => {
                if (snapshot.pending_approval !== null) {
                  actions.approve(snapshot.pending_approval, approved);
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
        <QueuedMessages
          queue={snapshot.queue}
          busy={actions.busy}
          failure={queueFailure}
          onEdit={actions.edit}
          onRemove={actions.remove}
        />
        {actions.summarizing && <SummarizingLine onCancel={actions.cancelFork} />}
        <Composer
          composer={composer}
          newCommandHint={newCommandHintOf(hostDisplayName)}
          configuration={target === null ? null : configuration}
          agentDisplayName={hostDisplayName}
          addressee={addressee}
          runActive={snapshot.run_active}
          queued={queueCount > 0}
          stopConfirm={stopConfirm.confirm}
        />
        {composerFailures.map((failure) => (
          <InlineError key={failure.message} code={failure.code} message={failure.message} />
        ))}
      </div>
    </div>
  );
}
