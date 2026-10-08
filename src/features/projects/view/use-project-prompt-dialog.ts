import { useCallback, useState } from "react";

export interface ProjectPromptDialogState {
  readonly open: boolean;
  readonly draft: string;
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

  const start = useCallback(() => {
    setDraft(current);
    setOpen(true);
  }, [current]);

  const apply = useCallback(() => {
    write(draft);
    setOpen(false);
  }, [write, draft]);

  const cancel = useCallback(() => setOpen(false), []);

  return { open, draft, start, setDraft, apply, cancel };
}
