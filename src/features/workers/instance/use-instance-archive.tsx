import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";

import { isApiError } from "@/api/errors";
import { archiveWorkerInstance, readWorkerInstance } from "@/api/resources/worker-instances";
import type { InstanceBinding, WorkerInstanceDetail } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";

const IN_USE = "worker.instance.in_use";

export interface ArchiveRefusal {
  readonly bindings: readonly InstanceBinding[];
  readonly executions: readonly string[];
}

export interface ArchiveSubject {
  readonly name: string;
  readonly revision: number;
  readonly bindingCount: number;
  readonly liveExecutions: readonly string[];
}

export interface InstanceArchiveState {
  readonly open: boolean;
  readonly blocked: ReactNode;
  readonly liveExecutions: readonly string[];
  readonly error: string | null;
  readonly refusal: ArchiveRefusal | null;
  readonly archiving: boolean;
  readonly reading: boolean;
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

export function archiveSubjectOf(instance: WorkerInstanceDetail): ArchiveSubject {
  return {
    name: instance.name,
    revision: instance.revision,
    bindingCount: instance.bindings.length,
    liveExecutions: liveExecutionsOf(instance),
  };
}

type ArchiveBlock = "listed" | "executing";

function archiveBlockKindOf(subject: ArchiveSubject): ArchiveBlock | null {
  if (subject.bindingCount > 0) return "listed";
  if (subject.liveExecutions.length > 0) return "executing";
  return null;
}

function blockNoticeOf(kind: ArchiveBlock, name: string): ReactNode {
  const record = <RecordName>{name}</RecordName>;
  switch (kind) {
    case "listed":
      return (
        <>
          A binding lists {record}. Detach {record} from each listing binding first.
        </>
      );
    case "executing":
      return <>A registration of {record} holds a live execution. Wait until the execution ends.</>;
  }
}

function staleNoticeOf(subject: ArchiveSubject, ended: boolean): ReactNode {
  if (ended)
    return (
      <>
        <RecordName>{subject.name}</RecordName> is already archived.
      </>
    );
  const kind = archiveBlockKindOf(subject);
  return kind === null ? null : blockNoticeOf(kind, subject.name);
}

export function useInstanceArchive(
  subject: ArchiveSubject,
  onArchived: () => void,
  onStale: () => void,
  control: RefObject<HTMLButtonElement | null>,
): InstanceArchiveState {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<ArchiveRefusal | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reading, setReading] = useState(false);
  const [revision, setRevision] = useState(subject.revision);
  const pendingFocus = useRef(false);
  const blockKind = archiveBlockKindOf(subject);
  const blocked = blockKind === null ? null : blockNoticeOf(blockKind, subject.name);

  useEffect(() => {
    if (blockKind === null || !pendingFocus.current) return;
    pendingFocus.current = false;
    control.current?.focus();
  }, [blockKind, control]);

  const request = useCallback(() => {
    if (blockKind !== null || reading) return;
    pendingFocus.current = false;
    setError(null);
    setRefusal(null);
    setReading(true);
    readWorkerInstance(subject.name).then(
      (detail) => {
        setReading(false);
        const fresh = archiveSubjectOf(detail);
        const ended = detail.ended_at !== null;
        const freshBlock = staleNoticeOf(fresh, ended);
        if (freshBlock !== null) {
          toast.error(`${subject.name} was not archived.`, { description: freshBlock });
          pendingFocus.current = !ended;
          onStale();
          return;
        }
        setRevision(fresh.revision);
        setOpen(true);
      },
      (cause: unknown) => {
        setReading(false);
        toast.error(`${subject.name} was not read.`, { description: asApiError(cause).message });
      },
    );
  }, [blockKind, reading, subject.name, onStale]);

  const cancel = useCallback(() => {
    if (!archiving) setOpen(false);
  }, [archiving]);

  const confirm = useCallback(() => {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    archiveWorkerInstance(subject.name, revision).then(
      () => {
        setArchiving(false);
        setOpen(false);
        toast.success(
          `Archived ${subject.name}. Its registrations and its credential copies ended.`,
        );
        onArchived();
      },
      (cause: unknown) => {
        setArchiving(false);
        setRefusal(refusalOf(cause));
        setError(asApiError(cause).message);
      },
    );
  }, [archiving, subject.name, revision, onArchived]);

  return {
    open,
    blocked,
    liveExecutions: subject.liveExecutions,
    error,
    refusal,
    archiving,
    reading,
    request,
    cancel,
    confirm,
  };
}
