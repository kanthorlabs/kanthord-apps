import { type KeyboardEvent, useCallback, useMemo, useState } from "react";

import type { WorkbenchMessageDelivery } from "@/api/types";
import {
  commandListOf,
  isCommandAvailable,
  parseSlashCommand,
  SLASH_COMMANDS,
  type SlashCommand,
} from "./slash-commands";

const NEW_TAKES_NO_TEXT = "/new takes no text yet";
const BLANK_LINE = "\n\n";

export interface ComposerOptions {
  readonly agentName: string;
  readonly onNew: () => void;
  readonly initialDraft?: string;
}

export interface ComposerState {
  readonly draft: string;
  readonly canSend: boolean;
  readonly disabled: boolean;
  readonly commands: readonly SlashCommand[];
  readonly listOpen: boolean;
  readonly activeCommand: SlashCommand | null;
  readonly hint: string | null;
  readonly setDraft: (draft: string) => void;
  readonly submit: (delivery?: WorkbenchMessageDelivery) => void;
  readonly refill: (texts: readonly string[], hint?: string) => void;
  readonly focus: () => void;
  readonly blur: () => void;
  readonly pick: (command: SlashCommand) => void;
  readonly handleKey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useComposer(
  disabled: boolean,
  send: (text: string, delivery: WorkbenchMessageDelivery) => Promise<boolean>,
  { agentName, onNew, initialDraft = "" }: ComposerOptions,
): ComposerState {
  const [draft, setDraftValue] = useState(initialDraft);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hint, setHint] = useState<string | null>(null);
  const text = draft.trim();
  const canSend = !disabled && text !== "";
  const commands = useMemo(() => commandListOf(draft, agentName), [draft, agentName]);
  const listOpen = !disabled && focused && !dismissed && commands.length > 0;
  const activeCommand = listOpen ? (commands[activeIndex] ?? null) : null;

  const setDraft = useCallback((value: string) => {
    setDraftValue(value);
    setDismissed(false);
    setActiveIndex(-1);
    setHint(null);
  }, []);

  const refill = useCallback((texts: readonly string[], notice?: string) => {
    if (texts.length === 0) return;
    const joined = texts.join(BLANK_LINE);
    setDraftValue((current) => (current === "" ? joined : `${joined}${BLANK_LINE}${current}`));
    if (notice !== undefined) setHint(notice);
  }, []);

  const sendText = useCallback(
    (value: string, delivery: WorkbenchMessageDelivery) => {
      const previous = draft;
      setDraftValue("");
      setDismissed(true);
      void send(value, delivery).then((sent) => {
        if (!sent && previous !== "") refill([previous]);
      });
    },
    [send, draft, refill],
  );

  const runNew = useCallback(() => {
    setDraftValue("");
    onNew();
  }, [onNew]);

  const pick = useCallback(
    (command: SlashCommand) => {
      if (disabled) return;
      setDismissed(true);
      if (command.text === null) {
        runNew();
        return;
      }
      sendText(command.text, "queue");
    },
    [disabled, runNew, sendText],
  );

  const submit = useCallback(
    (delivery: WorkbenchMessageDelivery = "queue") => {
      if (!canSend) return;
      const parsed = parseSlashCommand(draft);
      const command = SLASH_COMMANDS.find((entry) => entry.id === parsed?.command);
      if (parsed === null || command === undefined || !isCommandAvailable(command, agentName)) {
        sendText(text, delivery);
        return;
      }
      if (command.text !== null) {
        sendText(command.text, delivery);
        return;
      }
      if (parsed.text !== null) {
        setHint(NEW_TAKES_NO_TEXT);
        return;
      }
      runNew();
    },
    [canSend, draft, agentName, text, sendText, runNew],
  );

  const focus = useCallback(() => {
    setFocused(true);
    setDismissed(false);
  }, []);

  const blur = useCallback(() => setFocused(false), []);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (listOpen && event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        return;
      }
      if (listOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((index) =>
          index < 0
            ? step > 0
              ? 0
              : commands.length - 1
            : (index + step + commands.length) % commands.length,
        );
        return;
      }
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      if (activeCommand !== null) {
        pick(activeCommand);
        return;
      }
      submit();
    },
    [listOpen, commands.length, activeCommand, pick, submit],
  );

  return {
    draft,
    canSend,
    disabled,
    commands,
    listOpen,
    activeCommand,
    hint,
    setDraft,
    submit,
    refill,
    focus,
    blur,
    pick,
    handleKey,
  };
}
