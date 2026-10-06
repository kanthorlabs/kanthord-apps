import { useCallback, useState } from "react";

export interface ComposerState {
  readonly draft: string;
  readonly canSend: boolean;
  readonly setDraft: (draft: string) => void;
  readonly submit: () => void;
}

export function useComposer(
  disabled: boolean,
  send: (text: string) => Promise<boolean>,
): ComposerState {
  const [draft, setDraft] = useState("");
  const text = draft.trim();
  const canSend = !disabled && text !== "";

  const submit = useCallback(() => {
    if (!canSend) return;
    void send(text).then((sent) => {
      if (sent) setDraft("");
    });
  }, [canSend, send, text]);

  return { draft, canSend, setDraft, submit };
}
