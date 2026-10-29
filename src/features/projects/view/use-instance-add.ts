import { useCallback, useState } from "react";

import { createWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerPlacement } from "@/api/types";
import { credentialMessage } from "@/features/credentials/credential-message";
import { asApiError } from "@/hooks/use-resource";
import { instanceNameError } from "@/lib/instance-host";

export const ADD_PLACEMENTS = ["Server", "Container", "Worker"] as const;

export type AddPlacement = (typeof ADD_PLACEMENTS)[number];

const PLACEMENT_VALUES: Readonly<Record<AddPlacement, WorkerPlacement>> = {
  Server: "server",
  Container: "container",
  Worker: "worker",
};

const NAME_CONFLICT = "worker.instance.name_conflict";

export interface InstanceAddState {
  readonly open: boolean;
  readonly name: string;
  readonly placement: AddPlacement;
  readonly nameError: string | undefined;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly needsWorkerPage: boolean;
  readonly start: () => void;
  readonly close: () => void;
  readonly setName: (name: string) => void;
  readonly setPlacement: (placement: AddPlacement) => void;
  readonly submit: () => void;
}

export function useInstanceAdd(
  worker: string,
  onAdded: (instanceName: string) => void,
): InstanceAddState {
  const [open, setOpen] = useState(false);
  const [name, setNameValue] = useState("");
  const [placement, setPlacementValue] = useState<AddPlacement>("Server");
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const needsWorkerPage = placement === "Worker";

  const start = useCallback(() => {
    setNameValue("");
    setPlacementValue("Server");
    setNameError(undefined);
    setFailure(null);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    if (!submitting) setOpen(false);
  }, [submitting]);

  const setName = useCallback((next: string) => {
    setNameValue(next);
    setNameError(undefined);
  }, []);

  const setPlacement = useCallback((next: AddPlacement) => {
    setPlacementValue(next);
    setFailure(null);
  }, []);

  const submit = useCallback(() => {
    if (submitting || needsWorkerPage) return;
    const invalid = instanceNameError(name);
    setNameError(invalid ?? undefined);
    if (invalid !== null) return;
    setSubmitting(true);
    setFailure(null);
    createWorkerInstance({ name, worker, placement: PLACEMENT_VALUES[placement] }).then(
      (record) => {
        setSubmitting(false);
        setOpen(false);
        onAdded(record.name);
      },
      (cause: unknown) => {
        setSubmitting(false);
        const refusal = asApiError(cause);
        if (refusal.detail === NAME_CONFLICT) {
          setNameError(
            `The name ${name} is taken by a live or an archived instance. Choose another name.`,
          );
          return;
        }
        setFailure(credentialMessage(refusal));
      },
    );
  }, [submitting, needsWorkerPage, name, worker, placement, onAdded]);

  return {
    open,
    name,
    placement,
    nameError,
    failure,
    submitting,
    needsWorkerPage,
    start,
    close,
    setName,
    setPlacement,
    submit,
  };
}
