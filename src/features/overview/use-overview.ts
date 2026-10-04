import { useMemo } from "react";

import type { Execution, MissionNodeRecord, MissionRunnableNode, NodeState } from "@/api/types";
import { NODE_STATES } from "@/api/types";
import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listExecutions } from "@/api/resources/scheduler";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface StateTally {
  readonly state: NodeState;
  readonly count: number;
}

export interface OverviewData {
  readonly projectId: string;
  readonly nodes: Resource<readonly MissionNodeRecord[]>;
  readonly blocked: readonly MissionRunnableNode[];
  readonly liveExecutions: Resource<readonly Execution[]>;
  readonly orderedTallies: readonly StateTally[];
}

async function readNodes(projectId: string): Promise<readonly MissionNodeRecord[]> {
  const mission = await readMission(projectId);
  return listMissionNodes(mission.id);
}

export function useOverview(): OverviewData {
  const projectId = useProjectId();
  const nodes = useResource(() => readNodes(projectId), [projectId]);
  const liveExecutions = useResource(() => listExecutions(projectId, "live"), [projectId]);

  const runnable = useMemo(
    () => (nodes.data ?? []).filter((node): node is MissionRunnableNode => node.kind !== "task"),
    [nodes.data],
  );

  const blocked = useMemo(() => runnable.filter((node) => node.state === "Blocked"), [runnable]);

  const orderedTallies = useMemo(
    () =>
      NODE_STATES.map((state) => ({
        state,
        count: runnable.filter((node) => node.state === state).length,
      })).filter((tally) => tally.count > 0),
    [runnable],
  );

  return { projectId, nodes, blocked, liveExecutions, orderedTallies };
}
