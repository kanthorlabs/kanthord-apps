import { useCallback, useState } from "react";

import { byteUsage, PROMPT_TEXT_MAX_BYTES, utf8Bytes } from "@/lib/prompt-text";

export interface ProjectPromptDialogState {
  readonly open: boolean;
  readonly draft: string;
  readonly usage: string;
  readonly tooLarge: boolean;
  readonly start: () => void;
  readonly setDraft: (text: string) => void;
  readonly apply: () => void;
  readonly cancel: () => void;
}

export function useProjectPromptDialog(
  current: string,
  write: (text: string) => void,
): ProjectPromptDialogState {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const tooLarge = utf8Bytes(draft) > PROMPT_TEXT_MAX_BYTES;

  const start = useCallback(() => {
    setDraft(current);
    setOpen(true);
  }, [current]);

  const apply = useCallback(() => {
    if (tooLarge) return;
    write(draft);
    setOpen(false);
  }, [write, draft, tooLarge]);

  const cancel = useCallback(() => setOpen(false), []);

  return { open, draft, usage: byteUsage(draft), tooLarge, start, setDraft, apply, cancel };
}
