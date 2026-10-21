import { useCallback, useState } from "react";

import { isApiError } from "@/api/errors";
import { createWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerInstanceWriteAnswer } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { instanceNameError, type HostKind } from "@/lib/instance-host";
import { useHostAddress, type HostAddressState } from "../use-host-address";

const NAME_CONFLICT = "worker.instance.name_conflict";
const NAME_INVALID = "worker.instance.name_invalid";

export interface InstanceCreateResult {
  readonly record: WorkerInstanceWriteAnswer;
  readonly configuration: string;
  readonly kind: HostKind;
}

export interface InstanceCreateState {
  readonly open: boolean;
  readonly name: string;
  readonly host: HostAddressState;
  readonly errors: Readonly<Record<string, string>>;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly result: InstanceCreateResult | null;
  readonly missing: readonly string[];
  readonly start: () => void;
  readonly close: () => void;
  readonly dismiss: () => void;
  readonly setName: (name: string) => void;
  readonly submit: () => void;
}

function fieldErrorOf(cause: unknown, name: string): Record<string, string> | null {
  if (!isApiError(cause)) return null;
  if (cause.detail === NAME_CONFLICT) {
    return {
      name: `The name ${name} is taken by a live or an archived instance. Choose another name.`,
    };
  }
  if (cause.detail === NAME_INVALID) return { name: cause.message };
  return null;
}

export function useInstanceCreate(workerName: string, onCreated: () => void): InstanceCreateState {
  const [open, setOpen] = useState(false);
  const [name, setNameValue] = useState("");
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InstanceCreateResult | null>(null);
  const host = useHostAddress(open);
  const resetHost = host.reset;

  const start = useCallback(() => {
    setNameValue("");
    setErrors({});
    setFailure(null);
    setResult(null);
    resetHost();
    setOpen(true);
  }, [resetHost]);

  const close = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    setResult(null);
    resetHost();
  }, [submitting, resetHost]);

  const dismiss = useCallback(() => {
    if (result === null) close();
  }, [result, close]);

  const setName = useCallback((next: string) => {
    setNameValue(next);
    setErrors((current) => {
      const { name: _dropped, ...rest } = current;
      return rest;
    });
  }, []);

  const submit = useCallback(() => {
    if (submitting) return;
    const nameError = instanceNameError(name);
    const addressError = host.kind === null ? null : host.addressError();
    const next: Record<string, string> = {};
    if (nameError !== null) next["name"] = nameError;
    if (host.kind === null) next["kind"] = "Choose where the instance runs.";
    if (addressError !== null) next["address"] = addressError;
    setErrors(next);
    if (Object.keys(next).length > 0 || host.kind === null) return;
    const kind = host.kind;
    setSubmitting(true);
    setFailure(null);
    createWorkerInstance({ name, worker: workerName, endpoint: host.address.trim() }).then(
      (record) => {
        setSubmitting(false);
        onCreated();
        if (record.instance_configuration === undefined) {
          setFailure(
            "The server answered no instance configuration. Use Reset key on the instance page.",
          );
          return;
        }
        setResult({ record, configuration: record.instance_configuration, kind });
      },
      (cause: unknown) => {
        setSubmitting(false);
        const fields = fieldErrorOf(cause, name);
        if (fields !== null) setErrors(fields);
        else setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, name, host, workerName, onCreated]);

  const missing = [
    ...(name.length === 0 ? ["Name"] : []),
    ...(host.kind === null ? ["Where does it run?"] : []),
    ...(host.kind !== null && host.address.trim().length === 0 ? ["Address"] : []),
  ];

  return {
    open,
    name,
    host,
    errors,
    failure,
    submitting,
    result,
    missing,
    start,
    close,
    dismiss,
    setName,
    submit,
  };
}
