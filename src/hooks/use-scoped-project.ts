import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const PROJECT_PARAM = "project";

export interface ScopedProject {
  readonly projectId: string | null;
  readonly select: (projectId: string | null) => void;
}

export function useScopedProject(): ScopedProject {
  const [params, setParams] = useSearchParams();

  const select = useCallback(
    (projectId: string | null) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (projectId === null) next.delete(PROJECT_PARAM);
          else next.set(PROJECT_PARAM, projectId);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { projectId: params.get(PROJECT_PARAM), select };
}
