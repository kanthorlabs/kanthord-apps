import { useCallback, useState } from "react";
import { toast } from "sonner";

import { pauseProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ProjectPause {
  readonly paused: boolean;
  readonly busy: boolean;
  readonly toggle: () => void;
}

export function useProjectPause(project: Project, onChanged: () => void): ProjectPause {
  const [busy, setBusy] = useState(false);
  const paused = project.paused_at !== null;

  const toggle = useCallback(
    function run() {
      if (busy) return;
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
    [busy, paused, project.id, project.name, onChanged],
  );

  return { paused, busy, toggle };
}
