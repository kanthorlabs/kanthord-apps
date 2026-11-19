import { type KeyboardEvent, useCallback, useMemo, useState } from "react";

import type { WorkbenchMessageDelivery } from "@/api/types";
import { mentionSuggestionsOf } from "@/lib/workbench-mention";
import {
  commandListOf,
  isCommandAvailable,
  parseSlashCommand,
  SLASH_COMMANDS,
  type SlashCommand,
} from "./slash-commands";

const NEWLINE = "\n";
const NO_NAMES: readonly string[] = [];
const NO_LABELS: Readonly<Record<string, string>> = {};

function clearedHint(count: number): string {
  const noun = count === 1 ? "cleared message is" : "cleared messages are";
  return `${count} ${noun} back in your draft`;
}

export interface ComposerOptions {
  readonly agentName: string;
  readonly onNew: () => void;
  readonly fork: (text: string) => Promise<boolean>;
  readonly initialDraft?: string;
  readonly mentionNames?: readonly string[];
  readonly mentionLabels?: Readonly<Record<string, string>>;
  readonly hostMention?: string | null;
}

export interface ComposerState {
  readonly draft: string;
  readonly canSend: boolean;
  readonly disabled: boolean;
  readonly commands: readonly SlashCommand[];
  readonly listOpen: boolean;
  readonly activeCommand: SlashCommand | null;
  readonly mentions: readonly string[];
  readonly mentionLabels?: Readonly<Record<string, string>>;
  readonly mentionsOpen: boolean;
  readonly activeMention: string | null;
  readonly hint: string | null;
  readonly setDraft: (draft: string) => void;
  readonly submit: (delivery?: WorkbenchMessageDelivery) => void;
  readonly refill: (texts: readonly string[], cleared?: boolean) => void;
  readonly focus: () => void;
  readonly blur: () => void;
  readonly pick: (command: SlashCommand) => void;
  readonly pickMention: (name: string) => void;
  readonly handleKey: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useComposer(
  disabled: boolean,
  send: (text: string, delivery: WorkbenchMessageDelivery) => Promise<boolean>,
  {
    agentName,
    onNew,
    fork,
    initialDraft = "",
    mentionNames = NO_NAMES,
    mentionLabels = NO_LABELS,
    hostMention = null,
  }: ComposerOptions,
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
  const mentions = useMemo(() => mentionSuggestionsOf(draft, mentionNames), [draft, mentionNames]);
  const mentionsOpen = !disabled && focused && !dismissed && mentions.length > 0;
  const activeMention = mentionsOpen ? (mentions[Math.max(activeIndex, 0)] ?? null) : null;
  const optionCount = listOpen ? commands.length : mentionsOpen ? mentions.length : 0;
  const currentIndex = mentionsOpen ? Math.max(activeIndex, 0) : activeIndex;

  const setDraft = useCallback((value: string) => {
    setDraftValue(value);
    setDismissed(false);
    setActiveIndex(-1);
    setHint(null);
  }, []);

  const prepend = useCallback((texts: readonly string[]) => {
    const joined = texts.join(NEWLINE);
    setDraftValue((current) => (current === "" ? joined : `${joined}${NEWLINE}${current}`));
  }, []);

  const refill = useCallback(
    (texts: readonly string[], cleared = false) => {
      if (texts.length === 0) return;
      prepend(texts);
      if (cleared) setHint(clearedHint(texts.length));
    },
    [prepend],
  );

  const dispatch = useCallback(
    (run: () => Promise<boolean>) => {
      const previous = draft;
      setDraftValue("");
      setDismissed(true);
      setHint(null);
      void run().then((done) => {
        if (!done && previous !== "") prepend([previous]);
      });
    },
    [draft, prepend],
  );

  const sendText = useCallback(
    (value: string, delivery: WorkbenchMessageDelivery) => dispatch(() => send(value, delivery)),
    [dispatch, send],
  );

  const commandTextOf = useCallback(
    (commandText: string) =>
      hostMention === null ? commandText : `@${hostMention} ${commandText}`,
    [hostMention],
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
      sendText(commandTextOf(command.text), "queue");
    },
    [disabled, runNew, sendText, commandTextOf],
  );

  const pickMention = useCallback(
    (name: string) => {
      if (disabled) return;
      setDraft(`@${name} `);
    },
    [disabled, setDraft],
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
        sendText(commandTextOf(command.text), delivery);
        return;
      }
      if (parsed.text !== null) {
        const forkText = parsed.text;
        dispatch(() => fork(forkText));
        return;
      }
      runNew();
    },
    [canSend, draft, agentName, text, sendText, commandTextOf, dispatch, fork, runNew],
  );

  const focus = useCallback(() => {
    setFocused(true);
    setDismissed(false);
  }, []);

  const blur = useCallback(() => setFocused(false), []);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (optionCount > 0 && event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        return;
      }
      if (optionCount > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const entry = step > 0 ? 0 : optionCount - 1;
        setActiveIndex(
          currentIndex < 0 ? entry : (currentIndex + step + optionCount) % optionCount,
        );
        return;
      }
      const picksMention = event.key === "Tab" && !event.shiftKey && activeMention !== null;
      if (!picksMention && (event.key !== "Enter" || event.shiftKey)) return;
      event.preventDefault();
      if (activeCommand !== null) {
        pick(activeCommand);
        return;
      }
      if (activeMention !== null) {
        pickMention(activeMention);
        return;
      }
      submit();
    },
    [optionCount, currentIndex, activeCommand, activeMention, pick, pickMention, submit],
  );

  return {
    draft,
    canSend,
    disabled,
    commands,
    listOpen,
    activeCommand,
    mentions,
    mentionLabels,
    mentionsOpen,
    activeMention,
    hint,
    setDraft,
    submit,
    refill,
    focus,
    blur,
    pick,
    pickMention,
    handleKey,
  };
}
