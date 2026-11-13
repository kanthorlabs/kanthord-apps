import { useEffect, useRef } from "react";

import type { Project } from "@/api/types";
import type { ActResult } from "@/hooks/act-result";
import { type ProjectPause, useProjectPause } from "@/hooks/use-project-pause";

const KEEP_READS = () => undefined;

export interface ProjectActView {
  readonly available: boolean;
  readonly pause: ProjectPause;
}

export function useProjectAct(
  operationId: string,
  project: Project,
  onSettled: (result: ActResult) => void,
): ProjectActView {
  const pause = useProjectPause(project, KEEP_READS, onSettled);
  const paused = project.paused_at !== null;
  const available =
    (operationId === "project.resume" && paused) || (operationId === "project.pause" && !paused);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (available) pause.toggle();
  });

  return { available, pause };
}
