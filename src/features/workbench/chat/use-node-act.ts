import { useEffect, useRef } from "react";

import type { ApiError } from "@/api/errors";
import type { MissionNodeRecord, NodeState } from "@/api/types";
import type { ActResult } from "@/hooks/act-result";
import { useMissionNodes } from "@/hooks/use-mission-nodes";
import { type NodeCheckState, useNodeCheck } from "@/hooks/use-node-check";
import type { Resource } from "@/hooks/use-resource";
import { useMission } from "@/features/projects/view/use-mission";
import { useNodeExecutions } from "@/features/projects/view/use-node-executions";
import { useNodeExternalActions } from "@/features/projects/view/use-node-external-actions";
import { useNodeProposals } from "@/features/projects/view/use-node-proposals";
import {
  type NodeControlsState,
  useNodeControls,
} from "@/features/projects/view/use-node-controls";
import { hasOpenAttempt } from "@/lib/external-requests";

const EXECUTION_STATES: readonly NodeState[] = ["Paused", "Executing", "Evaluating"];
const KEEP_READS = () => undefined;

export type NodeActPhase = "reading" | "failed" | "unavailable" | "started";

export interface NodeActView {
  readonly phase: NodeActPhase;
  readonly failure: ApiError | null;
  readonly controls: NodeControlsState;
  readonly check: NodeCheckState;
}

interface Act {
  readonly available: boolean;
  readonly run: () => void;
}

function actOf(
  operationId: string,
  controls: NodeControlsState,
  check: NodeCheckState,
): Act | null {
  switch (operationId) {
    case "mission.node.resume":
      return { available: controls.resume.available, run: controls.resume.request };
    case "mission.node.unblock":
      return { available: controls.unblock.available, run: controls.unblock.request };
    case "mission.node.discard":
      return { available: controls.discard.available, run: controls.discard.request };
    case "mission.node.override":
      return { available: controls.override.available, run: controls.override.request };
    case "mission.node.pause":
      return { available: controls.pause.available, run: controls.pause.request };
    case "mission.node.check":
      return { available: check.available, run: check.check };
    default:
      return null;
  }
}

export function useNodeAct(
  operationId: string,
  node: MissionNodeRecord,
  projectId: string,
  onSettled: (result: ActResult) => void,
): NodeActView {
  const mission = useMission(projectId);
  const nodes = useMissionNodes(projectId);
  const proposals = useNodeProposals(node.id, node.intent === "examine");
  const actions = useNodeExternalActions(node.id, node.attempt, hasOpenAttempt(node));
  const executions = useNodeExecutions(
    projectId,
    node.id,
    node.attempt,
    EXECUTION_STATES.includes(node.state),
  );
  const reads: readonly Resource<unknown>[] = [mission, nodes, proposals, actions, executions];
  const failure = reads.find((read) => read.error !== null)?.error ?? null;
  const ready = reads.every((read) => read.data !== null);
  const missionVersion = mission.data?.version ?? 0;
  const controls = useNodeControls({
    node,
    nodes: nodes.data ?? [],
    missionVersion,
    proposals: proposals.data ?? [],
    actions,
    executions,
    onChanged: KEEP_READS,
    onSettled,
  });
  const check = useNodeCheck(node, missionVersion, actions.data, KEEP_READS, KEEP_READS, onSettled);
  const act = actOf(operationId, controls, check);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || failure !== null || started.current) return;
    started.current = true;
    if (act?.available === true) act.run();
  });

  if (failure !== null) return { phase: "failed", failure, controls, check };
  if (!ready) return { phase: "reading", failure, controls, check };
  return { phase: act?.available === true ? "started" : "unavailable", failure, controls, check };
}
