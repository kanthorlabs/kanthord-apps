import { useMemo } from "react";

import type { BlockedNode, Execution, Overview, StateTally } from "@/api/types";
import { NODE_STATES } from "@/api/types";
import { listBlocked } from "@/api/resources/mission";
import { readOverview } from "@/api/resources/projects";
import { listExecutions } from "@/api/resources/scheduler";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface OverviewData {
  readonly projectId: string;
  readonly overview: Resource<Overview>;
  readonly blocked: Resource<readonly BlockedNode[]>;
  readonly liveExecutions: Resource<readonly Execution[]>;
  readonly orderedTallies: readonly StateTally[];
}

export function useOverview(): OverviewData {
  const projectId = useProjectId();
  const overview = useResource(() => readOverview(projectId), [projectId]);
  const blocked = useResource(() => listBlocked(projectId), [projectId]);
  const liveExecutions = useResource(() => listExecutions(projectId, "live"), [projectId]);

  const orderedTallies = useMemo(() => {
    const raw = overview.data?.tallies ?? [];
    return NODE_STATES.map((state) => raw.find((t) => t.state === state)).filter(
      (t): t is StateTally => t !== undefined && t.count > 0,
    );
  }, [overview.data]);

  return { projectId, overview, blocked, liveExecutions, orderedTallies };
}
