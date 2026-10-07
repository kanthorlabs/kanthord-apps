import { useMemo } from "react";

import type {
  MissionNodeRecord,
  MissionRunnableNode,
  NodeState,
  SchedulerExecutionRecord,
} from "@/api/types";
import { NODE_STATES } from "@/api/types";
import { listProjectExecutions } from "@/api/resources/scheduler";
import { useProjectId } from "@/features/projects/project-context";
import { useMissionNodes } from "@/hooks/use-mission-nodes";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface StateTally {
  readonly state: NodeState;
  readonly count: number;
}

export interface LiveExecution {
  readonly execution: SchedulerExecutionRecord;
  readonly nodeName: string;
}

export interface OverviewData {
  readonly projectId: string;
  readonly nodes: Resource<readonly MissionNodeRecord[]>;
  readonly blocked: readonly MissionRunnableNode[];
  readonly executions: Resource<readonly SchedulerExecutionRecord[]>;
  readonly liveExecutions: readonly LiveExecution[];
  readonly orderedTallies: readonly StateTally[];
}

export function useOverview(): OverviewData {
  const projectId = useProjectId();
  const nodes = useMissionNodes(projectId);
  const executions = useResource(() => listProjectExecutions(projectId), [projectId]);

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

  const liveExecutions = useMemo(() => {
    const names = new Map((nodes.data ?? []).map((node) => [node.id, node.content.name]));
    return (executions.data ?? [])
      .filter((execution) => execution.claim_state === "running")
      .map((execution) => ({
        execution,
        nodeName: names.get(execution.node_id) ?? execution.node_id,
      }));
  }, [executions.data, nodes.data]);

  return { projectId, nodes, blocked, executions, liveExecutions, orderedTallies };
}
