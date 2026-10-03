import { useEffect, useMemo, useState } from "react";

import { listExecutions } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { Execution } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";
import { percent } from "@/lib/format";

export type ClaimState = "running" | "lost" | "finished";

export interface ExecutionView {
  readonly execution: Execution;
  readonly turnPct: number;
  readonly wallTimePct: number;
  readonly turnOverBudget: boolean;
  readonly wallTimeOverBudget: boolean;
  readonly overBudget: boolean;
  readonly claimState: ClaimState | null;
  readonly deadline: string | null;
}

export interface ExecutionsState {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly views: readonly ExecutionView[];
  readonly scope: "live" | "all";
  readonly selectScope: (value: string) => void;
}

function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    Promise.resolve().then(() => setNow(Date.now()));
  }, []);
  return now;
}

function deriveClaimState(
  endedAt: string | null,
  deadline: string | null,
  now: number,
): ClaimState | null {
  const deadlineMs = deadline === null ? null : new Date(deadline).getTime();
  if (endedAt === null) {
    return deadlineMs !== null && now > 0 && now >= deadlineMs ? "lost" : "running";
  }
  if (deadlineMs === null) return null;
  return new Date(endedAt).getTime() >= deadlineMs ? "lost" : "finished";
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
        const deadline = execution.lease?.expiresAt ?? null;
        const claimState = deriveClaimState(execution.endedAt, deadline, now);

        return {
          execution,
          turnPct,
          wallTimePct,
          turnOverBudget,
          wallTimeOverBudget,
          overBudget,
          claimState,
          deadline,
        };
      }),
    [data, now],
  );

  const selectScope = (value: string) => {
    if (value === "live" || value === "all") setScope(value);
  };

  return { loading, error, reload, views, scope, selectScope };
}
