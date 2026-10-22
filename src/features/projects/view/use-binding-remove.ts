import { useCallback, useState } from "react";
import { toast } from "sonner";

import { readBindingSet, writeBindingSet } from "@/api/resources/projects";
import type { BindingSet, BindingSetEntry } from "@/api/types";
import { credentialMessage } from "@/features/credentials/credential-message";
import { asApiError } from "@/hooks/use-resource";
import { classifyChange, nextBindings, unavailableOf } from "@/lib/binding-change";
import { useBindingChangeGuard, type BindingChangeGuardState } from "./use-binding-change-guard";
import { VERSION_CONFLICT } from "./use-binding-set";

export interface BindingRemoveState {
  readonly guard: BindingChangeGuardState;
  readonly reading: boolean;
  readonly saving: boolean;
  readonly request: () => void;
  readonly confirm: () => void;
  readonly takeSaferPath: () => void;
}

export function useBindingRemove(
  projectId: string,
  bindingName: string,
  onChanged: () => void,
): BindingRemoveState {
  const guard = useBindingChangeGuard(projectId);
  const [set, setSet] = useState<BindingSet | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { open, close, change } = guard;

  const request = useCallback(() => {
    if (reading || saving) return;
    setReading(true);
    readBindingSet(projectId).then(
      (current) => {
        setReading(false);
        setSet(current);
        const before = current.bindings[bindingName];
        if (before === undefined) {
          toast.info(`${bindingName} is no longer in the binding set.`);
          onChanged();
          return;
        }
        open({
          name: bindingName,
          before,
          after: null,
          kind: classifyChange(bindingName, before, null),
        });
      },
      (cause: unknown) => {
        setReading(false);
        toast.error("The binding set was not read.", {
          description: asApiError(cause).message,
        });
      },
    );
  }, [reading, saving, projectId, bindingName, open, onChanged]);

  const write = useCallback(
    (entry: BindingSetEntry | null) => {
      if (saving || set === null) return;
      setSaving(true);
      writeBindingSet(projectId, set.version, nextBindings(set.bindings, bindingName, entry)).then(
        () => {
          setSaving(false);
          close();
          toast.success(
            entry === null ? `Removed ${bindingName}.` : `Made ${bindingName} unavailable.`,
          );
          onChanged();
        },
        (cause: unknown) => {
          setSaving(false);
          const failure = asApiError(cause);
          if (failure.status === 409 && failure.detail === VERSION_CONFLICT) {
            close();
            toast.error("Someone else saved the binding set.", {
              description: `Nothing changed. The page now shows the new state. Review ${bindingName} and try again.`,
            });
            onChanged();
            return;
          }
          toast.error(`Changing ${bindingName} failed.`, {
            description: credentialMessage(failure),
          });
        },
      );
    },
    [saving, set, projectId, bindingName, close, onChanged],
  );

  const confirm = useCallback(() => write(change?.after ?? null), [write, change]);

  const takeSaferPath = useCallback(() => {
    if (change?.before !== undefined) write(unavailableOf(change.before));
  }, [write, change]);

  return { guard, reading, saving, request, confirm, takeSaferPath };
}
