import { useEffect, useMemo, useState } from "react";

import { listExecutions } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { Execution } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";
import { percent } from "@/lib/format";

export interface ExecutionView {
  readonly execution: Execution;
  readonly turnPct: number;
  readonly wallTimePct: number;
  readonly turnOverBudget: boolean;
  readonly wallTimeOverBudget: boolean;
  readonly overBudget: boolean;
  readonly leaseExpired: boolean;
}

export interface ExecutionsState {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly views: readonly ExecutionView[];
  readonly scope: "live" | "all";
  readonly setScope: (scope: "live" | "all") => void;
}

function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    Promise.resolve().then(() => setNow(Date.now()));
  }, []);
  return now;
}

export function useExecutions(): ExecutionsState {
  const projectId = useProjectId();
  const [scope, setScope] = useState<"live" | "all">("live");
  const { data, loading, error, reload } = useResource(
    () => listExecutions(projectId, scope),
    [projectId, scope],
  );
  const now = useNow();

  const views = useMemo<readonly ExecutionView[]>(
    () =>
      (data ?? []).map((execution) => {
        const turnPct = percent(execution.turnsUsed, execution.turnBudget);
        const wallTimePct = percent(execution.wallTimeUsedSeconds, execution.wallTimeBudgetSeconds);
        const turnOverBudget = execution.turnsUsed >= execution.turnBudget;
        const wallTimeOverBudget = execution.wallTimeUsedSeconds >= execution.wallTimeBudgetSeconds;
        const overBudget = turnOverBudget || wallTimeOverBudget;
        const leaseExpired =
          now > 0 &&
          execution.lease !== null &&
          new Date(execution.lease.expiresAt).getTime() < now;

        return {
          execution,
          turnPct,
          wallTimePct,
          turnOverBudget,
          wallTimeOverBudget,
          overBudget,
          leaseExpired,
        };
      }),
    [data, now],
  );

  return { loading, error, reload, views, scope, setScope };
}
