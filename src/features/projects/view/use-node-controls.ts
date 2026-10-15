import type {
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  MissionRunnableNode,
  SchedulerExecutionRecord,
} from "@/api/types";
import { useNodeDiscard, type NodeDiscardState } from "@/hooks/use-node-discard";
import { useNodeOverride, type NodeOverrideState } from "@/hooks/use-node-override";
import { useNodeResume, type NodeResumeState } from "@/hooks/use-node-resume";
import { useNodeUnblock, type NodeUnblockState } from "@/hooks/use-node-unblock";
import type { Resource } from "@/hooks/use-resource";
import { pauseCauseOf } from "@/lib/execution-stop";
import {
  hasOpenAttempt,
  unresolvedRequestsOf,
  unresolvedRequestsText,
} from "@/lib/external-requests";

export interface NodeControlsInput {
  readonly node: MissionRunnableNode;
  readonly nodes: readonly MissionNodeRecord[];
  readonly missionVersion: number;
  readonly proposals: readonly MissionProposal[];
  readonly actions: Resource<readonly MissionExternalAction[]>;
  readonly executions: Resource<readonly SchedulerExecutionRecord[]>;
  readonly onChanged: () => void;
}

export interface NodeControlsState {
  readonly unblock: NodeUnblockState;
  readonly resume: NodeResumeState;
  readonly override: NodeOverrideState;
  readonly discard: NodeDiscardState;
  readonly guardLine: string | null;
  readonly retry: (() => void) | null;
  readonly visible: boolean;
}

function guardLineOf(
  node: MissionRunnableNode,
  actions: NodeControlsInput["actions"],
  executions: NodeControlsInput["executions"],
): string | null {
  if (!hasOpenAttempt(node)) return null;
  const paused = node.state === "Paused";
  const subject = paused ? "executions and the external actions" : "external actions";
  if (actions.loading || executions.loading) {
    return `Reading the ${subject} of attempt ${node.attempt}.`;
  }
  const failure = actions.error ?? executions.error;
  if (actions.data === null || executions.data === null) {
    return `The ${paused ? "executions or the external actions" : "external actions"} of attempt ${node.attempt} could not be read: ${failure?.message}`;
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
  const answered = actions.data !== null && executions.data !== null;
  const guard = answered ? actions.data : null;
  const cause = executions.data === null ? null : pauseCauseOf(executions.data).cause;
  const unblock = useNodeUnblock(node, missionVersion, proposals, onChanged);
  const resume = useNodeResume(node, missionVersion, nodes, guard, cause, onChanged);
  const override = useNodeOverride(node, missionVersion, guard, onChanged);
  const discard = useNodeDiscard(node, missionVersion, guard, onChanged);
  const guardLine = guardLineOf(node, actions, executions);
  const failed = hasOpenAttempt(node) && !answered && !actions.loading && !executions.loading;

  return {
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
      unblock.available ||
      resume.available ||
      override.available ||
      discard.available ||
      guardLine !== null,
  };
}
