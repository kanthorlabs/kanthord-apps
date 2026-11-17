import { type KeyboardEvent, useCallback, useMemo, useState } from "react";

import type { Connection } from "@/api/client";
import { sendGuestMessage } from "@/api/resources/workbench";
import { asApiError } from "@/hooks/use-resource";
import { GUEST_NOTE_HINT, type GuestLine, guestLineOf } from "@/lib/guest-chat";
import type { ComposerState } from "@/features/workbench/chat/use-composer";

export interface GuestComposerState {
  readonly composer: ComposerState;
  readonly failure: GuestLine | null;
}

const NO_OPTIONS: readonly never[] = [];
const NO_OP = (): void => undefined;

export function useGuestComposer(connection: Connection): GuestComposerState {
  const [draft, setDraftValue] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const text = draft.trim();
  const canSend = !pending && text !== "";

  const setDraft = useCallback((value: string) => {
    setDraftValue(value);
    setFailure(null);
  }, []);

  const submit = useCallback(() => {
    if (!canSend) return;
    setPending(true);
    setFailure(null);
    sendGuestMessage(connection, { text })
      .then(() => setDraftValue(""))
      .catch((cause: unknown) => setFailure(guestLineOf(asApiError(cause))))
      .finally(() => setPending(false));
  }, [canSend, connection, text]);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const composer = useMemo<ComposerState>(
    () => ({
      draft,
      canSend,
      disabled: pending,
      commands: NO_OPTIONS,
      listOpen: false,
      activeCommand: null,
      mentions: NO_OPTIONS,
      mentionsOpen: false,
      activeMention: null,
      hint: GUEST_NOTE_HINT,
      setDraft,
      submit,
      refill: NO_OP,
      focus: NO_OP,
      blur: NO_OP,
      pick: NO_OP,
      pickMention: NO_OP,
      handleKey,
    }),
    [draft, canSend, pending, setDraft, submit, handleKey],
  );

  return { composer, failure };
}
