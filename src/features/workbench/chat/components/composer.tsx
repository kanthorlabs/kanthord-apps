import { ArrowUpIcon, SquareIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import type { ChatConfigurationState } from "../use-chat-configuration";
import type { ComposerState } from "../use-composer";
import { ComposerPicker } from "./composer-picker";

interface ComposerProps {
  readonly composer: ComposerState;
  readonly configuration: ChatConfigurationState;
  readonly runActive: boolean;
  readonly onStop: () => void;
}

export function Composer({ composer, configuration, runActive, onStop }: ComposerProps) {
  return (
    <form
      aria-label="Composer"
      onSubmit={(event) => {
        event.preventDefault();
        composer.submit();
      }}
    >
      <InputGroup>
        <InputGroupTextarea
          aria-label="Message"
          placeholder="Message the agent"
          rows={2}
          value={composer.draft}
          onChange={(event) => composer.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            composer.submit();
          }}
        />
        <InputGroupAddon align="block-end" className="flex-wrap gap-2">
          <ComposerPicker
            label="Agent Provider"
            value={configuration.configuration.agentProvider}
            options={configuration.agentProviders}
            disabled={configuration.pending}
            onChange={configuration.selectAgentProvider}
          />
          <ComposerPicker
            label="Model"
            value={configuration.configuration.modelIdentifier}
            options={configuration.models}
            disabled={configuration.pending}
            onChange={configuration.selectModel}
          />
          <ComposerPicker
            label="Reasoning Effort"
            value={configuration.configuration.reasoningEffort}
            options={configuration.reasoningEfforts}
            disabled={configuration.pending}
            onChange={configuration.selectReasoningEffort}
          />
          <div className="ml-auto flex">
            {runActive ? (
              <InputGroupButton variant="default" size="icon-sm" aria-label="Stop" onClick={onStop}>
                <SquareIcon aria-hidden="true" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                aria-label="Send"
                disabled={!composer.canSend}
              >
                <ArrowUpIcon aria-hidden="true" />
              </InputGroupButton>
            )}
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
