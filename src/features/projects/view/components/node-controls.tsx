import { Button } from "@/components/ui/button";
import type { MissionExternalAction, MissionProposal, MissionRunnableNode } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import { unresolvedRequestsOf, unresolvedRequestsText } from "@/lib/external-requests";
import { useNodeDiscard } from "@/hooks/use-node-discard";
import { useNodeUnblock } from "@/hooks/use-node-unblock";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";

interface NodeControlsProps {
  readonly node: MissionRunnableNode;
  readonly missionVersion: number;
  readonly proposals: readonly MissionProposal[];
  readonly actions: Resource<readonly MissionExternalAction[]>;
  readonly onChanged: () => void;
}

function guardLineOf(
  node: MissionRunnableNode,
  actions: NodeControlsProps["actions"],
): string | null {
  if (node.state !== "Paused") return null;
  if (actions.loading) return `Reading the external actions of attempt ${node.attempt}.`;
  if (actions.data === null) {
    return `The external actions of attempt ${node.attempt} could not be read: ${actions.error?.message}`;
  }
  const unresolved = unresolvedRequestsOf(actions.data);
  return unresolved.length === 0 ? null : unresolvedRequestsText(node.attempt, unresolved);
}

export function NodeControls({
  node,
  missionVersion,
  proposals,
  actions,
  onChanged,
}: NodeControlsProps) {
  const unblock = useNodeUnblock(node, missionVersion, proposals, onChanged);
  const discard = useNodeDiscard(node, missionVersion, onChanged, actions.data);
  const guardLine = guardLineOf(node, actions);

  if (!unblock.available && !discard.available && guardLine === null) return null;

  return (
    <section aria-label="Controls" className="flex flex-col gap-2">
      <h3 className="font-semibold">Controls</h3>
      {guardLine !== null && <p className="text-sm text-muted-foreground">{guardLine}</p>}
      {node.state === "Paused" && !actions.loading && actions.data === null && (
        <div className="flex md:justify-end">
          <Button variant="outline" size="sm" onClick={actions.reload}>
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
        {discard.available && (
          <Button variant="destructive" size="sm" onClick={discard.request}>
            Discard
          </Button>
        )}
      </div>
      <NodeUnblockDialog name={node.content.name} unblock={unblock} />
      <NodeDiscardDialog name={node.content.name} discard={discard} />
    </section>
  );
}
