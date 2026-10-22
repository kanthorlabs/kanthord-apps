import { useCallback, useState } from "react";
import { toast } from "sonner";

import { pauseProject, readProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ProjectPause {
  readonly paused: boolean;
  readonly busy: boolean;
  readonly toggle: () => void;
}

function staleText(name: string, paused: boolean): string {
  const state = paused ? "active" : "paused";
  return `${name} is already ${state}. The view now shows its current state.`;
}

export function useProjectPause(project: Project, onChanged: () => void): ProjectPause {
  const [busy, setBusy] = useState(false);
  const paused = project.paused_at !== null;

  const write = useCallback(
    function run() {
      setBusy(true);
      (paused ? resumeProject : pauseProject)(project.id).then(
        () => {
          setBusy(false);
          if (paused) {
            toast.success(`Resumed ${project.name}.`, {
              description: "Workers can claim its nodes.",
            });
          }
          onChanged();
        },
        (cause: unknown) => {
          setBusy(false);
          toast.error(paused ? "Resuming the project failed." : "Pausing the project failed.", {
            description: asApiError(cause).message,
            action: { label: "Retry", onClick: run },
          });
        },
      );
    },
    [paused, project.id, project.name, onChanged],
  );

  const toggle = useCallback(
    function request() {
      if (busy) return;
      setBusy(true);
      readProject(project.id).then(
        (fresh) => {
          if ((fresh.paused_at !== null) === paused) {
            write();
            return;
          }
          setBusy(false);
          toast.info(`${project.name} did not change.`, {
            description: staleText(project.name, paused),
          });
          onChanged();
        },
        (cause: unknown) => {
          setBusy(false);
          toast.error(`${project.name} was not read.`, {
            description: asApiError(cause).message,
            action: { label: "Retry", onClick: request },
          });
        },
      );
    },
    [busy, paused, project.id, project.name, onChanged, write],
  );

  return { paused, busy, toggle };
}
