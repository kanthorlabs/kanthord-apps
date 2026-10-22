import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type SchedulerView = "live" | "failed" | "history";

const VIEW_PARAM = "view";

export interface SchedulerViewState {
  readonly view: SchedulerView;
  readonly selectView: (view: SchedulerView) => void;
}

function viewOf(value: string | null): SchedulerView {
  return value === "failed" || value === "history" ? value : "live";
}

export function useSchedulerView(): SchedulerViewState {
  const [params, setParams] = useSearchParams();

  const selectView = useCallback(
    (view: SchedulerView) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (view === "live") next.delete(VIEW_PARAM);
          else next.set(VIEW_PARAM, view);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { view: viewOf(params.get(VIEW_PARAM)), selectView };
}
