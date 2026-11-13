import { type MouseEvent, useState } from "react";

const ACT_SELECTOR = "button:enabled:not([aria-disabled=true]), a";

export interface SheetClose {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly closeOnAct: (event: MouseEvent<HTMLElement>) => void;
}

export function useSheetClose(): SheetClose {
  const [open, setOpen] = useState(false);
  return {
    open,
    setOpen,
    closeOnAct: (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(ACT_SELECTOR) === null) return;
      setOpen(false);
    },
  };
}
