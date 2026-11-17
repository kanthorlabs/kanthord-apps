import { ArrowUpIcon } from "lucide-react";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { GUEST_NOTE_HINT } from "@/lib/guest-chat";
import type { Addressee } from "@/lib/workbench-mention";
import type { ChatConfigurationState } from "../use-chat-configuration";
import type { ComposerState } from "../use-composer";
import { ComposerPicker } from "./composer-picker";
import { StopConfirm, type StopConfirmProps } from "./stop-confirm";

const RUNNING_PLACEHOLDER = "Message · sends after this run";
const SHARED_PLACEHOLDER = "Note to everyone · start with @ to ask an agent";

function idlePlaceholder(agentDisplayName: string): string {
  return `Message ${agentDisplayName} · / for commands`;
}

function sharedHintOf(addressee: Addressee | null): string {
  return addressee?.source === "mention" ? `To @${addressee.displayName}` : GUEST_NOTE_HINT;
}

interface ComposerProps {
  readonly composer: ComposerState;
  readonly configuration: ChatConfigurationState | null;
  readonly agentDisplayName: string;
  readonly addressee?: Addressee | null;
  readonly runActive: boolean;
  readonly queued: boolean;
  readonly stopConfirm?: StopConfirmProps | null;
  readonly placeholder?: string;
  readonly inputDisabled?: boolean;
  readonly newCommandHint?: string;
  readonly shared?: boolean;
}

export function Composer({
  composer,
  configuration,
  agentDisplayName,
  addressee = null,
  runActive,
  queued,
  stopConfirm = null,
  placeholder,
  inputDisabled = false,
  newCommandHint,
  shared = false,
}: ComposerProps) {
  const listId = useId();
  const pickersDisabled = runActive || queued;
  const inputPlaceholder =
    placeholder ??
    (shared
      ? SHARED_PLACEHOLDER
      : runActive
        ? RUNNING_PLACEHOLDER
        : idlePlaceholder(agentDisplayName));
  const optionId = (id: string) => `${listId}-${id}`;
  const expanded = composer.listOpen || composer.mentionsOpen;
  const activeOptionId =
    composer.activeCommand === null ? undefined : optionId(composer.activeCommand.id);
  const activeMentionId =
    composer.activeMention === null
      ? undefined
      : optionId(`mention-${composer.mentions.indexOf(composer.activeMention)}`);
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
        <Card size="sm" className="absolute right-0 bottom-full left-0 z-40 mb-2 py-1">
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
                  <ItemDescription>
                    {command.id === "new" && newCommandHint !== undefined
                      ? newCommandHint
                      : command.description}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </Card>
      )}
      {composer.mentionsOpen && (
        <Card size="sm" className="absolute right-0 bottom-full left-0 z-40 mb-2 py-1">
          <ItemGroup
            id={listId}
            role="listbox"
            aria-label="Mentions"
            className="gap-0"
            onMouseDown={(event) => event.preventDefault()}
          >
            {composer.mentions.map((name, index) => (
              <Item
                key={name}
                id={optionId(`mention-${index}`)}
                role="option"
                size="xs"
                aria-selected={composer.activeMention === name}
                data-active={composer.activeMention === name}
                className="cursor-pointer data-[active=true]:bg-muted"
                onClick={() => composer.pickMention(name)}
              >
                <ItemContent>
                  <ItemTitle>{name}</ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </Card>
      )}
      {stopConfirm !== null && <StopConfirm {...stopConfirm} />}
      <InputGroup>
        <div className="flex w-full items-end gap-2 pr-2">
          <InputGroupTextarea
            role="combobox"
            aria-label="Message"
            aria-expanded={expanded}
            aria-controls={expanded ? listId : undefined}
            aria-activedescendant={activeOptionId ?? activeMentionId}
            aria-autocomplete="list"
            placeholder={inputPlaceholder}
            disabled={inputDisabled}
            rows={2}
            value={composer.draft}
            onChange={(event) => composer.setDraft(event.target.value)}
            onFocus={composer.focus}
            onBlur={composer.blur}
            onKeyDown={composer.handleKey}
          />
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            aria-label="Send"
            className="mb-2"
            disabled={!composer.canSend}
          >
            <ArrowUpIcon aria-hidden="true" />
          </InputGroupButton>
        </div>
        {configuration !== null && (
          <InputGroupAddon align="block-end" className="flex-wrap gap-2">
            <ComposerPicker
              label="Agent Provider"
              value={configuration.configuration.agent_provider}
              options={configuration.agentProviders}
              disabled={configuration.pending || configuration.disabled || pickersDisabled}
              onChange={configuration.selectAgentProvider}
            />
            <ComposerPicker
              label="Model"
              value={configuration.configuration.model_identifier}
              options={configuration.models}
              disabled={configuration.pending || configuration.disabled || pickersDisabled}
              onChange={configuration.selectModel}
            />
            <ComposerPicker
              label="Reasoning Effort"
              value={configuration.configuration.reasoning_effort}
              options={configuration.reasoningEfforts}
              disabled={configuration.pending || configuration.disabled || pickersDisabled}
              onChange={configuration.selectReasoningEffort}
            />
          </InputGroupAddon>
        )}
      </InputGroup>
      {!shared && addressee !== null && (
        <Badge variant="outline" aria-label="Addressee" className="mt-1">
          To @{addressee.displayName}
          {addressee.source === "last-answer" && " (last answer)"}
        </Badge>
      )}
      <p role="status" className="mt-1 min-h-5 text-sm text-muted-foreground">
        {composer.hint ?? (shared ? sharedHintOf(addressee) : null)}
      </p>
    </form>
  );
}
