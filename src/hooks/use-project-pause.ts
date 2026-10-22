import { useCallback, useState } from "react";
import { toast } from "sonner";

import { pauseProject, readProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ProjectPause {
  readonly paused: boolean;
  readonly busy: boolean;
  readonly confirming: boolean;
  readonly toggle: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

function staleText(name: string, paused: boolean): string {
  const state = paused ? "active" : "paused";
  return `${name} is already ${state}. The view now shows its current state.`;
}

export function useProjectPause(project: Project, onChanged: () => void): ProjectPause {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const paused = project.paused_at !== null;

  const write = useCallback(
    (retry: () => void) => {
      (paused ? resumeProject : pauseProject)(project.id).then(
        () => {
          setBusy(false);
          setConfirming(false);
          if (paused) {
            toast.success(`Resumed ${project.name}.`, {
              description: "Workers can claim its nodes.",
            });
          } else {
            toast.success(`Paused ${project.name}.`, {
              description: "No worker claims a new node of it until a resume.",
            });
          }
          onChanged();
        },
        (cause: unknown) => {
          setBusy(false);
          setConfirming(false);
          toast.error(paused ? "Resuming the project failed." : "Pausing the project failed.", {
            description: asApiError(cause).message,
            action: { label: "Retry", onClick: retry },
          });
        },
      );
    },
    [paused, project.id, project.name, onChanged],
  );

  const checkAndWrite = useCallback(
    function request() {
      setBusy(true);
      readProject(project.id).then(
        (fresh) => {
          if ((fresh.paused_at !== null) === paused) {
            write(request);
            return;
          }
          setBusy(false);
          setConfirming(false);
          toast.info(`${project.name} did not change.`, {
            description: staleText(project.name, paused),
          });
          onChanged();
        },
        (cause: unknown) => {
          setBusy(false);
          setConfirming(false);
          toast.error(`${project.name} was not read.`, {
            description: asApiError(cause).message,
            action: { label: "Retry", onClick: request },
          });
        },
      );
    },
    [paused, project.id, project.name, onChanged, write],
  );

  const toggle = useCallback(() => {
    if (busy) return;
    if (paused) {
      checkAndWrite();
      return;
    }
    setConfirming(true);
  }, [busy, paused, checkAndWrite]);

  const cancel = useCallback(() => {
    if (busy) return;
    setConfirming(false);
  }, [busy]);

  const confirm = useCallback(() => {
    if (busy || !confirming) return;
    checkAndWrite();
  }, [busy, confirming, checkAndWrite]);

  return { paused, busy, confirming, toggle, cancel, confirm };
}
