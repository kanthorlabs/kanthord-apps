import { type ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import type { WorkbenchConfiguration } from "@/api/types";
import type { VariantLine } from "@/lib/agent-variant";
import { addresseeOf } from "@/lib/workbench-mention";
import { workbenchSessionPath } from "@/lib/workbench-sessions";
import { Composer } from "./composer";
import { InlineError } from "./inline-error";
import type { ChatConfigurationState } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useMentionAgents } from "../use-mention-agents";
import { type OpenCreatedSession, useFirstSend } from "../use-first-send";

export interface NewSessionVariant {
  readonly id: string;
  readonly baseDisplayName: string | null;
  readonly failure: VariantLine | null;
}

interface NewSessionChatProps {
  readonly agentName: string;
  readonly agentDisplayName?: string | null;
  readonly configuration: WorkbenchConfiguration | null;
  readonly variant?: NewSessionVariant | null;
  readonly configurationError?: string | null;
  readonly onOpen?: OpenCreatedSession;
  readonly onNew?: () => void;
  readonly streamEnd?: ReactNode;
}

const NO_CHANGE = () => undefined;

function fixedConfiguration(
  configuration: WorkbenchConfiguration | null,
): ChatConfigurationState | null {
  if (configuration === null) return null;
  return {
    configuration,
    agentProviders: [configuration.agent_provider],
    models: [configuration.model_identifier],
    reasoningEfforts: [configuration.reasoning_effort],
    modelsFailure: null,
    failure: null,
    pending: true,
    disabled: false,
    selectAgentProvider: NO_CHANGE,
    selectModel: NO_CHANGE,
    selectReasoningEffort: NO_CHANGE,
  };
}

export function NewSessionChat({
  agentName,
  agentDisplayName = null,
  configuration,
  variant = null,
  configurationError = null,
  onOpen,
  onNew = NO_CHANGE,
  streamEnd = null,
}: NewSessionChatProps) {
  const navigate = useNavigate();
  const openByRoute = useCallback<OpenCreatedSession>(
    (sessionId, failure) =>
      navigate(workbenchSessionPath(sessionId), {
        replace: true,
        state: failure === null ? undefined : { firstSendFailure: failure },
      }),
    [navigate],
  );
  const first = useFirstSend(agentName, configuration, onOpen ?? openByRoute, variant?.id ?? null);
  const mentionAgents = useMentionAgents();
  const mentionNames = mentionAgents.names;
  const composer = useComposer(first.busy || configuration === null, first.send, {
    agentName,
    onNew,
    fork: first.send,
    mentionNames,
    mentionLabels: mentionAgents.labels,
  });
  const variantFailure = variant?.failure ?? null;
  const addressee = addresseeOf(composer.draft, [], [], mentionNames);
  const greeting =
    agentDisplayName === null || configuration === null
      ? "Write your first message below to start the conversation."
      : `Hi, I am ${agentDisplayName} on ${configuration.model_identifier}. What do you need?`;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <h2 className="font-mono text-lg font-semibold">
        {variant === null ? agentName : (agentDisplayName ?? agentName)}
      </h2>
      {variant !== null && variant.baseDisplayName !== null && (
        <p className="text-sm text-muted-foreground">variant of {variant.baseDisplayName}</p>
      )}
      <p className="text-sm">{greeting}</p>
      {streamEnd}
      <div className="sticky bottom-0 mt-auto bg-background pt-2">
        <Composer
          composer={composer}
          configuration={fixedConfiguration(configuration)}
          agentDisplayName={agentDisplayName ?? agentName}
          addressee={addressee}
          runActive={false}
          queued={false}
          inputDisabled={configuration === null}
        />
        {configurationError !== null && <InlineError code={null} message={configurationError} />}
        {mentionAgents.failure !== null && (
          <InlineError code={null} message={mentionAgents.failure} />
        )}
        {variantFailure !== null && (
          <InlineError code={variantFailure.code} message={variantFailure.message} />
        )}
        {first.failure !== null && (
          <InlineError code={first.failure.code} message={first.failure.message} />
        )}
      </div>
    </div>
  );
}
