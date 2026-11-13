import type { WorkbenchConfiguration } from "@/api/types";
import { Composer } from "./composer";
import { InlineError } from "./inline-error";
import type { ChatConfigurationState } from "../use-chat-configuration";
import { useComposer } from "../use-composer";
import { useFirstSend } from "../use-first-send";

interface NewSessionChatProps {
  readonly agentName: string;
  readonly agentDisplayName: string;
  readonly configuration: WorkbenchConfiguration;
}

const NO_CHANGE = () => undefined;

function fixedConfiguration(configuration: WorkbenchConfiguration): ChatConfigurationState {
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
}: NewSessionChatProps) {
  const first = useFirstSend(agentName, configuration);
  const composer = useComposer(first.busy, first.send);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <h2 className="font-mono text-lg font-semibold">{agentName}</h2>
      <p className="text-sm">
        Hello, I am {agentDisplayName}. Write your first message below to start the conversation.
      </p>
      <div className="sticky bottom-0 mt-auto bg-background pt-2">
        <Composer
          composer={composer}
          configuration={fixedConfiguration(configuration)}
          runActive={false}
          onStop={NO_CHANGE}
        />
        {first.failure !== null && (
          <InlineError code={first.failure.code} message={first.failure.message} />
        )}
      </div>
    </div>
  );
}
