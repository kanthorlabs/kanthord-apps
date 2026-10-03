import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { useInstanceForm, type InstanceFormState } from "./use-instance-form";
import { useInstanceRemoval, type InstanceRemovalState } from "./use-instance-removal";
import { useInstanceVerify, type InstanceVerifyState } from "./use-instance-verify";
import type { InstancesState } from "./use-instances";

export interface InstanceManagerState {
  readonly open: boolean;
  readonly dialogRef: RefObject<HTMLDivElement | null>;
  readonly verify: InstanceVerifyState;
  readonly form: InstanceFormState;
  readonly removal: InstanceRemovalState;
  readonly openList: () => void;
  readonly openAdd: () => void;
  readonly onOpenChange: (open: boolean) => void;
}

export function useInstanceManager(store: InstancesState): InstanceManagerState {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousKind = useRef<InstanceFormState["mode"]["kind"]>("list");
  const verify = useInstanceVerify();
  const form = useInstanceForm(store.save, verify);
  const removal = useInstanceRemoval(store, verify.clear);
  const { close, startAdd } = form;
  const kind = form.mode.kind;

  useEffect(() => {
    if (open && kind === "list" && previousKind.current !== "list") dialogRef.current?.focus();
    previousKind.current = kind;
  }, [open, kind]);

  const openList = useCallback(() => {
    close();
    setOpen(true);
  }, [close]);

  const openAdd = useCallback(() => {
    startAdd();
    setOpen(true);
  }, [startAdd]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) close();
      setOpen(next);
    },
    [close],
  );

  return { open, dialogRef, verify, form, removal, openList, openAdd, onOpenChange };
}
