import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useId } from "react";

import { Card } from "@/components/ui/card";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
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
  const listId = useId();
  const optionId = (id: string) => `${listId}-${id}`;
  return (
    <form
      aria-label="Composer"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        composer.submit();
      }}
    >
      {composer.listOpen && (
        <Card size="sm" className="absolute right-0 bottom-full left-0 z-10 mb-2 py-1">
          <ItemGroup
            id={listId}
            role="listbox"
            aria-label="Commands"
            className="gap-0"
            onMouseDown={(event) => event.preventDefault()}
          >
            {composer.commands.map((command) => (
              <Item
                key={command.id}
                id={optionId(command.id)}
                role="option"
                size="xs"
                aria-selected={composer.activeCommand?.id === command.id}
                data-active={composer.activeCommand?.id === command.id}
                className="cursor-pointer data-[active=true]:bg-muted"
                onClick={() => composer.pick(command)}
              >
                <ItemContent>
                  <ItemTitle className="font-mono">{command.name}</ItemTitle>
                  <ItemDescription>{command.description}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </Card>
      )}
      <InputGroup>
        <InputGroupTextarea
          role="combobox"
          aria-label="Message"
          aria-expanded={composer.listOpen}
          aria-controls={composer.listOpen ? listId : undefined}
          aria-activedescendant={
            composer.activeCommand === null ? undefined : optionId(composer.activeCommand.id)
          }
          aria-autocomplete="list"
          placeholder="Message the agent"
          rows={2}
          value={composer.draft}
          onChange={(event) => composer.setDraft(event.target.value)}
          onFocus={composer.focus}
          onBlur={composer.blur}
          onKeyDown={composer.handleKey}
        />
        <InputGroupAddon align="block-end" className="flex-wrap gap-2">
          <ComposerPicker
            label="Agent Provider"
            value={configuration.configuration.agent_provider}
            options={configuration.agentProviders}
            disabled={configuration.pending}
            onChange={configuration.selectAgentProvider}
          />
          <ComposerPicker
            label="Model"
            value={configuration.configuration.model_identifier}
            options={configuration.models}
            disabled={configuration.pending}
            onChange={configuration.selectModel}
          />
          <ComposerPicker
            label="Reasoning Effort"
            value={configuration.configuration.reasoning_effort}
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
      {composer.hint !== null && (
        <p role="status" className="mt-1 text-sm text-muted-foreground">
          {composer.hint}
        </p>
      )}
    </form>
  );
}
