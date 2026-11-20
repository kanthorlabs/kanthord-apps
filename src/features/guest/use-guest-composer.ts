import { type KeyboardEvent, useCallback, useMemo, useState } from "react";

import type { Connection } from "@/api/client";
import { sendGuestMessage } from "@/api/resources/workbench";
import { asApiError } from "@/hooks/use-resource";
import { GUEST_NOTE_HINT, type GuestLine, guestLineOf } from "@/lib/guest-chat";
import { guestMentionRefusalOf, mentionSuggestionsOf } from "@/lib/workbench-mention";
import type { ComposerState } from "@/features/workbench/chat/use-composer";

export interface GuestComposerState {
  readonly composer: ComposerState;
  readonly failure: GuestLine | null;
}

const NO_OPTIONS: readonly never[] = [];
const NO_OP = (): void => undefined;

export function useGuestComposer(
  connection: Connection,
  mentionNames: readonly string[],
): GuestComposerState {
  const [draft, setDraftValue] = useState("");
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const text = draft.trim();
  const canSend = !pending && text !== "";
  const mentions = useMemo(() => mentionSuggestionsOf(draft, mentionNames), [draft, mentionNames]);
  const mentionsOpen = !pending && focused && !dismissed && mentions.length > 0;
  const activeMention = mentionsOpen ? (mentions[Math.max(activeIndex, 0)] ?? null) : null;

  const setDraft = useCallback((value: string) => {
    setDraftValue(value);
    setDismissed(false);
    setActiveIndex(-1);
    setFailure(null);
  }, []);

  const pickMention = useCallback(
    (name: string) => {
      if (!pending) setDraft(`@${name} `);
    },
    [pending, setDraft],
  );

  const focus = useCallback(() => {
    setFocused(true);
    setDismissed(false);
  }, []);

  const blur = useCallback(() => setFocused(false), []);

  const submit = useCallback(() => {
    if (!canSend) return;
    const refusal = guestMentionRefusalOf(text, mentionNames);
    if (refusal !== null) {
      setFailure({ code: null, message: refusal });
      return;
    }
    setPending(true);
    setFailure(null);
    sendGuestMessage(connection, { text })
      .then(() => setDraftValue(""))
      .catch((cause: unknown) => setFailure(guestLineOf(asApiError(cause))))
      .finally(() => setPending(false));
  }, [canSend, connection, text, mentionNames]);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (mentionsOpen && event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        return;
      }
      if (mentionsOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        const current = Math.max(activeIndex, 0);
        const first = step > 0 ? 0 : mentions.length - 1;
        setActiveIndex(
          activeIndex < 0 ? first : (current + step + mentions.length) % mentions.length,
        );
        return;
      }
      const picksMention = event.key === "Tab" && !event.shiftKey && activeMention !== null;
      if (!picksMention && (event.key !== "Enter" || event.shiftKey)) return;
      event.preventDefault();
      if (activeMention !== null) {
        pickMention(activeMention);
        return;
      }
      submit();
    },
    [mentionsOpen, mentions.length, activeIndex, activeMention, pickMention, submit],
  );

  const composer = useMemo<ComposerState>(
    () => ({
      draft,
      canSend,
      disabled: pending,
      commands: NO_OPTIONS,
      listOpen: false,
      activeCommand: null,
      mentions,
      mentionsOpen,
      activeMention,
      hint: GUEST_NOTE_HINT,
      setDraft,
      submit,
      refill: NO_OP,
      focus,
      blur,
      pick: NO_OP,
      pickMention,
      handleKey,
    }),
    [
      draft,
      canSend,
      pending,
      mentions,
      mentionsOpen,
      activeMention,
      setDraft,
      submit,
      focus,
      blur,
      pickMention,
      handleKey,
    ],
  );

  return { composer, failure };
}
