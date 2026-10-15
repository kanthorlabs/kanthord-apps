import { Button } from "@/components/ui/button";
import type {
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  MissionRunnableNode,
  SchedulerExecutionRecord,
} from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import { pauseCauseOf } from "@/lib/execution-stop";
import { unresolvedRequestsOf, unresolvedRequestsText } from "@/lib/external-requests";
import { useNodeDiscard } from "@/hooks/use-node-discard";
import { useNodeOverride } from "@/hooks/use-node-override";
import { useNodeResume } from "@/hooks/use-node-resume";
import { useNodeUnblock } from "@/hooks/use-node-unblock";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";

interface NodeControlsProps {
  readonly node: MissionRunnableNode;
  readonly nodes: readonly MissionNodeRecord[];
  readonly missionVersion: number;
  readonly proposals: readonly MissionProposal[];
  readonly actions: Resource<readonly MissionExternalAction[]>;
  readonly executions: Resource<readonly SchedulerExecutionRecord[]>;
  readonly onChanged: () => void;
}

function guardLineOf(
  node: MissionRunnableNode,
  actions: NodeControlsProps["actions"],
  executions: NodeControlsProps["executions"],
): string | null {
  if (node.state !== "Paused") return null;
  if (actions.loading || executions.loading) {
    return `Reading the executions and the external actions of attempt ${node.attempt}.`;
  }
  const failure = actions.error ?? executions.error;
  if (actions.data === null || executions.data === null) {
    return `The executions or the external actions of attempt ${node.attempt} could not be read: ${failure?.message}`;
  }
  const unresolved = unresolvedRequestsOf(actions.data);
  return unresolved.length === 0 ? null : unresolvedRequestsText(node.attempt, unresolved);
}

export function NodeControls({
  node,
  nodes,
  missionVersion,
  proposals,
  actions,
  executions,
  onChanged,
}: NodeControlsProps) {
  const answered = actions.data !== null && executions.data !== null;
  const guard = answered ? actions.data : null;
  const cause = executions.data === null ? null : pauseCauseOf(executions.data).cause;
  const unblock = useNodeUnblock(node, missionVersion, proposals, onChanged);
  const resume = useNodeResume(node, missionVersion, nodes, guard, cause, onChanged);
  const override = useNodeOverride(node, missionVersion, onChanged, guard);
  const discard = useNodeDiscard(node, missionVersion, onChanged, guard);
  const guardLine = guardLineOf(node, actions, executions);

  if (
    !unblock.available &&
    !resume.available &&
    !override.available &&
    !discard.available &&
    guardLine === null
  ) {
    return null;
  }

  return (
    <section aria-label="Controls" className="flex flex-col gap-2">
      <h3 className="font-semibold">Controls</h3>
      {guardLine !== null && <p className="text-sm text-muted-foreground">{guardLine}</p>}
      {node.state === "Paused" && !answered && !actions.loading && !executions.loading && (
        <div className="flex md:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              actions.reload();
              executions.reload();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 md:justify-end">
        {unblock.available && (
          <Button variant="outline" size="sm" onClick={unblock.request}>
            Unblock
          </Button>
        )}
        {resume.available && (
          <Button variant="outline" size="sm" onClick={resume.request}>
            Resume
          </Button>
        )}
        {override.available && (
          <Button variant="outline" size="sm" onClick={override.request}>
            Override
          </Button>
        )}
        {discard.available && (
          <Button variant="destructive" size="sm" onClick={discard.request}>
            Discard
          </Button>
        )}
      </div>
      <NodeUnblockDialog name={node.content.name} unblock={unblock} />
      <NodeResumeDialog name={node.content.name} resume={resume} />
      <NodeOverrideDialog name={node.content.name} override={override} />
      <NodeDiscardDialog name={node.content.name} discard={discard} />
    </section>
  );
}
