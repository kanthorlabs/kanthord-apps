import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { archiveWorkerMachine } from "@/api/resources/worker-machines";
import type { WorkerMachineDetail } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { machineMessage } from "../machine-message";

export interface MachineArchiveState {
  readonly open: boolean;
  readonly error: string | null;
  readonly archiving: boolean;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useMachineArchive(
  machine: WorkerMachineDetail,
  reload: () => void,
): MachineArchiveState {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const request = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    if (!archiving) setOpen(false);
  }, [archiving]);

  const confirm = useCallback(() => {
    if (archiving) return;
    setArchiving(true);
    setError(null);
    archiveWorkerMachine(machine.name, machine.revision).then(
      () => {
        setArchiving(false);
        setOpen(false);
        toast.success(`Archived ${machine.name}. Its key ended.`);
        navigate("/machines");
      },
      (cause: unknown) => {
        setArchiving(false);
        reload();
        setError(machineMessage(asApiError(cause)));
      },
    );
  }, [archiving, machine.name, machine.revision, navigate, reload]);

  return { open, error, archiving, request, cancel, confirm };
}
