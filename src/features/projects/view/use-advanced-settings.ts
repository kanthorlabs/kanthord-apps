import { useState } from "react";

import {
  advancedNeedsAttention,
  holdsAdvancedSettings,
  type DraftErrors,
  type WorkerDraft,
} from "@/lib/binding-draft";

export interface AdvancedSettings {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
}

export function useAdvancedSettings(draft: WorkerDraft, errors: DraftErrors): AdvancedSettings {
  const [chosen, setOpen] = useState<boolean | null>(null);
  const open = advancedNeedsAttention(draft, errors) || (chosen ?? holdsAdvancedSettings(draft));
  return { open, setOpen };
}
