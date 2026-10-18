import type {
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  SchedulerExecutionRecord,
} from "@/api/types";
import { useNodeDiscard, type NodeDiscardState } from "@/hooks/use-node-discard";
import { useNodeOverride, type NodeOverrideState } from "@/hooks/use-node-override";
import { useNodePause, type NodePauseState } from "@/hooks/use-node-pause";
import { useNodeResume, type NodeResumeState } from "@/hooks/use-node-resume";
import { useNodeUnblock, type NodeUnblockState } from "@/hooks/use-node-unblock";
import type { Resource } from "@/hooks/use-resource";
import { pauseCauseOf } from "@/lib/execution-stop";
import {
  hasOpenAttempt,
  readFailureText,
  unresolvedRequestsOf,
  unresolvedRequestsText,
} from "@/lib/external-requests";

export interface NodeControlsInput {
  readonly node: MissionNodeRecord;
  readonly nodes: readonly MissionNodeRecord[];
  readonly missionVersion: number;
  readonly proposals: readonly MissionProposal[];
  readonly actions: Resource<readonly MissionExternalAction[]>;
  readonly executions: Resource<readonly SchedulerExecutionRecord[]>;
  readonly onChanged: () => void;
}

export interface NodeControlsState {
  readonly pause: NodePauseState;
  readonly unblock: NodeUnblockState;
  readonly resume: NodeResumeState;
  readonly override: NodeOverrideState;
  readonly discard: NodeDiscardState;
  readonly guardLine: string | null;
  readonly retry: (() => void) | null;
  readonly visible: boolean;
}

function awaitedOf(
  node: MissionNodeRecord,
  actions: NodeControlsInput["actions"],
  executions: NodeControlsInput["executions"],
): readonly Resource<unknown>[] {
  return node.state === "Paused" ? [actions, executions] : [actions];
}

function guardLineOf(
  node: MissionNodeRecord,
  actions: NodeControlsInput["actions"],
  executions: NodeControlsInput["executions"],
): string | null {
  if (!hasOpenAttempt(node)) return null;
  const paused = node.state === "Paused";
  const subject = paused ? "executions and the external actions" : "external actions";
  const awaited = awaitedOf(node, actions, executions);
  if (awaited.some((read) => read.loading)) {
    return `Reading the ${subject} of attempt ${node.attempt}.`;
  }
  const failure = awaited.find((read) => read.error !== null)?.error;
  if (actions.data === null || awaited.some((read) => read.data === null)) {
    return readFailureText(node.attempt, failure?.message ?? "", paused);
  }
  const unresolved = unresolvedRequestsOf(actions.data);
  return unresolved.length === 0 ? null : unresolvedRequestsText(node.attempt, unresolved, paused);
}

export function useNodeControls({
  node,
  nodes,
  missionVersion,
  proposals,
  actions,
  executions,
  onChanged,
}: NodeControlsInput): NodeControlsState {
  const awaited = awaitedOf(node, actions, executions);
  const answered = awaited.every((read) => read.data !== null);
  const guard = answered ? actions.data : null;
  const cause = executions.data === null ? null : pauseCauseOf(executions.data).cause;
  const pause = useNodePause(node, missionVersion, onChanged);
  const unblock = useNodeUnblock(node, missionVersion, proposals, onChanged);
  const resume = useNodeResume(node, missionVersion, nodes, guard, cause, onChanged);
  const override = useNodeOverride(node, missionVersion, guard, onChanged);
  const discard = useNodeDiscard(node, missionVersion, guard, onChanged);
  const guardLine = guardLineOf(node, actions, executions);
  const failed = hasOpenAttempt(node) && !answered && !awaited.some((read) => read.loading);

  return {
    pause,
    unblock,
    resume,
    override,
    discard,
    guardLine,
    retry: failed
      ? () => {
          actions.reload();
          executions.reload();
        }
      : null,
    visible:
      pause.available ||
      unblock.available ||
      resume.available ||
      override.available ||
      discard.available ||
      guardLine !== null,
  };
}
