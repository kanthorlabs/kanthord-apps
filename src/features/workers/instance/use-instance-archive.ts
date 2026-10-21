import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { isApiError } from "@/api/errors";
import { archiveWorkerInstance } from "@/api/resources/worker-instances";
import type { InstanceBinding, WorkerInstanceDetail } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { workerPagePath } from "@/lib/worker-paths";

const IN_USE = "worker.instance.in_use";

export interface ArchiveRefusal {
  readonly bindings: readonly InstanceBinding[];
  readonly executions: readonly string[];
}

export interface InstanceArchiveState {
  readonly open: boolean;
  readonly blocked: string | null;
  readonly liveExecutions: readonly string[];
  readonly error: string | null;
  readonly refusal: ArchiveRefusal | null;
  readonly archiving: boolean;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

function listOf<T>(value: unknown, guard: (item: unknown) => item is T): readonly T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function isBinding(item: unknown): item is InstanceBinding {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as Record<string, unknown>)["project_id"] === "string" &&
    typeof (item as Record<string, unknown>)["binding"] === "string"
  );
}

function isText(item: unknown): item is string {
  return typeof item === "string";
}

function refusalOf(cause: unknown): ArchiveRefusal | null {
  if (!isApiError(cause) || cause.detail !== IN_USE) return null;
  const details = (cause.details ?? {}) as Record<string, unknown>;
  return {
    bindings: listOf(details["bindings"], isBinding),
    executions: listOf(details["executions"], isText),
  };
}

export function liveExecutionsOf(instance: WorkerInstanceDetail): readonly string[] {
  return instance.registrations.flatMap((registration) =>
    registration.execution_id === undefined ? [] : [registration.execution_id],
  );
}

export function archiveBlockOf(instance: WorkerInstanceDetail): string | null {
  if (instance.bindings.length > 0) {
    return `A binding lists ${instance.name}. Remove ${instance.name} from each listing binding first.`;
  }
  if (liveExecutionsOf(instance).length > 0) {
    return `A registration of ${instance.name} holds a live execution. Wait until the execution ends.`;
  }
  return null;
}

export function useInstanceArchive(instance: WorkerInstanceDetail): InstanceArchiveState {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<ArchiveRefusal | null>(null);
  const [archiving, setArchiving] = useState(false);
  const blocked = archiveBlockOf(instance);

  const request = useCallback(() => {
    if (blocked !== null) return;
    setError(null);
    setRefusal(null);
    setOpen(true);
  }, [blocked]);

  const cancel = useCallback(() => {
    if (!archiving) setOpen(false);
  }, [archiving]);

  const confirm = useCallback(() => {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    archiveWorkerInstance(instance.name, instance.revision).then(
      () => {
        setArchiving(false);
        setOpen(false);
        toast.success(
          `Archived ${instance.name}. Its registrations and its credential copies ended.`,
        );
        void navigate(workerPagePath(instance.worker));
      },
      (cause: unknown) => {
        setArchiving(false);
        setRefusal(refusalOf(cause));
        setError(asApiError(cause).message);
      },
    );
  }, [archiving, instance.name, instance.revision, instance.worker, navigate]);

  return {
    open,
    blocked,
    liveExecutions: liveExecutionsOf(instance),
    error,
    refusal,
    archiving,
    request,
    cancel,
    confirm,
  };
}
