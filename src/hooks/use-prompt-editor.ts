import { useCallback, useState } from "react";

import {
  byteUsage,
  PROMPT_TEXT_MAX_BYTES,
  type PromptSaveResult,
  utf8Bytes,
} from "@/lib/prompt-text";

export interface PromptEditorFailure {
  readonly message: string;
  readonly conflict: boolean;
}

export interface PromptEditorState {
  readonly open: boolean;
  readonly draft: string;
  readonly usage: string;
  readonly tooLarge: boolean;
  readonly dirty: boolean;
  readonly canSave: boolean;
  readonly saving: boolean;
  readonly failure: PromptEditorFailure | null;
  readonly confirmingDiscard: boolean;
  readonly start: () => void;
  readonly setDraft: (text: string) => void;
  readonly save: () => void;
  readonly requestClose: () => void;
  readonly keepEditing: () => void;
  readonly discard: () => void;
  readonly loadLatest: () => void;
}

export function usePromptEditor(
  savedText: string,
  saveText: (text: string) => Promise<PromptSaveResult>,
  reload: () => void,
): PromptEditorState {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<PromptEditorFailure | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const tooLarge = utf8Bytes(draft) > PROMPT_TEXT_MAX_BYTES;
  const dirty = open && draft !== savedText;
  const canSave = dirty && !tooLarge && !saving;

  const close = useCallback(() => {
    setOpen(false);
    setConfirmingDiscard(false);
    setFailure(null);
  }, []);

  const start = useCallback(() => {
    setDraft(savedText);
    setFailure(null);
    setOpen(true);
  }, [savedText]);

  const save = useCallback(() => {
    if (!canSave) return;
    setSaving(true);
    setFailure(null);
    saveText(draft).then((result) => {
      setSaving(false);
      if (result.ok) close();
      else setFailure({ message: result.message, conflict: result.conflict });
    });
  }, [canSave, saveText, draft, close]);

  const requestClose = useCallback(() => {
    if (dirty) setConfirmingDiscard(true);
    else close();
  }, [dirty, close]);

  const loadLatest = useCallback(() => {
    setFailure(null);
    reload();
  }, [reload]);

  return {
    open,
    draft,
    usage: byteUsage(draft),
    tooLarge,
    dirty,
    canSave,
    saving,
    failure,
    confirmingDiscard,
    start,
    setDraft,
    save,
    requestClose,
    keepEditing: () => setConfirmingDiscard(false),
    discard: close,
    loadLatest,
  };
}
