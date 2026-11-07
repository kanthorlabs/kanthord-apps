import { useCallback, useState } from "react";

import { rotateWorkerMachineKey } from "@/api/resources/worker-machines";
import type { WorkerMachineDetail } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ContainerRuntime, HostKind } from "@/lib/instance-host";
import { machineMessage } from "../machine-message";
import { type MachineHostState, useMachineHost } from "../use-machine-host";

export interface MachineResetResult {
  readonly name: string;
  readonly revision: number;
  readonly configuration: string;
  readonly kind: HostKind;
  readonly runtime: ContainerRuntime;
}

export interface MachineResetState {
  readonly open: boolean;
  readonly host: MachineHostState;
  readonly error: string | null;
  readonly failure: string | null;
  readonly resetting: boolean;
  readonly result: MachineResetResult | null;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
  readonly done: () => void;
}

export function useMachineReset(
  machine: WorkerMachineDetail,
  reload: () => void,
): MachineResetState {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<MachineResetResult | null>(null);
  const host = useMachineHost(open);
  const resetHost = host.reset;

  const request = useCallback(() => {
    setError(null);
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
    if (host.kind === null) {
      setError("Choose where the machine runs.");
      return;
    }
    setError(null);
    const kind = host.kind;
    const runtime = host.runtime;
    setResetting(true);
    setFailure(null);
    rotateWorkerMachineKey(machine.name, machine.revision).then(
      (record) => {
        setResetting(false);
        if (record.machine_configuration === undefined) {
          reload();
          setFailure(
            `The key of ${machine.name} changed to revision ${record.revision}, but the server answered no machine configuration. Reset the key again.`,
          );
          return;
        }
        setResult({
          name: record.name,
          revision: record.revision,
          configuration: record.machine_configuration,
          kind,
          runtime,
        });
      },
      (cause: unknown) => {
        setResetting(false);
        reload();
        setFailure(machineMessage(asApiError(cause)));
      },
    );
  }, [resetting, host.kind, host.runtime, machine.name, machine.revision, reload]);

  return { open, host, error, failure, resetting, result, request, cancel, confirm, done };
}
