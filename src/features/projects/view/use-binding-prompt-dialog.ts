import { useCallback, useState } from "react";

import type { BindingPromptAgent } from "@/api/types";
import { byteUsage, promptTextProblem } from "@/lib/prompt-text";

export interface BindingPromptDialogState {
  readonly agent: BindingPromptAgent;
  readonly open: boolean;
  readonly draft: string;
  readonly usage: string;
  readonly problem: string | null;
  readonly start: () => void;
  readonly setDraft: (text: string) => void;
  readonly apply: () => void;
  readonly cancel: () => void;
}

export function useBindingPromptDialog(
  agent: BindingPromptAgent,
  current: string,
  write: (text: string) => void,
): BindingPromptDialogState {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(current);
  const problem = promptTextProblem(draft);

  const start = useCallback(() => {
    setDraft(current);
    setOpen(true);
  }, [current]);

  const apply = useCallback(() => {
    if (problem !== null) return;
    write(draft);
    setOpen(false);
  }, [write, draft, problem]);

  const cancel = useCallback(() => setOpen(false), []);

  return { agent, open, draft, usage: byteUsage(draft), problem, start, setDraft, apply, cancel };
}
