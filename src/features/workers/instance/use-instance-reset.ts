import { useCallback, useState } from "react";

import { resetWorkerInstanceKey } from "@/api/resources/worker-instances";
import type { WorkerInstanceDetail } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ContainerRuntime, HostKind } from "@/lib/instance-host";
import { type HostAddressState, useHostAddress } from "../use-host-address";

export interface InstanceResetResult {
  readonly name: string;
  readonly revision: number;
  readonly configuration: string;
  readonly kind: HostKind;
  readonly runtime: ContainerRuntime;
}

export interface InstanceResetState {
  readonly open: boolean;
  readonly host: HostAddressState;
  readonly errors: Readonly<Record<string, string>>;
  readonly failure: string | null;
  readonly resetting: boolean;
  readonly result: InstanceResetResult | null;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
  readonly done: () => void;
}

export function useInstanceReset(
  instance: WorkerInstanceDetail,
  reload: () => void,
): InstanceResetState {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<InstanceResetResult | null>(null);
  const host = useHostAddress(open);
  const resetHost = host.reset;

  const request = useCallback(() => {
    setErrors({});
    setFailure(null);
    setResult(null);
    resetHost();
    setOpen(true);
  }, [resetHost]);

  const cancel = useCallback(() => {
    if (resetting || result !== null) return;
    setOpen(false);
  }, [resetting, result]);

  const done = useCallback(() => {
    setOpen(false);
    setResult(null);
    resetHost();
    reload();
  }, [resetHost, reload]);

  const confirm = useCallback(() => {
    if (resetting) return;
    const next: Record<string, string> = {};
    if (host.kind === null) next["kind"] = "Choose where the instance runs.";
    const addressError = host.kind === null ? null : host.addressError();
    if (addressError !== null) next["address"] = addressError;
    setErrors(next);
    if (host.kind === null || Object.keys(next).length > 0) return;
    const kind = host.kind;
    const runtime = host.runtime;
    setResetting(true);
    setFailure(null);
    resetWorkerInstanceKey(instance.name, host.address.trim(), instance.revision).then(
      (record) => {
        setResetting(false);
        if (record.instance_configuration === undefined) {
          reload();
          setFailure(
            `The key of ${instance.name} changed to revision ${record.revision}, but the server answered no instance configuration. Reset the key again.`,
          );
          return;
        }
        setResult({
          name: record.name,
          revision: record.revision,
          configuration: record.instance_configuration,
          kind,
          runtime,
        });
      },
      (cause: unknown) => {
        setResetting(false);
        reload();
        setFailure(asApiError(cause).message);
      },
    );
  }, [resetting, host, instance.name, instance.revision, reload]);

  return {
    open,
    host,
    errors,
    failure,
    resetting,
    result,
    request,
    cancel,
    confirm,
    done,
  };
}
