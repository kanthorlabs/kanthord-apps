import { useCallback, useState } from "react";

import type { BindingSetEntry } from "@/api/types";
import { classifyChange, isGuarded, unavailableOf } from "@/lib/binding-change";
import { useBindingChangeGuard, type BindingChangeGuardState } from "./use-binding-change-guard";
import type { BindingTarget } from "./use-binding-draft";
import { useBindingSet, type BindingSetState } from "./use-binding-set";

export interface BindingEditorState {
  readonly bindings: BindingSetState;
  readonly guard: BindingChangeGuardState;
  readonly target: BindingTarget | null;
  readonly openTarget: (target: BindingTarget) => void;
  readonly closeTarget: () => void;
  readonly propose: (name: string, after: BindingSetEntry | null) => void;
  readonly confirmGuarded: () => void;
  readonly takeSaferPath: () => void;
}

export function useBindingEditor(projectId: string): BindingEditorState {
  const bindings = useBindingSet(projectId);
  const guard = useBindingChangeGuard(projectId);
  const [target, setTarget] = useState<BindingTarget | null>(null);
  const { write, clearFeedback } = bindings;
  const current = bindings.resource.data?.bindings;

  const closeTarget = useCallback(() => {
    setTarget(null);
    clearFeedback();
  }, [clearFeedback]);

  const openTarget = useCallback(
    (next: BindingTarget) => {
      clearFeedback();
      setTarget(next);
    },
    [clearFeedback],
  );

  const propose = useCallback(
    (name: string, after: BindingSetEntry | null) => {
      const before = current?.[name];
      const kind = classifyChange(name, before, after);
      if (isGuarded(kind)) {
        guard.open({ name, before, after, kind });
        return;
      }
      write(name, after, closeTarget);
    },
    [current, guard, write, closeTarget],
  );

  const commitGuarded = useCallback(
    (entry: BindingSetEntry | null) => {
      const change = guard.change;
      if (change === null) return;
      write(change.name, entry, () => {
        guard.close();
        closeTarget();
      });
    },
    [guard, write, closeTarget],
  );

  const confirmGuarded = useCallback(
    () => commitGuarded(guard.change?.after ?? null),
    [commitGuarded, guard.change],
  );

  const takeSaferPath = useCallback(() => {
    const before = guard.change?.before;
    if (before !== undefined) commitGuarded(unavailableOf(before));
  }, [commitGuarded, guard.change]);

  return {
    bindings,
    guard,
    target,
    openTarget,
    closeTarget,
    propose,
    confirmGuarded,
    takeSaferPath,
  };
}
