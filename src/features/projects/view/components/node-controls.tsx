import { Button } from "@/components/ui/button";
import type { MissionProposal, MissionRunnableNode } from "@/api/types";
import { useNodeDiscard } from "../use-node-discard";
import { useNodeUnblock } from "../use-node-unblock";
import { NodeDiscardDialog } from "./node-discard-dialog";
import { NodeUnblockDialog } from "./node-unblock-dialog";

interface NodeControlsProps {
  readonly node: MissionRunnableNode;
  readonly missionVersion: number;
  readonly proposals: readonly MissionProposal[];
  readonly onChanged: () => void;
}

export function NodeControls({ node, missionVersion, proposals, onChanged }: NodeControlsProps) {
  const unblock = useNodeUnblock(node, missionVersion, proposals, onChanged);
  const discard = useNodeDiscard(node, missionVersion, onChanged);

  if (!unblock.available && !discard.available) return null;

  return (
    <section aria-label="Controls" className="flex flex-col gap-2">
      <h3 className="font-semibold">Controls</h3>
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
