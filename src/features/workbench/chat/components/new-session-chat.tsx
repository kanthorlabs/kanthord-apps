import { type ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import type { WorkbenchConfiguration } from "@/api/types";
import { workbenchSessionPath } from "@/lib/workbench-sessions";
import { Composer } from "./composer";
import { InlineError } from "./inline-error";
import type { ChatConfigurationState } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { type OpenCreatedSession, useFirstSend } from "../use-first-send";

interface NewSessionChatProps {
  readonly agentName: string;
  readonly agentDisplayName: string;
  readonly configuration: WorkbenchConfiguration | null;
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
    selectAgentProvider: NO_CHANGE,
    selectModel: NO_CHANGE,
    selectReasoningEffort: NO_CHANGE,
  };
}

export function NewSessionChat({
  agentName,
  agentDisplayName,
  configuration,
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
  const first = useFirstSend(agentName, configuration, onOpen ?? openByRoute);
  const composer = useComposer(first.busy || configuration === null, first.send, {
    agentName,
    onNew,
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <h2 className="font-mono text-lg font-semibold">{agentName}</h2>
      <p className="text-sm">
        Hello, I am {agentDisplayName}. Write your first message below to start the conversation.
      </p>
      {streamEnd}
      <div className="sticky bottom-0 mt-auto bg-background pt-2">
        <Composer
          composer={composer}
          configuration={fixedConfiguration(configuration)}
          runActive={false}
          onStop={NO_CHANGE}
          inputDisabled={configuration === null}
        />
        {configurationError !== null && <InlineError code={null} message={configurationError} />}
        {first.failure !== null && (
          <InlineError code={first.failure.code} message={first.failure.message} />
        )}
      </div>
    </div>
  );
}
