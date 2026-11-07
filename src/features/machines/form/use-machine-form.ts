import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { isApiError } from "@/api/errors";
import { createWorkerMachine } from "@/api/resources/worker-machines";
import { asApiError } from "@/hooks/use-resource";
import { type ContainerRuntime, type HostKind, machineNameError } from "@/lib/instance-host";
import { machinePagePath } from "@/lib/worker-paths";
import { machineMessage, NAME_CONFLICT, NAME_INVALID } from "../machine-message";
import { type MachineHostState, useMachineHost } from "../use-machine-host";

export interface MachineCreateResult {
  readonly name: string;
  readonly configuration: string;
  readonly kind: HostKind;
  readonly runtime: ContainerRuntime;
}

export interface MachineFormState {
  readonly name: string;
  readonly host: MachineHostState;
  readonly errors: Readonly<Record<string, string>>;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly result: MachineCreateResult | null;
  readonly missing: readonly string[];
  readonly setName: (name: string) => void;
  readonly submit: () => void;
  readonly done: () => void;
}

export function useMachineForm(): MachineFormState {
  const navigate = useNavigate();
  const [name, setNameValue] = useState("");
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MachineCreateResult | null>(null);
  const host = useMachineHost(true);

  const setName = useCallback((next: string) => {
    setNameValue(next);
    setErrors((current) => {
      const { name: _dropped, ...rest } = current;
      return rest;
    });
  }, []);

  const submit = useCallback(() => {
    if (submitting) return;
    const nameError = machineNameError(name);
    const next: Record<string, string> = {};
    if (nameError !== null) next["name"] = nameError;
    if (host.kind === null) next["kind"] = "Choose where the machine runs.";
    setErrors(next);
    if (host.kind === null || Object.keys(next).length > 0) return;
    const kind = host.kind;
    const runtime = host.runtime;
    setSubmitting(true);
    setFailure(null);
    createWorkerMachine({ name }).then(
      (record) => {
        setSubmitting(false);
        if (record.machine_configuration === undefined) {
          setFailure(
            `The machine ${record.name} exists, but the server answered no machine configuration. Use Reset key on its page.`,
          );
          return;
        }
        setResult({
          name: record.name,
          configuration: record.machine_configuration,
          kind,
          runtime,
        });
      },
      (cause: unknown) => {
        setSubmitting(false);
        const error = asApiError(cause);
        if (
          isApiError(cause) &&
          (cause.detail === NAME_INVALID || cause.detail === NAME_CONFLICT)
        ) {
          setErrors({ name: machineMessage(error) });
          return;
        }
        setFailure(machineMessage(error));
      },
    );
  }, [submitting, name, host.kind, host.runtime]);

  const done = useCallback(() => {
    if (result !== null) navigate(machinePagePath(result.name));
  }, [result, navigate]);

  const missing = [
    ...(name.length === 0 ? ["Name"] : []),
    ...(host.kind === null ? ["Where does it run?"] : []),
  ];

  return { name, host, errors, failure, submitting, result, missing, setName, submit, done };
}
