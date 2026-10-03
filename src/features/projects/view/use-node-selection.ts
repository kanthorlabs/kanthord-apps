import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

const NODE_PARAM = "node";

export interface NodeSelection {
  readonly selectedId: string | null;
  readonly select: (nodeId: string | null) => void;
}

export function useNodeSelection(): NodeSelection {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get(NODE_PARAM);

  const select = useCallback(
    (nodeId: string | null) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (nodeId === null) next.delete(NODE_PARAM);
          else next.set(NODE_PARAM, nodeId);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { selectedId, select };
}
