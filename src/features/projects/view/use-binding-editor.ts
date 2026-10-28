import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { BindingSetEntry } from "@/api/types";
import { classifyChange, isGuarded, unavailableOf } from "@/lib/binding-change";
import { type BindingChangeGuardState, useBindingChangeGuard } from "./use-binding-change-guard";
import type { BindingTarget } from "./use-binding-draft";
import { type BindingSetState, useBindingSet } from "./use-binding-set";

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

const ENVIRONMENT_PARAM = "environment";

export function useBindingEditor(projectId: string, onSetWritten: () => void): BindingEditorState {
  const bindings = useBindingSet(projectId, onSetWritten);
  const guard = useBindingChangeGuard(projectId);
  const [chosen, setChosen] = useState<BindingTarget | null>(null);
  const [params, setParams] = useSearchParams();
  const { write, clearFeedback } = bindings;
  const current = bindings.resource.data?.bindings;
  const environmentName = params.get(ENVIRONMENT_PARAM);

  const linked = useMemo<BindingTarget | null>(() => {
    const entry = environmentName === null ? undefined : current?.[environmentName];
    if (environmentName === null || entry?.kind !== "repository") return null;
    return { kind: "repository", name: environmentName, entry, section: "environment" };
  }, [environmentName, current]);
  const target = chosen ?? linked;

  const closeTarget = useCallback(() => {
    setChosen(null);
    clearFeedback();
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(ENVIRONMENT_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [clearFeedback, setParams]);

  const openTarget = useCallback(
    (next: BindingTarget) => {
      clearFeedback();
      setChosen(next);
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
